import Holiday from '../models/Holiday.js';
import Leave from '../models/Leave.js';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';

export const getCalendarEvents = async (req, res, next) => {
  try {
    const { month, year, userId } = req.query;

    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Please provide month and year' });
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const events = [];

    // 1. Fetch holidays (Global)
    const holidays = await Holiday.find({
      date: { $gte: startDate, $lte: endDate },
    });

    holidays.forEach((h) => {
      events.push({
        id: `holiday-${h._id}`,
        title: `🎉 ${h.name} (${h.type})`,
        start: h.date,
        end: h.date,
        allDay: true,
        type: 'holiday',
        color: '#10B981',
      });
    });

    // 2. Fetch Leaves
    const leaveQuery = {
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
      status: 'Approved',
    };

    if (req.user.role === 'Employee') {
      leaveQuery.user = req.user.id;
    } else if (userId) {
      leaveQuery.user = userId;
    }

    const leaves = await Leave.find(leaveQuery).populate('user', 'name employeeId');
    leaves.forEach((l) => {
      events.push({
        id: `leave-${l._id}`,
        title: `🌴 ${req.user.role === 'Admin' ? `${l.user.name}: ` : ''}${l.type}`,
        start: l.startDate,
        end: l.endDate,
        allDay: true,
        type: 'leave',
        color: '#F59E0B',
      });
    });

    // 3. Fetch Attendance
    const attendanceQuery = {
      date: { $gte: startDate, $lte: endDate },
    };

    if (req.user.role === 'Employee') {
      attendanceQuery.user = req.user.id;
    } else if (userId) {
      attendanceQuery.user = userId;
    }

    const attendance = await Attendance.find(attendanceQuery).populate('user', 'name employeeId');
    attendance.forEach((a) => {
      let title = '';
      let color = '';
      if (a.status === 'Present') {
        title = `✓ ${req.user.role === 'Admin' ? `${a.user.name}: ` : ''}Present (${a.checkIn} - ${a.checkOut || 'Active'})`;
        color = '#3B82F6';
      } else if (a.status === 'Absent') {
        title = `✗ ${req.user.role === 'Admin' ? `${a.user.name}: ` : ''}Absent`;
        color = '#EF4444';
      } else {
        return;
      }

      events.push({
        id: `attendance-${a._id}`,
        title,
        start: a.date,
        end: a.date,
        allDay: true,
        type: 'attendance',
        color,
      });
    });

    res.status(200).json({
      success: true,
      events,
    });
  } catch (error) {
    next(error);
  }
};
