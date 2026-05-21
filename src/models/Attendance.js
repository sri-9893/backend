import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    // Employee reference (kept as `user` to match current project usage)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    // Punch times stored as HH:mm (24h)
    punchInTime: {
      type: String,
      default: '',
    },
    punchOutTime: {
      type: String,
      default: '',
    },

    totalHours: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ['Present', 'Absent', 'Half Day', 'Leave', 'Holiday'],
      required: true,
      default: 'Present',
    },

    approvalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Approved',
    },

    // When employee requests corrections
    editRequested: {
      type: Boolean,
      default: false,
    },
    originalPunchIn: {
      type: String,
      default: '',
    },
    originalPunchOut: {
      type: String,
      default: '',
    },

    remarks: {
      type: String,
      default: '',
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one record per employee per day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;

