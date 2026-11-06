import { Router } from 'express';
import { chatWithBusinessAssistant } from '../controllers/aiAssistant.controller.js';

const router = Router();

router.post('/chat', chatWithBusinessAssistant);

export default router;
