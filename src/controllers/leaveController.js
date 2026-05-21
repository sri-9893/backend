import Leave from '../models/Leave.js';
import Attendance from '../models/Attendance.js';
import Holiday from '../models/Holiday.js';
import User from '../models/User.js';
import { sendLeaveStatusEmail } from '../services/emailService.js';

// Normalize date to YYYY-MM-DD midnight UTC
const getNormalizedDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export const applyLeave = async (req, res, next) => {
  try {
    const { startDate, endDate, type, reason } = req.body;

    if (!startDate || !endDate || !type || !reason) {
      return res.status(400).json({ success: false, message: 'Please fill in all fields' });
    }

    const start = getNormalizedDate(startDate);
    const end = getNormalizedDate(endDate);

    if (start > end) {
      return res.status(400).json({ success: false, message: 'Start date cannot be after end date' });
    }

    // Check for overlapping approved or pending leaves
    const overlap = await Leave.findOne({
      user: req.user.id,
      status: { $in: ['Pending', 'Approved'] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });

    if (overlap) {
      return res.status(400).json({
        success: false,
        message: `You have an overlapping ${overlap.status.toLowerCase()} leave request within this range.`
      });
    }

    const leave = await Leave.create({
      user: req.user.id,
      startDate: start,
      endDate: end,
      type,
      reason,
    });

    res.status(201).json({
      success: true,
      leave,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyLeaves = async (req, res, next) => {
  try {
    const leaves = await Leave.find({ user: req.user.id }).sort({ startDate: -1 });
    res.status(200).json({
      success: true,
      count: leaves.length,
      leaves,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllLeaves = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) {
      filter.status = status;
    }

    const leaves = await Leave.find(filter)
      .populate('user', 'name employeeId department designation email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: leaves.length,
      leaves,
    });
  } catch (error) {
    next(error);
  }
};

export const updateLeaveStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Please provide valid status (Approved or Rejected)' });
    }

    let leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    if (leave.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Leave request has already been ${leave.status.toLowerCase()}` });
    }

    leave.status = status;
    leave.remarks = remarks || '';
    await leave.save();

    const employee = await User.findById(leave.user);

    // If Approved, sync with Attendance
    if (status === 'Approved') {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);

      // Loop through each day of leave
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const checkDate = new Date(d);
        checkDate.setUTCHours(0, 0, 0, 0);

        const day = checkDate.getUTCDay();
        const isWeekendDay = day === 0 || day === 6; // 0 = Sunday, 6 = Saturday

        const isHoliday = await Holiday.findOne({ date: checkDate });

        if (!isWeekendDay && !isHoliday) {
          // Upsert attendance record for this day
          await Attendance.findOneAndUpdate(
            { user: leave.user, date: checkDate },
            { status: 'Leave', checkIn: '', checkOut: '' },
            { upsert: true, new: true }
          );
        }
      }
    }

    // Send status update email asynchronously
    if (employee) {
      // Ensure latest status is included in the email body
      sendLeaveStatusEmail(leave, employee);
    }


    res.status(200).json({
      success: true,
      leave,
    });
  } catch (error) {
    next(error);
  }
};
