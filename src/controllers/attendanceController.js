import Attendance from '../models/Attendance.js';
import Holiday from '../models/Holiday.js';
import Leave from '../models/Leave.js';

// Normalize date to YYYY-MM-DD midnight UTC
const getNormalizedDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// Check if day is weekend (0 = Sunday, 6 = Saturday in UTC)
const isWeekend = (date) => {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
};

const getHHmm = (date) => {
  // Ensures 24h format HH:mm
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const parseHHmmToMinutes = (hhmm) => {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return null;
  const [hh, mm] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
};

const calculateTotalHours = (punchInTime, punchOutTime) => {
  const inMin = parseHHmmToMinutes(punchInTime);
  const outMin = parseHHmmToMinutes(punchOutTime);
  if (inMin == null || outMin == null) return 0;
  // If user somehow punches out earlier than in, treat as 0 hours (validation will block).
  const diff = outMin - inMin;
  if (diff <= 0) return 0;
  return Math.round((diff / 60) * 100) / 100;
};

const isEditAllowedForEmployee = ({ attendanceDate, requestDate, adminOverride }) => {
  if (adminOverride) return true;
  const diffMs = requestDate.getTime() - attendanceDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= 7 && diffDays >= 0;
};

const getLeaveForUserOnDate = async (userId, date) => {
  return Leave.findOne({
    user: userId,
    status: 'Approved',
    startDate: { $lte: date },
    endDate: { $gte: date },
  });
};

const validatePunchWindow = async ({ reqUserId, targetDate }) => {
  if (isWeekend(targetDate)) {
    return { ok: false, message: 'Target date is a weekend. Attendance cannot be punched.' };
  }
  const holiday = await Holiday.findOne({ date: targetDate });
  if (holiday) {
    return { ok: false, message: `Target date is a holiday: ${holiday.name}` };
  }

  const leave = await getLeaveForUserOnDate(reqUserId, targetDate);
  if (leave) {
    return { ok: false, message: `You are on approved leave (${leave.type}) for the selected date.` };
  }

  return { ok: true };
};

export const punchIn = async (req, res, next) => {
  try {
    const { date } = req.body || {};
    const targetDate = date ? getNormalizedDate(date) : getNormalizedDate();
    const today = getNormalizedDate();

    // Prevent future dates
    if (targetDate.getTime() > today.getTime()) {
      return res.status(400).json({ success: false, message: 'Cannot punch in for future dates.' });
    }

    const punchWindow = await validatePunchWindow({ reqUserId: req.user.id, targetDate });
    if (!punchWindow.ok) return res.status(400).json({ success: false, message: punchWindow.message });

    const attendance = await Attendance.findOne({ user: req.user.id, date: targetDate });
    if (attendance && attendance.punchInTime) {
      return res.status(400).json({ success: false, message: 'You have already punched in for this date.' });
    }

    const now = new Date();
    const punchInTime = getHHmm(now);

    // Create or update record
    const record = attendance
      ? await Attendance.findOneAndUpdate(
          { _id: attendance._id },
          {
            punchInTime,
            status: attendance.status || 'Present',
            approvalStatus: attendance.approvalStatus || 'Approved',
            editRequested: false,
            originalPunchIn: '',
            originalPunchOut: '',
            remarks: '',
          },
          { new: true }
        )
      : await Attendance.create({
          user: req.user.id,
          date: targetDate,
          punchInTime,
          punchOutTime: '',
          totalHours: 0,
          status: 'Present',
          approvalStatus: 'Approved',
          editRequested: false,
        });

    res.status(201).json({ success: true, attendance: record });
  } catch (error) {
    next(error);
  }
};

export const punchOut = async (req, res, next) => {
  try {
    const { date } = req.body || {};
    const targetDate = date ? getNormalizedDate(date) : getNormalizedDate();
    const today = getNormalizedDate();

    if (targetDate.getTime() > today.getTime()) {
      return res.status(400).json({ success: false, message: 'Cannot punch out for future dates.' });
    }

    const attendance = await Attendance.findOne({ user: req.user.id, date: targetDate });
    if (!attendance || !attendance.punchInTime) {
      return res.status(400).json({ success: false, message: 'You have not punched in for this date yet.' });
    }

    if (attendance.punchOutTime) {
      return res.status(400).json({ success: false, message: 'You have already punched out for this date.' });
    }

    const now = new Date();
    const punchOutTime = getHHmm(now);

    const inMin = parseHHmmToMinutes(attendance.punchInTime);
    const outMin = parseHHmmToMinutes(punchOutTime);

    if (outMin <= inMin) {
      return res.status(400).json({ success: false, message: 'Punch out time must be after punch in time.' });
    }

    const totalHours = calculateTotalHours(attendance.punchInTime, punchOutTime);

    attendance.punchOutTime = punchOutTime;
    attendance.totalHours = totalHours;
    attendance.status = totalHours >= 4 ? 'Present' : 'Half Day';
    attendance.approvalStatus = 'Approved';
    attendance.editRequested = false;
    attendance.originalPunchIn = '';
    attendance.originalPunchOut = '';
    attendance.remarks = '';

    await attendance.save();

    res.status(200).json({ success: true, attendance });
  } catch (error) {
    next(error);
  }
};

export const editAttendanceRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { punchInTime, punchOutTime, remarks } = req.body || {};

    if (!punchInTime && !punchOutTime) {
      return res.status(400).json({ success: false, message: 'Provide punchInTime and/or punchOutTime.' });
    }

    const record = await Attendance.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found.' });

    const isAdmin = req.user.role === 'Admin';
    const isOwner = record.user.toString() === req.user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this attendance.' });
    }

    const targetDate = getNormalizedDate(record.date);
    const now = getNormalizedDate();
    const adminOverride = isAdmin;

    if (!isEditAllowedForEmployee({ attendanceDate: targetDate, requestDate: now, adminOverride })) {
      return res.status(400).json({ success: false, message: 'Editing window expired. Attendance is locked.' });
    }

    // If request came from employee, set up pending approval
    // Always validate times logically
    const nextPunchIn = punchInTime !== undefined ? punchInTime : record.punchInTime;
    const nextPunchOut = punchOutTime !== undefined ? punchOutTime : record.punchOutTime;


    if (nextPunchOut && nextPunchIn) {
      const inMin = parseHHmmToMinutes(nextPunchIn);
      const outMin = parseHHmmToMinutes(nextPunchOut);
      if (inMin == null || outMin == null || outMin <= inMin) {
        return res.status(400).json({ success: false, message: 'Punch out time must be after punch in time.' });
      }
    }

    const nextTotalHours = nextPunchIn && nextPunchOut ? calculateTotalHours(nextPunchIn, nextPunchOut) : record.totalHours;

    if (!isAdmin) {
      // Store originals only once per edit cycle
      if (!record.editRequested) {
        record.originalPunchIn = record.punchInTime || '';
        record.originalPunchOut = record.punchOutTime || '';
      }

      record.punchInTime = nextPunchIn;
      record.punchOutTime = nextPunchOut || '';
      record.totalHours = nextTotalHours;
      record.remarks = remarks || record.remarks;
      record.editRequested = true;
      record.approvalStatus = 'Pending';

      await record.save();

      return res.status(200).json({ success: true, attendance: record });
    }

    // Admin editing directly (optional: treat as immediate approval)
    record.punchInTime = nextPunchIn;
    record.punchOutTime = nextPunchOut || '';
    record.totalHours = nextTotalHours;
    record.remarks = remarks || record.remarks;

    record.editRequested = false;
    record.approvalStatus = 'Approved';
    record.originalPunchIn = '';
    record.originalPunchOut = '';
    record.approvedBy = req.user.id;
    record.approvedAt = new Date();

    await record.save();

    return res.status(200).json({ success: true, attendance: record });
  } catch (error) {
    next(error);
  }
};

export const approveAttendanceEdit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await Attendance.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found.' });

    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Only Admin can approve.' });
    }

    record.approvalStatus = 'Approved';
    record.editRequested = false;
    record.originalPunchIn = '';
    record.originalPunchOut = '';
    record.remarks = record.remarks || '';
    record.approvedBy = req.user.id;
    record.approvedAt = new Date();

    await record.save();

    res.status(200).json({ success: true, attendance: record });
  } catch (error) {
    next(error);
  }
};

export const rejectAttendanceEdit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await Attendance.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found.' });

    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Only Admin can reject.' });
    }

    // Restore originals
    record.punchInTime = record.originalPunchIn || record.punchInTime;
    record.punchOutTime = record.originalPunchOut || record.punchOutTime;
    record.totalHours = record.punchInTime && record.punchOutTime
      ? calculateTotalHours(record.punchInTime, record.punchOutTime)
      : 0;

    record.approvalStatus = 'Rejected';
    record.editRequested = false;
    record.originalPunchIn = '';
    record.originalPunchOut = '';

    await record.save();

    res.status(200).json({ success: true, attendance: record });
  } catch (error) {
    next(error);
  }
};

export const getMyAttendance = async (req, res, next) => {
  try {
    const { month, year } = req.query; // 1-indexed (1-12)
    const userId = req.user.id;

    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Please provide month and year' });
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0)); // last day of month

    const records = await Attendance.find({
      user: userId,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    res.status(200).json({ success: true, history: records });
  } catch (error) {
    next(error);
  }
};

export const getPendingCorrections = async (req, res, next) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Admin only.' });
    }

    const records = await Attendance.find({
      editRequested: true,
      approvalStatus: 'Pending',
    }).populate('user', 'name employeeId department designation');

    res.status(200).json({ success: true, records });
  } catch (error) {
    next(error);
  }
};

// Backward compatibility endpoints (used by existing UI)
export const getAllAttendance = async (req, res, next) => {
  try {
    const { date } = req.query;
    const searchDate = date ? getNormalizedDate(date) : getNormalizedDate();

    const records = await Attendance.find({ date: searchDate }).populate('user', 'name employeeId department designation');

    res.status(200).json({
      success: true,
      date: searchDate,
      records,
    });
  } catch (error) {
    next(error);
  }
};

export const getTodayStatus = async (req, res, next) => {
  try {
    const today = getNormalizedDate();
    const record = await Attendance.findOne({ user: req.user.id, date: today });

    res.status(200).json({ success: true, record });
  } catch (error) {
    next(error);
  }
};

