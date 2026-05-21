import express from 'express';
import {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from '../controllers/holidayController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(getHolidays)
  .post(authorize('Admin'), createHoliday);

router
  .route('/:id')
  .put(authorize('Admin'), updateHoliday)
  .delete(authorize('Admin'), deleteHoliday);

export default router;
