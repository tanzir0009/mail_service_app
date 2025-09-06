const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config(); 
const fs = require('fs');
const path = require('path');
const { knex, setupDatabase } = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- Express App Setup ---
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Secrets and Variables (অপরিবর্তিত) ---
const clientKey = process.env.API_CLIENT_KEY;
const apiHost = 'https://gapi.hotmail007.com';
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
if (!clientKey || !JWT_SECRET || !ADMIN_SECRET_KEY) { console.error("\n❌ .env ফাইল থেকে কী লোড করা যায়নি।"); process.exit(1); }
let ourPriceList = {}; try { const data = fs.readFileSync('./prices.json', 'utf8'); ourPriceList = JSON.parse(data); } catch (e) { console.error('❌ prices.json ফাইল পাওয়া যায়নি।'); process.exit(1); }


// <<< **সমাধান এখানে** >>>
// ১. প্রথমে API রুটগুলো ডিফাইন করা হচ্ছে
// এটি নিশ্চিত করে যে /api/login, /api/stock ইত্যাদি রিকোয়েস্টগুলো আগে處理 করা হবে
function authenticateToken(req, res, next) { const authHeader = req.headers['authorization']; const token = authHeader && authHeader.split(' ')[1]; if (token == null) return res.sendStatus(401); jwt.verify(token, JWT_SECRET, (err, user) => { if (err) return res.sendStatus(403); req.user = user; next(); }); }
app.get('/api/prices', (req, res) => res.json({ success: true, prices: ourPriceList }));
app.post('/api/register', async (req, res) => { try { const { username, password } = req.body; if (!username || !password) return res.status(400).json({ success: false, message: "Username and password are required." }); const hashedPassword = await bcrypt.hash(password, 10); await knex('users').insert({ username, password: hashedPassword, balance: 0.00 }); res.status(201).json({ success: true, message: "Registration successful!" }); } catch (error) { if (error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ success: false, message: "This username is already taken." }); res.status(500).json({ success: false, message: "Server error during registration." }); } });
app.post('/api/admin/add-balance', async (req, res) => { const { username, amount, adminKey } = req.body; if (adminKey !== ADMIN_SECRET_KEY) return res.status(403).json({ success: false, message: 'Forbidden: Invalid admin key.' }); if (!username || !amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid username and amount required.' }); try { const user = await knex('users').where({ username }).first(); if (!user) return res.status(404).json({ success: false, message: 'User not found.' }); const newBalance = parseFloat(user.balance) + parseFloat(amount); await knex('users').where({ username }).update({ balance: newBalance }); res.json({ success: true, message: `Added ${amount}. New balance: ${newBalance.toFixed(2)}` }); } catch (error) { res.status(500).json({ success: false, message: 'Server error while adding balance.' }); } });
app.post('/api/login', async (req, res) => { try { const { username, password } = req.body; const user = await knex('users').where({ username }).first(); if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ success: false, message: "Invalid username or password." }); const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' }); res.json({ success: true, accessToken }); } catch (error) { res.status(500).json({ success: false, message: 'Server error during login.' }); } });
app.get('/api/me', authenticateToken, async (req, res) => { try { const user = await knex('users').where({ id: req.user.id }).first(); res.json({ success: true, username: user.username, balance: parseFloat(user.balance).toFixed(2) }); } catch (error) { res.status(500).json({ success: false, message: 'Could not fetch user info.' }); } });
app.get('/api/stock', async (req, res) => { try { const { mailType } = req.query; if (!mailType) return res.status(400).json({ success: false, message: 'Mail type is required.' }); const url = `${apiHost}/api/mail/getStock?mailType=${encodeURIComponent(mailType)}`; const response = await axios.get(url); res.json({ success: true, stock: response.data.data || 0 }); } catch (error) { res.status(500).json({ success: false, message: 'Could not check stock.' }); } });
app.post('/api/mail', authenticateToken, async (req, res) => { /* ... আগের কোড ... */ });


// ২. public ফোল্ডারটিকে স্ট্যাটিক হিসেবে পরিবেশন করা হচ্ছে
app.use(express.static(path.join(__dirname, 'public')));

// ৩. সবশেষে, অন্য যেকোনো রিকোয়েস্টের জন্য index.html দেখানো হচ্ছে
// এটি নিশ্চিত করে যে ব্যবহারকারী পেইজ রিফ্রেশ করলেও অ্যাপটি কাজ করবে
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- Start Server (অপরিবর্তিত) ---
app.listen(PORT, async () => {
    await setupDatabase();
    console.log(`\n✅ লাইভ সার্ভারটি http://localhost:${PORT} -এ চলছে`);
});

