import express from 'express';
import { downloadPayslipPDFFile } from '../controllers/payrollController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/:id/download', downloadPayslipPDFFile);

export default router;
