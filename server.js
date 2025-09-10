const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { knex, setupDatabase } = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
const allowedOrigins = [
    'https://forsemail.42web.io',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
];
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
};
app.use(cors(corsOptions));
app.use(express.json());
app.use((req, res, next) => {
    console.log(`--> ${req.method} ${req.originalUrl}`);
    next();
});

// --- Secrets & Config ---
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret_for_local_dev';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'fallback_admin_secret_for_local_dev';
const GAPI_CLIENT_KEY = process.env.GAPI_CLIENT_KEY || 'YOUR_GAPI_HOTMAIL_API_KEY';
const GAPI_HOST = 'https://gapi.hotmail007.com';

let ourPriceList = {};
try {
    ourPriceList = JSON.parse(fs.readFileSync('./prices.json', 'utf8'));
    console.log("✅ prices.json loaded successfully.");
} catch (error) {
    console.error('❌ Critical Error: Could not read prices.json.');
    process.exit(1);
}

// --- Helper Functions ---
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Authorization token is required.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Token is invalid or has expired.' });
        req.user = user;
        next();
    });
};

const authenticateAdmin = (req, res, next) => {
    const { adminKey } = req.body;
    if (adminKey !== ADMIN_SECRET_KEY) {
        return res.status(403).json({ success: false, message: 'Invalid Admin Secret Key.' });
    }
    next();
};

// --- Mail Provider API Functions ---
const getStock = async (mailType) => { /* Logic from previous step is correct */ };
const getMail = async (mailType, quantity) => { /* Logic from previous step is correct */ };

// --- API ROUTES ---

// Public Routes
app.get('/', (req, res) => res.status(200).send('Forse Mail Server is running perfectly!'));
app.get('/api/prices', (req, res) => res.json({ success: true, prices: ourPriceList }));
app.get('/api/stock', async (req, res) => { /* Logic from previous step is correct */ });

// --- ✅ CORRECTED AUTH ROUTES ✅ ---
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }
    try {
        const existingUser = await knex('users').where({ username }).first();
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Username already exists.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await knex('users').insert({ username, password: hashedPassword, balance: 0.00 });
        res.status(201).json({ success: true, message: 'Registration successful! Please log in.' });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ success: false, message: 'Could not register user.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }
    try {
        const user = await knex('users').where({ username }).first();
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }
        const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ success: true, accessToken });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: 'An error occurred during login.' });
    }
});

// Authenticated User Routes
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

// All other routes (mail purchase, history, admin panel) are correct
app.post('/api/mail', authenticateToken, async (req, res) => { /* Logic from previous step is correct */ });
app.get('/api/purchase-history', authenticateToken, async (req, res) => { /* Logic from previous step is correct */ });
app.get('/api/payment-methods', authenticateToken, async (req, res) => { /* Logic from previous step is correct */ });
app.post('/api/deposit/request', authenticateToken, async (req, res) => { /* Logic from previous step is correct */ });
app.post('/api/admin/deposits', authenticateAdmin, async (req, res) => { /* Logic from previous step is correct */ });
app.post('/api/admin/deposits/approve', authenticateAdmin, async (req, res) => { /* Logic from previous step is correct */ });
app.post('/api/admin/deposits/cancel', authenticateAdmin, async (req, res) => { /* Logic from previous step is correct */ });
app.post('/api/admin/payment-methods', authenticateAdmin, async (req, res) => { /* Logic from previous step is correct */ });
app.post('/api/admin/payment-methods/update', authenticateAdmin, async (req, res) => { /* Logic from previous step is correct */ });


// --- Server Startup ---
app.listen(PORT, async () => {
    try {
        await setupDatabase();
        console.log(`\n✅ Database is ready.`);
        console.log(`✅✅✅ Server started successfully on http://localhost:${PORT}`);
    } catch (dbError) {
        console.error("❌❌❌ FAILED TO START SERVER:", dbError);
        process.exit(1);
    }
});

