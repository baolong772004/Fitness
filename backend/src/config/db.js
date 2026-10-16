import prisma from './prisma.js';

const connectDB = async () => {
    try {
        await prisma.$connect();
        console.log('Database connected successfully via Prisma');
    } catch (error) {
        console.error('Database connection failed:', error.message);
        throw error;
    }
};

export default connectDB;
