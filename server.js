const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const { knex, setupDatabase } = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// .env file er bebohar bondho kora hoyeche
// require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
// ## CHURANTO CORS SHOMADHAN ##
const corsOptions = {
    origin: 'https://forsemail.42web.io',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Shob dhoroner method anumoti dewa holo
    allowedHeaders: ['Content-Type', 'Authorization'], // Authorization header anumoti dewa holo
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// Browser-er preflight request handle korar jonno
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Notun Debugging Logger
app.use((req, res, next) => {
    console.log(`--> Incoming Request: ${req.method} ${req.originalUrl}`);
    next();
});

// --- Secrets and Variables ---
const clientKey = process.env.API_CLIENT_KEY;
const apiHost = 'https://gapi.hotmail007.com';
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const RUPANTOR_PAY_API_KEY = process.env.RUPANTOR_PAY_API_KEY;
const APP_BASE_URL = process.env.APP_BASE_URL;

if (!clientKey || !JWT_SECRET || !ADMIN_SECRET_KEY || !RUPANTOR_PAY_API_KEY || !APP_BASE_URL) {
    console.error("\n❌ Critical Error: One or more required keys are missing from the Render Environment Variables.");
    process.exit(1);
}

let ourPriceList = {};
try {
    ourPriceList = JSON.parse(fs.readFileSync('./prices.json', 'utf8'));
} catch (error) {
    console.error('❌ Error: Could not read prices.json.');
    process.exit(1);
}

// --- Keep-alive Endpoint ---
app.get('/', (req, res) => {
    res.status(200).send('Server is alive and running perfectly!');
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT Verification Error:", err.message);
            return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
}

// --- API ROUTES (Simplified for stability) ---
app.get('/api/prices', (req, res) => res.json({ success: true, prices: ourPriceList }));
app.post('/api/register', async (req, res) => { /* ... Baki code oporibortito ... */ });
app.post('/api/login', async (req, res) => { /* ... Baki code oporibortito ... */ });
app.get('/api/stock', async (req, res) => { /* ... Baki code oporibortito ... */ });
app.post('/api/payment/auto/webhook', async (req, res) => { /* ... Baki code oporibortito ... */ });

// Authenticated user routes
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const user = await knex('users').where({ id: req.user.id }).first();
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        res.json({ success: true, username: user.username, balance: parseFloat(user.balance).toFixed(2) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Could not fetch user info.' });
    }
});
app.post('/api/mail', authenticateToken, async (req, res) => { /* ... Baki code oporibortito ... */ });
app.get('/api/purchase-history', authenticateToken, async (req, res) => { /* ... Baki code oporibortito ... */ });
app.get('/api/payment-methods', authenticateToken, async (req, res) => { /* ... Baki code oporibortito ... */ });
app.post('/api/deposit/request', authenticateToken, async (req, res) => { /* ... Baki code oporibortito ... */ });
app.post('/api/payment/auto/checkout', authenticateToken, async (req, res) => { /* ... Baki code oporibortito ... */ });

// Admin routes
app.post('/api/admin/payment-methods', async (req, res) => { /* ... Baki code oporibortito ... */ });
app.post('/api/admin/payment-methods/update', async (req, res) => { /* ... Baki code oporibortito ... */ });
app.post('/api/admin/deposits', async (req, res) => { /* ... Baki code oporibortito ... */ });
app.post('/api/admin/deposits/approve', async (req, res) => { /* ... Baki code oporibortito ... */ });
app.post('/api/admin/deposits/cancel', async (req, res) => { /* ... Baki code oporibortito ... */ });

app.listen(PORT, async () => {
    await setupDatabase();
    console.log(`\n✅✅✅ FINAL SERVER STARTED SUCCESSFULLY! Now listening for all requests...`);
});

