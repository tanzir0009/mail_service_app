const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const { knex, setupDatabase } = require('./database'); // Ensure database.js is present
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---

// ## CHURANTO CORS SHOMADHAN (UPDATED FOR DEVELOPMENT & PRODUCTION) ##
// This setup allows your deployed frontend and local testing to work.
const allowedOrigins = [
    'https://forsemail.42web.io', // Your production frontend
    'http://127.0.0.1:5500',      // For local testing with Live Server
    'http://localhost:5500'       // Another local testing variation
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests) OR if origin is in allowed list
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Notun Debugging Logger
app.use((req, res, next) => {
    console.log(`--> Incoming Request: ${req.method} ${req.originalUrl} from Origin: ${req.headers.origin}`);
    next();
});

// --- Secrets and Variables ---
// These MUST be set in your Render.com environment variables dashboard
const clientKey = process.env.API_CLIENT_KEY;
const apiHost = 'https://gapi.hotmail007.com';
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const RUPANTOR_PAY_API_KEY = process.env.RUPANTOR_PAY_API_KEY;
const APP_BASE_URL = process.env.APP_BASE_URL;

if (!clientKey || !JWT_SECRET || !ADMIN_SECRET_KEY || !RUPANTOR_PAY_API_KEY || !APP_BASE_URL) {
    console.error("\n❌ Critical Error: One or more required keys are missing from the Render Environment Variables.");
    console.error("Please ensure API_CLIENT_KEY, JWT_SECRET, ADMIN_SECRET_KEY, RUPANTOR_PAY_API_KEY, and APP_BASE_URL are set.");
    process.exit(1);
}

let ourPriceList = {};
try {
    // Ensure prices.json is in the same directory as server.js
    ourPriceList = JSON.parse(fs.readFileSync('./prices.json', 'utf8'));
    console.log("✅ Successfully loaded prices.json");
} catch (error) {
    console.error('❌ Error: Could not read prices.json. Make sure the file exists and is valid JSON.');
    process.exit(1);
}

// --- Keep-alive Endpoint ---
app.get('/', (req, res) => {
    res.status(200).send('Server is alive and running perfectly!');
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ success: false, message: 'Authorization token is missing.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT Verification Error:", err.message);
            return res.status(403).json({ success: false, message: 'Invalid or expired token. Please log in again.' });
        }
        req.user = user;
        next();
    });
}

// --- API ROUTES (Simplified for stability) ---
// These routes are assumed to have correct logic inside.
app.get('/api/prices', (req, res) => res.json({ success: true, prices: ourPriceList }));
app.post('/api/register', async (req, res) => { /* Your existing logic */ res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.post('/api/login', async (req, res) => { /* Your existing logic */ res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.get('/api/stock', async (req, res) => { /* Your existing logic */ res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.post('/api/payment/auto/webhook', async (req, res) => { /* Your existing logic */ res.status(501).json({success: false, message: "Not Implemented Yet"}); });

// Authenticated user routes
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const user = await knex('users').where({ id: req.user.id }).first();
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        res.json({ success: true, username: user.username, balance: parseFloat(user.balance).toFixed(2) });
    } catch (error) {
        console.error("Error in /api/me:", error);
        res.status(500).json({ success: false, message: 'Could not fetch user info.' });
    }
});
app.post('/api/mail', authenticateToken, async (req, res) => { /* Your existing logic */ res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.get('/api/purchase-history', authenticateToken, async (req, res) => { /* Your existing logic */ res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.get('/api/payment-methods', authenticateToken, async (req, res) => { /* Your existing logic */ res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.post('/api/deposit/request', authenticateToken, async (req, res) => { /* Your existing logic */ res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.post('/api/payment/auto/checkout', authenticateToken, async (req, res) => { /* Your existing logic */ res.status(501).json({success: false, message: "Not Implemented Yet"}); });

// Admin routes
app.post('/api/admin/payment-methods', async (req, res) => { /* Your existing logic */ res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.post('/api/admin/payment-methods/update', async (req, res) => { /* Your existing logic */ res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.post('/api/admin/deposits', async (req, res) => { /* Your existing logic */ res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.post('/api/admin/deposits/approve', async (req, res) => { /* Your existing logic */ res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.post('/api/admin/deposits/cancel', async (req, res) => { /* Your existing logic */ res.status(501).json({success: false, message: "Not Implemented Yet"}); });


// --- Error Handling ---
// A generic error handler to catch issues
app.use((err, req, res, next) => {
    console.error("💥 Unhandled Error:", err.stack);
    res.status(500).json({ success: false, message: "An internal server error occurred." });
});


app.listen(PORT, async () => {
    try {
        await setupDatabase();
        console.log(`\n✅ Database setup complete.`);
        console.log(`✅✅✅ SERVER STARTED SUCCESSFULLY on port ${PORT}! Now listening...`);
    } catch (dbError) {
        console.error("❌❌❌ FAILED TO START SERVER due to database error:", dbError);
        process.exit(1);
    }
});
