const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { knex, setupDatabase } = require('./database'); // database.js thakte hobe
const bcrypt = require('bcryptjs');
const jwt =require('jsonwebtoken');

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
app.use((req, res, next) => {
    console.log(`--> ${req.method} ${req.originalUrl}`);
    next();
});

// --- Secrets ---
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'your_admin_secret';

let ourPriceList = {};
try {
    ourPriceList = JSON.parse(fs.readFileSync('./prices.json', 'utf8'));
    console.log("✅ prices.json loaded.");
} catch (error) {
    console.error('❌ Error reading prices.json.');
    process.exit(1);
}

// --- Helper Functions ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ success: false, message: 'Authorization token is missing.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
}

// --- API ROUTES ---

// Public Routes
app.get('/', (req, res) => res.status(200).send('Server is alive!'));
app.get('/api/prices', (req, res) => res.json({ success: true, prices: ourPriceList }));

// Auth Routes
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password required.' });
    try {
        const existingUser = await knex('users').where({ username }).first();
        if (existingUser) return res.status(409).json({ success: false, message: 'Username already exists.' });
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
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password required.' });
    try {
        const user = await knex('users').where({ username }).first();
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }
        const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ success: true, accessToken });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: 'An error occurred.' });
    }
});

// Authenticated User Routes
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const user = await knex('users').where({ id: req.user.id }).first();
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        res.json({ success: true, username: user.username, balance: parseFloat(user.balance).toFixed(2) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Could not fetch user info.' });
    }
});

// --- ✅ HISTORY FEATURE LOGIC ADDED HERE ✅ ---
app.get('/api/purchase-history', authenticateToken, async (req, res) => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const history = await knex('purchases')
            .where({ user_id: req.user.id })
            .andWhere('created_at', '>=', twentyFourHoursAgo)
            .orderBy('created_at', 'desc');

        // purchased_emails is stored as JSON string, so we need to parse it
        const formattedHistory = history.map(item => ({
            ...item,
            purchasedEmails: JSON.parse(item.purchased_emails)
        }));

        res.json({ success: true, history: formattedHistory });
    } catch (error) {
        console.error("Purchase History Error:", error);
        res.status(500).json({ success: false, message: 'Could not fetch purchase history.' });
    }
});


// --- ✅ ADD FUND FEATURE LOGIC ADDED HERE ✅ ---
app.get('/api/payment-methods', authenticateToken, async (req, res) => {
    try {
        const methods = await knex('payment_methods').select('method', 'number').where({ is_active: true });
        res.json({ success: true, data: methods });
    } catch (error) {
        console.error("Payment Methods Error:", error);
        res.status(500).json({ success: false, message: "Could not fetch payment methods." });
    }
});

app.post('/api/deposit/request', authenticateToken, async (req, res) => {
    const { amount, trxId } = req.body;
    if (!amount || !trxId) {
        return res.status(400).json({ success: false, message: "Amount and TrxID are required." });
    }
     if (parseFloat(amount) < 50) {
        return res.status(400).json({ success: false, message: "Minimum deposit is 50 Taka." });
    }
    try {
        await knex('deposits').insert({
            user_id: req.user.id,
            username: req.user.username,
            amount: parseFloat(amount),
            trx_id: trxId,
            status: 'pending'
        });
        res.json({ success: true, message: 'Deposit request submitted successfully. Please wait for admin approval.' });
    } catch (error) {
        console.error("Deposit Request Error:", error);
        res.status(500).json({ success: false, message: "Could not submit your request." });
    }
});

// --- Other Features (Not yet implemented, but won't give 501 error) ---
app.get('/api/stock', async (req, res) => {
    res.json({ success: true, stock: 100 + Math.floor(Math.random() * 50) });
});

app.post('/api/mail', authenticateToken, async (req, res) => {
    res.status(400).json({ success: false, message: "Purchase logic not yet fully implemented." });
});

app.post('/api/payment/auto/checkout', authenticateToken, async (req, res) => {
    res.status(400).json({ success: false, message: "Automatic payment is not yet configured." });
});

// --- ADMIN ROUTES (You will need to implement logic here later) ---
app.post('/api/admin/payment-methods', async (req, res) => { /* Add logic */ res.json({success: true, data: []})});
app.post('/api/admin/deposits', async (req, res) => { /* Add logic */ res.json({success: true, deposits: []})});


// --- Server Startup ---
app.listen(PORT, async () => {
    try {
        await setupDatabase();
        console.log(`\n✅ Database setup complete.`);
        console.log(`✅✅✅ SERVER STARTED on port ${PORT}!`);
    } catch (dbError) {
        console.error("❌ FAILED TO START SERVER:", dbError);
        process.exit(1);
    }
});

