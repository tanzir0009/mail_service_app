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
const allowedOrigins = [
    'https://forsemail.42web.io',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
];

const corsOptions = {
    origin: function (origin, callback) {
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

app.use((req, res, next) => {
    console.log(`--> ${req.method} ${req.originalUrl} from Origin: ${req.headers.origin}`);
    next();
});

// --- Secrets and Variables ---
const clientKey = process.env.API_CLIENT_KEY || 'your_client_key'; // Fallback for local dev
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key'; // Fallback for local dev
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'your_admin_secret'; // Fallback for local dev
const RUPANTOR_PAY_API_KEY = process.env.RUPANTOR_PAY_API_KEY || 'your_rupantor_key'; // Fallback
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`; // Fallback

if (!process.env.API_CLIENT_KEY || !process.env.JWT_SECRET || !process.env.ADMIN_SECRET_KEY) {
    console.warn("\n⚠️ Warning: One or more secret keys are not set in environment variables. Using fallback keys for local development.");
}

let ourPriceList = {};
try {
    ourPriceList = JSON.parse(fs.readFileSync('./prices.json', 'utf8'));
    console.log("✅ Successfully loaded prices.json");
} catch (error) {
    console.error('❌ Error: Could not read prices.json.');
    process.exit(1);
}

// --- Helper Functions ---
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

// --- API ROUTES ---

// Public routes
app.get('/', (req, res) => res.status(200).send('Server is alive and running perfectly!'));
app.get('/api/prices', (req, res) => res.json({ success: true, prices: ourPriceList }));

// ** ✅ LOGIN AND REGISTER LOGIC ADDED HERE ✅ **

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
        await knex('users').insert({
            username,
            password: hashedPassword,
            balance: 0.00
        });

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
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ success: true, accessToken });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: 'An error occurred during login.' });
    }
});

app.get('/api/stock', async (req, res) => { 
    // This is just a placeholder, you need to add your logic to check stock from your source
    const { mailType } = req.query;
    if (!mailType) {
        return res.status(400).json({ success: false, message: "mailType is required."});
    }
    // Simulate stock
    const stock = Math.floor(Math.random() * 100);
    res.json({ success: true, stock });
});

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

// Other routes (add your logic here)
app.post('/api/mail', authenticateToken, async (req, res) => { res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.get('/api/purchase-history', authenticateToken, async (req, res) => { res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.get('/api/payment-methods', authenticateToken, async (req, res) => { res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.post('/api/deposit/request', authenticateToken, async (req, res) => { res.status(501).json({success: false, message: "Not Implemented Yet"}); });
app.post('/api/payment/auto/checkout', authenticateToken, async (req, res) => { res.status(501).json({success: false, message: "Not Implemented Yet"}); });

// --- Server Startup ---
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

