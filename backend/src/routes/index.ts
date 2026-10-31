import express from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.route.js';
import packageRoutes from './package.route.js';
import subscriptionRoutes from './subscription.route.js';
import paymentRoutes from './payment.route.js';
import checkinRoutes from './checkin.route.js';
import ptRoutes from './pt.route.js';
import groupClassRoutes from './groupClass.route.js';
import memberRoutes from './member.route.js';
import adminRoutes from './admin.route.js';
import adminTrainerRoutes from './adminTrainer.route.js';
import workoutLogRoutes from './workoutLog.route.js';
import reviewRoutes from './review.route.js';
import supportRoutes from './support.route.js';
import facilityRoutes from './facility.route.js';
import notificationRoutes from './notification.route.js';
import staffRoutes from './staff.route.js';
import exerciseAnalysisRoutes from './exerciseAnalysis.route.js';
import coachExerciseAnalysisRoutes from './coachExerciseAnalysis.route.js';

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
router.use('/group-classes', groupClassRoutes);
router.use('/member', memberRoutes);
router.use('/admin', adminRoutes);
router.use('/admin-trainers', adminTrainerRoutes);
router.use('/workouts', workoutLogRoutes);
router.use('/reviews', reviewRoutes);
router.use('/support', supportRoutes);
router.use('/facility', facilityRoutes);
router.use('/notifications', notificationRoutes);
router.use('/staff', staffRoutes);
router.use('/exercise-analysis', exerciseAnalysisRoutes);
router.use('/coach/shared-exercise-analyses', coachExerciseAnalysisRoutes);

export default router;

