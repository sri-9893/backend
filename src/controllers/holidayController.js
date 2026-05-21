import Holiday from '../models/Holiday.js';
import Attendance from '../models/Attendance.js';

// Normalize date to midnight UTC
const getNormalizedDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export const getHolidays = async (req, res, next) => {
  try {
    const holidays = await Holiday.find({}).sort({ date: 1 });
    res.status(200).json({
      success: true,
      count: holidays.length,
      holidays,
    });
  } catch (error) {
    next(error);
  }
};

export const createHoliday = async (req, res, next) => {
  try {
    const { date, name, type } = req.body;

    if (!date || !name) {
      return res.status(400).json({ success: false, message: 'Please provide date and name' });
    }

    const targetDate = getNormalizedDate(date);

    const exists = await Holiday.findOne({ date: targetDate });
    if (exists) {
      return res.status(400).json({ success: false, message: 'A holiday on this date already exists' });
    }

    const holiday = await Holiday.create({
      date: targetDate,
      name,
      type: type || 'Company',
    });

    // Retroactively update attendance records for this date to Holiday status
    await Attendance.updateMany(
      { date: targetDate },
      { status: 'Holiday', checkIn: '', checkOut: '' }
    );

    res.status(201).json({
      success: true,
      holiday,
    });
  } catch (error) {
    next(error);
  }
};

export const updateHoliday = async (req, res, next) => {
  try {
    const { name, type } = req.body;

    let holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found' });
    }

    holiday.name = name || holiday.name;
    holiday.type = type || holiday.type;

    await holiday.save();

    res.status(200).json({
      success: true,
      holiday,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteHoliday = async (req, res, next) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found' });
    }

    const targetDate = holiday.date;

    await holiday.deleteOne();

    // Remove automatic holiday entries for this day
    await Attendance.deleteMany({ date: targetDate, status: 'Holiday' });

    res.status(200).json({
      success: true,
      message: 'Holiday deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
