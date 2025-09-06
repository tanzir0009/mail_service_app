const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config(); 
const fs = require('fs');
const path = require('path'); // <<< নতুন: path মডিউল যোগ করা হয়েছে
const { knex, setupDatabase } = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- Express App Setup ---
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

// --- Secrets and Variables ---
const clientKey = process.env.API_CLIENT_KEY;
const apiHost = 'https://gapi.hotmail007.com';
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;

// --- Key Loading Check ---
if (!clientKey || !JWT_SECRET || !ADMIN_SECRET_KEY) {
    console.error("\n❌ .env ফাইল থেকে এক বা একাধিক প্রয়োজনীয় কী লোড করা যায়নি।");
    process.exit(1);
}

// --- Load Price List (সবচেয়ে নিরাপদ সংস্করণ) ---
let ourPriceList = {};
try {
    // <<< নতুন কোড: ফাইলটি সঠিক ফোল্ডারে আছে কিনা তা নিশ্চিত করা হচ্ছে
    const pricesFilePath = path.join(__dirname, 'prices.json');
    console.log(`⏳ দামের তালিকা খোঁজা হচ্ছে এখানে: ${pricesFilePath}`);
    
    if (fs.existsSync(pricesFilePath)) {
        const priceData = fs.readFileSync(pricesFilePath, 'utf8');
        ourPriceList = JSON.parse(priceData);
        console.log('✅ prices.json ফাইল থেকে সফলভাবে দাম লোড হয়েছে।');
    } else {
        throw new Error('prices.json ফাইলটি api-backend ফোল্ডারের ভেতরে খুঁজে পাওয়া যায়নি।');
    }
} catch (error) {
    console.error(`❌ prices.json ফাইলটি লোড করার সময় একটি গুরুতর সমস্যা হয়েছে:`);
    console.error(error.message);
    process.exit(1);
}

// --- Middleware & API Endpoints (অপরিবর্তিত) ---
function authenticateToken(req, res, next) { const authHeader = req.headers['authorization']; const token = authHeader && authHeader.split(' ')[1]; if (token == null) return res.sendStatus(401); jwt.verify(token, JWT_SECRET, (err, user) => { if (err) return res.sendStatus(403); req.user = user; next(); }); }
app.get('/api/prices', (req, res) => res.json({ success: true, prices: ourPriceList }));
app.post('/api/register', async (req, res) => { try { const { username, password } = req.body; if (!username || !password) return res.status(400).json({ success: false, message: "Username and password required." }); const hashedPassword = await bcrypt.hash(password, 10); await knex('users').insert({ username, password: hashedPassword, balance: 0.00 }); res.status(201).json({ success: true, message: "Registration successful!" }); } catch (error) { if (error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ success: false, message: "Username already taken." }); res.status(500).json({ success: false, message: "Server error." }); } });
app.post('/api/login', async (req, res) => { try { const { username, password } = req.body; const user = await knex('users').where({ username }).first(); if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ success: false, message: "Invalid credentials." }); const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' }); res.json({ success: true, accessToken }); } catch (error) { res.status(500).json({ success: false, message: 'Server error.' }); } });
app.get('/api/me', authenticateToken, async (req, res) => { try { const user = await knex('users').where({ id: req.user.id }).first(); res.json({ success: true, username: user.username, balance: parseFloat(user.balance).toFixed(2) }); } catch (error) { res.status(500).json({ success: false, message: 'Could not fetch user info.' }); } });
app.post('/api/admin/add-balance', async (req, res) => { const { username, amount, adminKey } = req.body; if (adminKey !== ADMIN_SECRET_KEY) { return res.status(403).json({ success: false, message: 'Forbidden: Invalid admin key.' }); } if (!username || !amount || amount <= 0) { return res.status(400).json({ success: false, message: 'Valid username and amount required.' }); } try { const user = await knex('users').where({ username }).first(); if (!user) return res.status(404).json({ success: false, message: 'User not found.' }); const newBalance = parseFloat(user.balance) + parseFloat(amount); await knex('users').where({ username }).update({ balance: newBalance }); res.json({ success: true, message: `Added ${amount}. New balance: ${newBalance.toFixed(2)}` }); } catch (error) { res.status(500).json({ success: false, message: 'Server error while adding balance.' }); } });
app.get('/api/stock', async (req, res) => { try { const { mailType } = req.query; if (!mailType) return res.status(400).json({ success: false, message: 'Mail type is required.' }); const url = `${apiHost}/api/mail/getStock?mailType=${encodeURIComponent(mailType)}`; const response = await axios.get(url); if (response.data && response.data.code === 0) { res.json({ success: true, stock: response.data.data || 0 }); } else { res.json({ success: true, stock: 0 }); } } catch (error) { console.error("Stock Check Error:", error.message); res.status(500).json({ success: false, message: 'Could not check stock.' }); } });
app.post('/api/mail', async (req, res) => { authenticateToken(req, res, async () => { const { mailType, quantity } = req.body; const pricePerMail = ourPriceList[mailType]; if (!pricePerMail) return res.status(400).json({ success: false, message: 'This mail type is not available.' }); const totalCost = pricePerMail * parseInt(quantity, 10); try { const user = await knex('users').where({ id: req.user.id }).first(); if (parseFloat(user.balance) < totalCost) { return res.status(400).json({ success: false, message: `Insufficient balance.` }); } const externalApiUrl = `${apiHost}/api/mail/getMail?clientKey=${clientKey}&mailType=${encodeURIComponent(mailType)}&quantity=${quantity}`; const externalResponse = await axios.get(externalApiUrl); if (externalResponse.data && externalResponse.data.code === 0 && externalResponse.data.data) { const purchasedEmails = externalResponse.data.data; const formattedEmails = purchasedEmails.map(emailString => emailString.replaceAll(':', '|')); const newBalance = parseFloat(user.balance) - totalCost; await knex('users').where({ id: req.user.id }).update({ balance: newBalance }); await knex('orders').insert({ user_id: req.user.id, mailType, quantity, totalCost, purchasedEmails: JSON.stringify(formattedEmails) }); res.json({ success: true, message: 'Email purchased successfully!', newBalance: newBalance.toFixed(2), emails: formattedEmails }); } else { throw new Error(externalResponse.data.msg || 'Failed to get email from the API.'); } } catch (error) { console.error("Purchase Error:", error.message); res.status(500).json({ success: false, message: error.message || 'An unexpected server error occurred.' }); } }); });

// --- Start Server ---
app.listen(PORT, async () => {
    await setupDatabase();
    console.log(`\n✅ চূড়ান্ত সার্ভার সফলভাবে চালু হয়েছে এবং http://localhost:${PORT} -এ চলছে`);
});

