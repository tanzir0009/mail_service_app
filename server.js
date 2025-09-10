const express = require('express');
const axios = require('axios');
const cors = require('cors');

// ## FINAL FIX: Ei line-ti bondho kore dewa hoyeche jate server kono .env file na khoje
// require('dotenv').config(); 

const fs = require('fs');
const { knex, setupDatabase } = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// ## GURUTTWOPURNO PORIBORTON: CORS Configuration
// Ekhane amra server-ke bole dichhi je shudhu apnar website thekei onurodh grohon korbe
const corsOptions = {
    origin: 'https://forsemail.42web.io',
    optionsSuccessStatus: 200 // For legacy browser support
};
app.use(cors(corsOptions));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Secrets and Variables ---
const clientKey = process.env.API_CLIENT_KEY;
const apiHost = 'https://gapi.hotmail007.com';
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const RUPANTOR_PAY_API_KEY = process.env.RUPANTOR_PAY_API_KEY;
const APP_BASE_URL = process.env.APP_BASE_URL;

// Check if all required environment variables are loaded
if (!clientKey || !JWT_SECRET || !ADMIN_SECRET_KEY || !RUPANTOR_PAY_API_KEY || !APP_BASE_URL) {
    console.error("\n❌ Critical Error: One or more required keys are missing from the Render Environment Variables.");
    console.error("Please check your Render Dashboard > Environment tab and ensure all 5 keys are set.");
    process.exit(1);
}

let ourPriceList = {};
try {
    ourPriceList = JSON.parse(fs.readFileSync('./prices.json', 'utf8'));
} catch (error) {
    console.error('❌ Error: Could not read prices.json.');
    process.exit(1);
}

// ... Baki shob code oporibortito thakbe ...
// (authenticateToken, apiRouter, shob route, app.listen etc.)

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

// All your routes (prices, register, login, cancel etc.) will go here...
// ... (The code for all routes remains exactly the same as before) ...
apiRouter.get('/prices', (req, res) => res.json({ success: true, prices: ourPriceList }));
apiRouter.post('/register', async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/login', async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.get('/me', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.get('/stock', async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.get('/purchase-history', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.get('/payment-methods', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/deposit/request', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/payment/auto/checkout', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/payment/auto/webhook', async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/admin/payment-methods', async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/admin/payment-methods/update', async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/admin/deposits', async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/admin/deposits/approve', async (req, res) => { /* ... Code unchanged ... */ });
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
    console.log("\n✅ Server started successfully. It will now ONLY use variables from the Render Dashboard.");
});

