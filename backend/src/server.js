import dotenv from 'dotenv';
import { exec } from 'child_process';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import rootRouter from './routes/index.js';
import errorHandler from './middlewares/errorHandler.js';
import connectDB from './config/db.js';
import swaggerSpec from './config/swagger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Global Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Fitness Server is running!' });
});

// Main Routes
app.use('/api', rootRouter);

// Swagger Docs Route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Handle 404
app.use((req, res, next) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
        exec(`start http://localhost:${PORT}/api-docs`);
    }
});