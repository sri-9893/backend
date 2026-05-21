import User from '../models/User.js';
import { sendEmployeeRegistrationEmail } from '../services/emailService.js';

export const getEmployees = async (req, res, next) => {
  try {
    const { search, department, role } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (department) {
      query.department = department;
    }

    if (role) {
      query.role = role;
    }

    const employees = await User.find(query).sort({ employeeId: 1 });

    res.status(200).json({
      success: true,
      count: employees.length,
      employees,
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployee = async (req, res, next) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.status(200).json({
      success: true,
      employee,
    });
  } catch (error) {
    next(error);
  }
};

export const createEmployee = async (req, res, next) => {
  try {
    const { employeeId, name, email, password, department, designation, joiningDate, salary, phone, role } = req.body;

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const idExists = await User.findOne({ employeeId });
    if (idExists) {
      return res.status(400).json({ success: false, message: 'Employee ID already exists' });
    }

    const defaultPassword = password || `${employeeId}@123`;

    const employee = await User.create({
      employeeId,
      name,
      email,
      password: defaultPassword,
      department,
      designation,
      joiningDate,
      salary,
      phone,
      role: role || 'Employee',
    });

    // Send Welcome Email
    sendEmployeeRegistrationEmail(employee, defaultPassword);

    res.status(201).json({
      success: true,
      employee,
    });
  } catch (error) {
    next(error);
  }
};

export const updateEmployee = async (req, res, next) => {
  try {
    const { name, email, department, designation, joiningDate, salary, phone, role, password } = req.body;

    let employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    employee.name = name || employee.name;
    employee.email = email || employee.email;
    employee.department = department !== undefined ? department : employee.department;
    employee.designation = designation !== undefined ? designation : employee.designation;
    if (joiningDate) employee.joiningDate = joiningDate;
    employee.salary = salary !== undefined ? salary : employee.salary;
    employee.phone = phone !== undefined ? phone : employee.phone;
    employee.role = role || employee.role;

    if (password) {
      employee.password = password;
    }

    await employee.save();

    res.status(200).json({
      success: true,
      employee,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteEmployee = async (req, res, next) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (employee._id.toString() === req.user.id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own admin account' });
    }

    await employee.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Employee removed successfully',
    });
  } catch (error) {
    next(error);
  }
};
