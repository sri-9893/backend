import express from 'express';
import {
  punchIn,
  punchOut,
  editAttendanceRequest,
  getMyAttendance,
  getPendingCorrections,
  approveAttendanceEdit,
  rejectAttendanceEdit,
  getAllAttendance,
  getTodayStatus,
} from '../controllers/attendanceController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Core punch APIs
router.post('/punch-in', punchIn);
router.post('/punch-out', punchOut);

// Employee edits attendance within 7 days
router.put('/edit/:id', editAttendanceRequest);

// Employee views
router.get('/my', getMyAttendance);

// Admin approvals
router.get('/pending', authorize('Admin'), getPendingCorrections);
router.put('/approve/:id', authorize('Admin'), approveAttendanceEdit);
router.put('/reject/:id', authorize('Admin'), rejectAttendanceEdit);

// Existing endpoints used by current UI (kept for now)
router.get('/today', getTodayStatus);
router.get('/all', authorize('Admin'), getAllAttendance);

export default router;

