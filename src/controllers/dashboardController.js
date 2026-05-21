import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import Leave from '../models/Leave.js';
import Holiday from '../models/Holiday.js';
import Payroll from '../models/Payroll.js';

// Normalize date to UTC midnight
const getTodayMidnight = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const today = getTodayMidnight();

    if (req.user.role === 'Admin') {
      const totalEmployees = await User.countDocuments({ role: 'Employee' });
      const presentToday = await Attendance.countDocuments({ date: today, status: 'Present' });
      const pendingLeaves = await Leave.countDocuments({ status: 'Pending' });
      const leavesToday = await Attendance.countDocuments({ date: today, status: 'Leave' });
      const absentToday = Math.max(0, totalEmployees - presentToday - leavesToday);

      const currentYear = new Date().getUTCFullYear();
      const currentMonth = new Date().getUTCMonth() + 1; // 1-12
      
      const payrolls = await Payroll.find({ month: currentMonth, year: currentYear });
      const totalPayrollCost = payrolls.reduce((acc, curr) => acc + curr.netSalary, 0);

      res.status(200).json({
        success: true,
        stats: {
          totalEmployees,
          presentToday,
          absentToday,
          pendingLeaves,
          totalPayrollCost,
        },
      });
    } else {
      const userId = req.user.id;
      const currentYear = new Date().getUTCFullYear();
      const currentMonth = new Date().getUTCMonth() + 1;

      const startDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
      const endDate = new Date(Date.UTC(currentYear, currentMonth, 0));

      const presentCount = await Attendance.countDocuments({
        user: userId,
        date: { $gte: startDate, $lte: endDate },
        status: 'Present',
      });

      const absentCount = await Attendance.countDocuments({
        user: userId,
        date: { $gte: startDate, $lte: endDate },
        status: 'Absent',
      });

      const leaveCount = await Attendance.countDocuments({
        user: userId,
        date: { $gte: startDate, $lte: endDate },
        status: 'Leave',
      });

      const totalLeavesApplied = await Leave.countDocuments({ user: userId });
      const pendingLeavesApplied = await Leave.countDocuments({ user: userId, status: 'Pending' });
      const approvedLeavesApplied = await Leave.countDocuments({ user: userId, status: 'Approved' });

      const upcomingHolidays = await Holiday.find({
        date: { $gte: today },
      })
        .sort({ date: 1 })
        .limit(5);

      const lastPayroll = await Payroll.findOne({ user: userId, status: 'Paid' }).sort({ year: -1, month: -1 });

      res.status(200).json({
        success: true,
        stats: {
          attendance: {
            present: presentCount,
            absent: absentCount,
            leave: leaveCount,
          },
          leaves: {
            total: totalLeavesApplied,
            pending: pendingLeavesApplied,
            approved: approvedLeavesApplied,
          },
          upcomingHolidays,
          salarySummary: lastPayroll ? {
            month: lastPayroll.month,
            year: lastPayroll.year,
            basicSalary: lastPayroll.basicSalary,
            deductions: lastPayroll.deductions,
            netSalary: lastPayroll.netSalary,
          } : null,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};
