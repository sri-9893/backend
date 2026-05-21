import express from 'express';
import {
  getPayrollPreview,
  generatePayroll,
  getPayrollHistory,
} from '../controllers/payrollController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/preview', authorize('Admin'), getPayrollPreview);
router.post('/generate', authorize('Admin'), generatePayroll);
router.get('/history', getPayrollHistory);

export default router;
