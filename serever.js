const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const fs = require('fs');
const { knex, setupDatabase } = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Secrets and Variables ---
const clientKey = process.env.API_CLIENT_KEY;
const apiHost = 'https://gapi.hotmail007.com';
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const RUPANTOR_PAY_API_KEY = process.env.RUPANTOR_PAY_API_KEY;
const APP_BASE_URL = process.env.APP_BASE_URL;

if (!clientKey || !JWT_SECRET || !ADMIN_SECRET_KEY || !RUPANTOR_PAY_API_KEY || !APP_BASE_URL) {
    console.error("\n❌ Critical Error: One or more required keys are missing from the .env file.");
    process.exit(1);
}

let ourPriceList = {};
try {
    ourPriceList = JSON.parse(fs.readFileSync('./prices.json', 'utf8'));
} catch (error) {
    console.error('❌ Error: Could not read prices.json.');
    process.exit(1);
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

const apiRouter = express.Router();

// --- Standard API Endpoints ---
apiRouter.get('/prices', (req, res) => res.json({ success: true, prices: ourPriceList }));
apiRouter.post('/register', async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/login', async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.get('/me', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.get('/stock', async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/mail', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.get('/purchase-history', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.get('/payment-methods', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/deposit/request', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/payment/auto/checkout', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/payment/auto/webhook', async (req, res) => { /* ... Code unchanged ... */ });

// --- Admin Endpoints ---
apiRouter.post('/admin/payment-methods', async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/admin/payment-methods/update', async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/admin/deposits', async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/admin/deposits/approve', async (req, res) => { /* ... Code unchanged ... */ });

// ## Cancel Deposit Endpoint (এই রুটটি সার্ভারে থাকা আবশ্যক)
apiRouter.post('/admin/deposits/cancel', async (req, res) => {
    const { adminKey, depositId } = req.body;
    if (adminKey !== ADMIN_SECRET_KEY) return res.status(403).json({ success: false, message: 'Invalid Admin Key.' });
    if (!depositId) return res.status(400).json({ success: false, message: 'Deposit ID is required.' });
    
    try {
        const deposit = await knex('deposits').where({ id: depositId, status: 'pending' }).first();
        if (!deposit) return res.status(404).json({ success: false, message: 'This pending request was not found.' });
        
        await knex('deposits').where({ id: depositId }).update({ status: 'cancelled' });
        res.json({ success: true, message: `Request #${depositId} has been successfully cancelled.` });
    } catch (error) {
        console.error("Error cancelling deposit:", error);
        res.status(500).json({ success: false, message: 'The request could not be cancelled due to a server error.' });
    }
});

app.use('/api', apiRouter);

app.listen(PORT, async () => {
    await setupDatabase();
    console.log(`\n✅ Final server is running successfully on http://localhost:${PORT}`);
});

