const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/database');

// Load env vars
dotenv.config();

const app = express();

// CORS - FULL configuration for all origins and methods
app.use(cors({
    origin: true, // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Middleware - handle null body gracefully
app.use(express.json({ 
    limit: '100mb',
    strict: false // Allow null/primitives
}));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Handle null body from frontend
app.use((req, res, next) => {
    if (req.body === null) {
        req.body = {};
    }
    next();
});

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Static folder for uploaded files if needed
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api', require('./routes/api'));

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
});

const PORT = process.env.API_PORT || 8000;

// Start server only after DB connection
async function startServer() {
    try {
        await connectDB();
        console.log('Database connected successfully');
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`CORS enabled for all origins`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

startServer();
