import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Holiday from '../models/Holiday.js';

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms');
    console.log('Database connected for seeding...');

    await User.deleteMany({});
    await Holiday.deleteMany({});
    console.log('Cleared existing data.');

    // Seed Admin
    const admin = await User.create({
      employeeId: 'ADM001',
      name: 'HR Administrator',
      email: 'admin@hrms.com',
      password: 'admin123',
      department: 'HR Operations',
      designation: 'HR Manager',
      joiningDate: new Date('2024-01-01'),
      salary: 95000,
      phone: '+1 555-0100',
      role: 'Admin',
    });
    console.log('Admin seeded: admin@hrms.com / admin123');

    // Seed Employee
    const employee = await User.create({
      employeeId: 'EMP101',
      name: 'John Doe',
      email: 'employee@hrms.com',
      password: 'employee123',
      department: 'Software Engineering',
      designation: 'MERN Stack Developer',
      joiningDate: new Date('2025-06-01'),
      salary: 75000,
      phone: '+1 555-0155',
      role: 'Employee',
    });
    console.log('Employee seeded: employee@hrms.com / employee123');

    // Seed Holidays for current year
    const currentYear = new Date().getFullYear();
    const holidaysList = [
      { date: new Date(Date.UTC(currentYear, 0, 1)), name: "New Year's Day", type: 'National' },
      { date: new Date(Date.UTC(currentYear, 6, 4)), name: 'Independence Day', type: 'National' },
      { date: new Date(Date.UTC(currentYear, 10, 26)), name: 'Thanksgiving Day', type: 'National' },
      { date: new Date(Date.UTC(currentYear, 11, 25)), name: 'Christmas Day', type: 'National' },
      { date: new Date(Date.UTC(currentYear, 4, 1)), name: 'Labor Day', type: 'Company' },
    ];

    await Holiday.insertMany(holidaysList);
    console.log('Holidays seeded successfully.');

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exit(1);
  }
};

seedData();
