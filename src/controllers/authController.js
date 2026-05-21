import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_hrms_token_key_12345', {
    expiresIn: '30d',
  });
};

export const register = async (req, res, next) => {
  try {
    const { employeeId, name, email, password, department, designation, joiningDate, salary, phone, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const idExists = await User.findOne({ employeeId });
    if (idExists) {
      return res.status(400).json({ success: false, message: 'Employee ID already exists' });
    }

    const userCount = await User.countDocuments({});
    
    let userRole = role || 'Employee';
    if (userCount === 0) {
      userRole = 'Admin';
    } else {
      if (!req.user || req.user.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Only Admins can register new employees' });
      }
    }

    const user = await User.create({
      employeeId,
      name,
      email,
      password,
      department,
      designation,
      joiningDate,
      salary,
      phone,
      role: userRole,
    });

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user: {
        _id: user._id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: {
        _id: user._id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};
