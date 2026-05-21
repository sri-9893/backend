import Payroll from '../models/Payroll.js';
import Payslip from '../models/Payslip.js';
import User from '../models/User.js';
import Holiday from '../models/Holiday.js';
import Attendance from '../models/Attendance.js';
import { generatePayslipPDF } from '../services/pdfService.js';
import { sendPayslipGeneratedEmail } from '../services/emailService.js';

// Helper to normalize date to UTC midnight
const getNormalizedDate = (year, month, day) => {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

// Check if day is weekend (0 = Sunday, 6 = Saturday in UTC)
const isWeekend = (date) => {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
};

// Core Payroll Calculation Logic
export const calculateMonthlyStats = async (userId, month, year) => {
  const employee = await User.findById(userId);
  if (!employee) throw new Error('Employee not found');

  const basicSalary = employee.salary || 0;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  let workingDays = 0;
  let presentDays = 0;
  let approvedLeaves = 0;
  let holidayDays = 0;
  let absentDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = getNormalizedDate(year, month, day);

    // 1. Check if weekend
    if (isWeekend(currentDate)) {
      continue;
    }

    // 2. Check if holiday
    const holiday = await Holiday.findOne({ date: currentDate });
    if (holiday) {
      holidayDays++;
      continue;
    }

    // It's a working day
    workingDays++;

    // 3. Find attendance
    const attendance = await Attendance.findOne({ user: userId, date: currentDate });
    // Payroll should use ONLY approved attendance records
    if (attendance && attendance.approvalStatus === 'Approved') {
      if (attendance.status === 'Present') {
        presentDays++;
      } else if (attendance.status === 'Leave') {
        approvedLeaves++;
      } else if (attendance.status === 'Absent') {
        absentDays++;
      } else if (attendance.status === 'Holiday') {
        workingDays--;
        holidayDays++;
      }
    } else {
      // No record (or not approved) on a working weekday means absent
      absentDays++;
    }

  }

  // Calculate deductions
  const dailyRate = workingDays > 0 ? basicSalary / workingDays : 0;
  const deductions = dailyRate * absentDays;
  const netSalary = Math.max(0, basicSalary - deductions);

  return {
    basicSalary,
    workingDays,
    presentDays,
    absentDays,
    approvedLeaves,
    holidays: holidayDays,
    deductions: Math.round(deductions * 100) / 100,
    netSalary: Math.round(netSalary * 100) / 100,
  };
};

export const getPayrollPreview = async (req, res, next) => {
  try {
    const { userId, month, year } = req.query;

    // UI may only send month/year. If userId is missing, use logged-in user id.
    const resolvedUserId = userId || req.user?.id;

    if (!resolvedUserId || !month || !year) {
      return res
        .status(400)
        .json({ success: false, message: 'Please provide userId, month, and year' });
    }

    const stats = await calculateMonthlyStats(
      resolvedUserId,
      parseInt(month),
      parseInt(year)
    );

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

export const generatePayroll = async (req, res, next) => {
  try {
    const { userId, month, year, status } = req.body;

    if (!userId || !month || !year) {
      return res.status(400).json({ success: false, message: 'Please provide userId, month, and year' });
    }

    const employee = await User.findById(userId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Calculate stats
    const stats = await calculateMonthlyStats(userId, parseInt(month), parseInt(year));

    // Check if payroll already exists
    let payroll = await Payroll.findOne({ user: userId, month: parseInt(month), year: parseInt(year) });
    
    if (payroll) {
      payroll.basicSalary = stats.basicSalary;
      payroll.workingDays = stats.workingDays;
      payroll.presentDays = stats.presentDays;
      payroll.absentDays = stats.absentDays;
      payroll.approvedLeaves = stats.approvedLeaves;
      payroll.holidays = stats.holidays;
      payroll.deductions = stats.deductions;
      payroll.netSalary = stats.netSalary;
      payroll.status = status || payroll.status;
      await payroll.save();
    } else {
      payroll = await Payroll.create({
        user: userId,
        month: parseInt(month),
        year: parseInt(year),
        ...stats,
        status: status || 'Draft',
      });
    }

    let payslip = await Payslip.findOne({ payroll: payroll._id });
    if (!payslip) {
      payslip = await Payslip.create({
        payroll: payroll._id,
        user: userId,
        pdfUrl: `/api/payslips/${payroll._id}/download`,
      });
    }

    // Send email notification
    sendPayslipGeneratedEmail(payroll, employee);

    res.status(201).json({
      success: true,
      payroll,
      payslip,
    });
  } catch (error) {
    next(error);
  }
};

export const getPayrollHistory = async (req, res, next) => {
  try {
    const { month, year, userId } = req.query;
    const filter = {};

    if (req.user.role === 'Employee') {
      filter.user = req.user.id;
    } else if (userId) {
      filter.user = userId;
    }

    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);

    const records = await Payroll.find(filter)
      .populate('user', 'name employeeId department designation email')
      .sort({ year: -1, month: -1 });

    res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    next(error);
  }
};

export const downloadPayslipPDFFile = async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll record not found' });
    }

    if (req.user.role === 'Employee' && payroll.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access this payslip' });
    }

    const employee = await User.findById(payroll.user);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip_${employee.employeeId}_${payroll.month}_${payroll.year}.pdf`);

    generatePayslipPDF(payroll, employee, res);
  } catch (error) {
    next(error);
  }
};
