import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { createServer } from 'node:http';

import rootRouter from './routes/index.js';
import errorHandler from './middlewares/errorHandler.js';
import connectDB from './config/db.js';
import swaggerSpec from './config/swagger.js';
import { configurePtChatSocket } from './sockets/ptChat.socket.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
configurePtChatSocket(httpServer);
const PORT = process.env.PORT || 5000;

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

const startServer = async () => {
    await connectDB();

    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`API docs: http://localhost:${PORT}/api-docs`);
    });
};

startServer().catch((error) => {
    console.error('Backend startup failed:', error.message);
    process.exitCode = 1;
});
