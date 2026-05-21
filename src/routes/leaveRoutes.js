import express from 'express';
import {
  applyLeave,
  getMyLeaves,
  getAllLeaves,
  updateLeaveStatus,
} from '../controllers/leaveController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .post(applyLeave)
  .get(getMyLeaves);

router.get('/all', authorize('Admin'), getAllLeaves);
router.put('/:id/status', authorize('Admin'), updateLeaveStatus);

export default router;
