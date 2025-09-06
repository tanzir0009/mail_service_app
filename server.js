const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const fs = require('fs');
const { knex, setupDatabase } = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Secrets and Variables ---
const clientKey = process.env.API_CLIENT_KEY;
const apiHost = 'https://gapi.hotmail007.com';
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;

// Check if all required environment variables are loaded
if (!clientKey || !JWT_SECRET || !ADMIN_SECRET_KEY) {
    console.error("\n❌ Critical Error: One or more required keys are missing from the .env file.");
    console.error("Please check your .env file and ensure API_CLIENT_KEY, JWT_SECRET, and ADMIN_SECRET_KEY are set.");
    process.exit(1);
}

// Load price list from JSON file
let ourPriceList = {};
try {
    ourPriceList = JSON.parse(fs.readFileSync('./prices.json', 'utf8'));
} catch (error) {
    console.error('❌ Error: Could not read prices.json. Please ensure the file exists and is correctly formatted.');
    process.exit(1);
}

// --- Authentication Middleware ---
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

// --- Standard API Endpoints ---
app.get('/api/prices', (req, res) => res.json({ success: true, prices: ourPriceList }));

app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: "Username and password are required." });
        const hashedPassword = await bcrypt.hash(password, 10);
        await knex('users').insert({ username, password: hashedPassword, balance: 0.00 });
        res.status(201).json({ success: true, message: "Registration successful!" });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ success: false, message: "This username is already taken." });
        res.status(500).json({ success: false, message: "Server error during registration." });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await knex('users').where({ username }).first();
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ success: false, message: "Invalid username or password." });
        const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ success: true, accessToken });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const user = await knex('users').where({ id: req.user.id }).first();
        res.json({ success: true, username: user.username, balance: parseFloat(user.balance).toFixed(2) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Could not fetch user info.' });
    }
});

app.get('/api/stock', async (req, res) => {
    try {
        const { mailType } = req.query;
        if (!mailType) return res.status(400).json({ success: false, message: 'Mail type is required.' });
        const url = `${apiHost}/api/mail/getStock?mailType=${encodeURIComponent(mailType)}`;
        const response = await axios.get(url);
        res.json({ success: true, stock: response.data.data || 0 });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Could not check stock.' });
    }
});

app.post('/api/mail', authenticateToken, async (req, res) => {
    const { mailType, quantity } = req.body;
    const pricePerMail = ourPriceList[mailType];
    if (!pricePerMail) return res.status(400).json({ success: false, message: 'This mail type is not available.' });
    const totalCost = pricePerMail * parseInt(quantity, 10);
    try {
        const user = await knex('users').where({ id: req.user.id }).first();
        if (parseFloat(user.balance) < totalCost) return res.status(400).json({ success: false, message: `Insufficient balance.` });

        const externalApiUrl = `${apiHost}/api/mail/getMail?clientKey=${clientKey}&mailType=${encodeURIComponent(mailType)}&quantity=${quantity}`;
        const externalResponse = await axios.get(externalApiUrl);

        if (externalResponse.data && externalResponse.data.code === 0 && externalResponse.data.data) {
            const purchasedEmails = externalResponse.data.data;
            const formattedEmails = purchasedEmails.map(e => e.replaceAll(':', '|'));
            const newBalance = parseFloat(user.balance) - totalCost;
            await knex('users').where({ id: req.user.id }).update({ balance: newBalance });
            await knex('orders').insert({ user_id: req.user.id, mailType, quantity, totalCost, purchasedEmails: JSON.stringify(formattedEmails) });
            res.json({ success: true, message: 'Email purchased successfully!', newBalance: newBalance.toFixed(2), emails: formattedEmails });
        } else {
            throw new Error(externalResponse.data.msg || 'Failed to get email from the API.');
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// --- Manual Deposit API Endpoints ---
app.get('/api/payment-methods', authenticateToken, async (req, res) => {
    try {
        const info = await knex('settings').where({ key: 'payment_methods' }).first();
        if (!info) return res.status(404).json({ success: false, message: 'No payment methods set by admin.' });
        res.json({ success: true, data: JSON.parse(info.value) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'পেমেন্ট তথ্য আনতে সমস্যা হয়েছে।' });
    }
});

app.post('/api/deposit/request', authenticateToken, async (req, res) => {
    const { amount, trxId } = req.body;
    const { id: userId, username } = req.user;
    if (!amount || parseFloat(amount) < 50 || !trxId) {
        return res.status(400).json({ success: false, message: 'সঠিক পরিমাণ (ন্যূনতম ৳৫০) এবং ট্রানজ্যাকশন আইডি দিন।' });
    }
    try {
        await knex('deposits').insert({ user_id: userId, username, amount: parseFloat(amount), trx_id: trxId, status: 'pending' });
        res.status(201).json({ success: true, message: 'আপনার ডিপোজিটের অনুরোধটি গ্রহণ করা হয়েছে।' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'সার্ভারে সমস্যা হয়েছে, অনুরোধ জমা দেওয়া যায়নি।' });
    }
});


// --- Admin API Endpoints ---
app.post('/api/admin/payment-methods', async (req, res) => {
    const { adminKey } = req.body;
    if (adminKey !== ADMIN_SECRET_KEY) return res.status(403).json({ success: false, message: 'Invalid Admin Key.' });
    try {
        const info = await knex('settings').where({ key: 'payment_methods' }).first();
        if (!info || !info.value) {
            return res.status(404).json({ success: false, message: 'Payment methods not found in database.' });
        }
        res.json({ success: true, data: JSON.parse(info.value) });
    } catch (error) {
        console.error("❌ Error fetching settings:", error);
        res.status(500).json({ success: false, message: 'সেটিংস আনতে সমস্যা হয়েছে। সম্ভবত ডেটাবেস ডেটা ফরম্যাট ভুল।' });
    }
});

app.post('/api/admin/payment-methods/update', async (req, res) => {
    const { adminKey, methods } = req.body;
    if (adminKey !== ADMIN_SECRET_KEY) return res.status(403).json({ success: false, message: 'Invalid Admin Key.' });
    if (!Array.isArray(methods)) return res.status(400).json({ success: false, message: 'Invalid data format.' });
    try {
        await knex('settings').where({ key: 'payment_methods' }).update({ value: JSON.stringify(methods) });
        res.json({ success: true, message: 'পেমেন্ট তথ্য সফলভাবে আপডেট করা হয়েছে।' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'আপডেট করতে সমস্যা হয়েছে।' });
    }
});

app.post('/api/admin/deposits', async (req, res) => {
    const { adminKey } = req.body;
    if (adminKey !== ADMIN_SECRET_KEY) return res.status(403).json({ success: false, message: 'Invalid Admin Key.' });
    try {
        const pendingDeposits = await knex('deposits').where({ status: 'pending' }).orderBy('created_at', 'desc');
        res.json({ success: true, deposits: pendingDeposits });
    } catch (error) {
        res.status(500).json({ success: false, message: 'ডিপোজিট অনুরোধগুলো আনতে সমস্যা হয়েছে।' });
    }
});

app.post('/api/admin/deposits/approve', async (req, res) => {
    const { adminKey, depositId } = req.body;
    if (adminKey !== ADMIN_SECRET_KEY) return res.status(403).json({ success: false, message: 'Invalid Admin Key.' });
    try {
        const deposit = await knex('deposits').where({ id: depositId, status: 'pending' }).first();
        if (!deposit) return res.status(404).json({ success: false, message: 'এই পেন্ডিং অনুরোধটি খুঁজে পাওয়া যায়নি।' });
        await knex.transaction(async (trx) => {
            await trx('users').where({ id: deposit.user_id }).increment('balance', deposit.amount);
            await trx('deposits').where({ id: depositId }).update({ status: 'approved' });
        });
        res.json({ success: true, message: `অনুরোধ #${depositId} সফলভাবে অনুমোদন করা হয়েছে।` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'অনুরোধটি অনুমোদন করতে সমস্যা হয়েছে।' });
    }
});

// --- Start Server ---
app.listen(PORT, async () => {
    await setupDatabase();
    console.log(`\n✅ চূড়ান্ত সার্ভার সফলভাবে চালু হয়েছে এবং http://localhost:${PORT} -এ চলছে`);
});