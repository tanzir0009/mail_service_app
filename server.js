const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config(); 
const fs = require('fs');
const path = require('path'); // <<< নতুন: পাথ (path) মডিউল যোগ করা হয়েছে
const { knex, setupDatabase } = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- Express App Setup ---
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// <<< নতুন কোড: public ফোল্ডারটিকে স্ট্যাটিক হিসেবে পরিবেশন করা >>>
app.use(express.static(path.join(__dirname, 'public')));


// --- Secrets and Variables (অপরিবর্তিত) ---
const clientKey = process.env.API_CLIENT_KEY;
const apiHost = 'https://gapi.hotmail007.com';
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
if (!clientKey || !JWT_SECRET || !ADMIN_SECRET_KEY) { console.error("\n❌ .env ফাইল থেকে কী লোড করা যায়নি।"); process.exit(1); }
let ourPriceList = {}; try { const data = fs.readFileSync('./prices.json', 'utf8'); ourPriceList = JSON.parse(data); } catch (e) { console.error('❌ prices.json ফাইল পাওয়া যায়নি।'); process.exit(1); }

// --- API Endpoints (এগুলো সব অপরিবর্তিত থাকবে) ---
function authenticateToken(req, res, next) { /*...*/ }
app.get('/api/prices', (req, res) => { /*...*/ });
app.post('/api/register', async (req, res) => { /*...*/ });
app.post('/api/admin/add-balance', async (req, res) => { /*...*/ });
app.post('/api/login', async (req, res) => { /*...*/ });
app.get('/api/me', authenticateToken, async (req, res) => { /*...*/ });
app.get('/api/stock', async (req, res) => { /*...*/ });
app.post('/api/mail', authenticateToken, async (req, res) => { /*...*/ });

// <<< নতুন কোড: অন্য যেকোনো রিকোয়েস্টের জন্য index.html দেখানো >>>
// এটি নিশ্চিত করে যে ব্যবহারকারী পেইজ রিফ্রেশ করলেও অ্যাপটি কাজ করবে
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- Start Server (অপরিবর্তিত) ---
app.listen(PORT, async () => {
    await setupDatabase();
    console.log(`\n✅ লাইভ সার্ভারটি http://localhost:${PORT} -এ চলছে`);
});
