// routes/todayRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getToday } from '../controllers/todayController.js';

const router = express.Router();
router.get('/', protect, getToday);
export default router;