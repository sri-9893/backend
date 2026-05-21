import mongoose from 'mongoose';

const payrollSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    basicSalary: {
      type: Number,
      required: true,
      min: 0,
    },
    workingDays: {
      type: Number,
      required: true,
      min: 0,
    },
    presentDays: {
      type: Number,
      required: true,
      min: 0,
    },
    absentDays: {
      type: Number,
      required: true,
      min: 0,
    },
    approvedLeaves: {
      type: Number,
      required: true,
      min: 0,
    },
    holidays: {
      type: Number,
      required: true,
      min: 0,
    },
    deductions: {
      type: Number,
      required: true,
      min: 0,
    },
    netSalary: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Draft', 'Paid'],
      default: 'Draft',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure unique payroll per user for a specific month and year
payrollSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

const Payroll = mongoose.model('Payroll', payrollSchema);
export default Payroll;
