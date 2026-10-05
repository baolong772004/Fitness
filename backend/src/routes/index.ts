import express from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.route.js';
import packageRoutes from './package.route.js';
import subscriptionRoutes from './subscription.route.js';
import paymentRoutes from './payment.route.js';
import checkinRoutes from './checkin.route.js';
import ptRoutes from './pt.route.js';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'Welcome to Fitness API' });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/packages', packageRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/payments', paymentRoutes);
router.use('/checkin', checkinRoutes);
router.use('/pt', ptRoutes);

export default router;
