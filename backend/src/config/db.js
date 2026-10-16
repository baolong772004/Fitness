import prisma from './prisma.js';

const connectDB = async () => {
    try {
        await prisma.$connect();
        // $connect() initializes Prisma's engine; a query verifies SQL Server access.
        await prisma.$queryRaw`SELECT 1 AS ready`;
        console.log('Database connected successfully via Prisma');
    } catch (error) {
        console.error('Database connection failed:', error.message);
        throw error;
    }
};

export default connectDB;
