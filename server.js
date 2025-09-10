const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { knex, setupDatabase } = require('./database'); // Make sure database.js is in the same folder
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios'); // For calling the mail provider API

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
const allowedOrigins = [
    'https://forsemail.42web.io', // Your production domain
    'http://127.0.0.1:5500',    // For local testing with Live Server
    'http://localhost:5500'      // Another local testing variation
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
// !! IMPORTANT !! SET THESE IN YOUR RENDER.COM ENVIRONMENT VARIABLES
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret_for_local_dev';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'fallback_admin_secret_for_local_dev';
const GAPI_CLIENT_KEY = process.env.GAPI_CLIENT_KEY || 'YOUR_GAPI_HOTMAIL_API_KEY'; // <-- Bosate hobe
const GAPI_HOST = 'https://gapi.hotmail007.com';

let ourPriceList = {};
try {
    ourPriceList = JSON.parse(fs.readFileSync('./prices.json', 'utf8'));
    console.log("✅ prices.json loaded successfully.");
} catch (error) {
    console.error('❌ Critical Error: Could not read prices.json. Server is shutting down.');
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
// !! IMPORTANT !! Ei function gulo apnar mail provider er API onujayi poriborton korte hote pare.
const getStock = async (mailType) => {
    try {
        const response = await axios.get(`${GAPI_HOST}/api/stock`, {
            params: { clientKey: GAPI_CLIENT_KEY, mailType: mailType }
        });
        return response.data.stock || 0;
    } catch (error) {
        console.error(`Error fetching stock for ${mailType}:`, error.response?.data || error.message);
        return 0; // Return 0 if API fails
    }
};

const getMail = async (mailType, quantity) => {
     try {
        const response = await axios.get(`${GAPI_HOST}/api/mail`, {
            params: { clientKey: GAPI_CLIENT_KEY, mailType: mailType, quantity: quantity }
        });
        // Assuming the API returns an array of emails in response.data.emails
        if (response.data && response.data.success) {
            return response.data.emails;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching mail for ${mailType}:`, error.response?.data || error.message);
        return null;
    }
};

// --- API ROUTES ---

// Public Routes
app.get('/', (req, res) => res.status(200).send('Forse Mail Server is running perfectly!'));
app.get('/api/prices', (req, res) => res.json({ success: true, prices: ourPriceList }));
app.get('/api/stock', async (req, res) => {
    const { mailType } = req.query;
    if (!mailType) return res.status(400).json({ success: false, message: "Mail type is required." });
    const stock = await getStock(mailType);
    res.json({ success: true, stock });
});

// Auth Routes
app.post('/api/register', async (req, res) => {
    // Logic from previous steps, no changes needed
});

app.post('/api/login', async (req, res) => {
    // Logic from previous steps, no changes needed
});

// Authenticated User Routes
app.get('/api/me', authenticateToken, async (req, res) => {
    // Logic from previous steps, no changes needed
});

app.post('/api/mail', authenticateToken, async (req, res) => {
    const { mailType, quantity } = req.body;
    const qty = parseInt(quantity, 10);

    if (!mailType || !qty || qty <= 0 || !ourPriceList[mailType]) {
        return res.status(400).json({ success: false, message: 'Invalid mail type or quantity.' });
    }

    const trx = await knex.transaction();
    try {
        const user = await trx('users').where({ id: req.user.id }).first();
        const totalCost = ourPriceList[mailType] * qty;

        if (user.balance < totalCost) {
            await trx.rollback();
            return res.status(402).json({ success: false, message: 'Insufficient balance. Please add funds.' });
        }
        
        const availableStock = await getStock(mailType);
        if(availableStock < qty){
            await trx.rollback();
            return res.status(400).json({ success: false, message: 'Not enough stock available.' });
        }

        const purchasedEmails = await getMail(mailType, qty);
        if (!purchasedEmails || purchasedEmails.length < qty) {
            await trx.rollback();
            return res.status(500).json({ success: false, message: 'Could not fetch enough emails from the provider.' });
        }

        const newBalance = user.balance - totalCost;
        await trx('users').where({ id: user.id }).update({ balance: newBalance });
        await trx('purchases').insert({
            user_id: user.id, mailType, quantity: qty, total_cost: totalCost,
            purchased_emails: JSON.stringify(purchasedEmails)
        });

        await trx.commit();
        res.json({ success: true, emails: purchasedEmails, newBalance: newBalance.toFixed(2) });

    } catch (error) {
        await trx.rollback();
        console.error("Purchase Error:", error);
        res.status(500).json({ success: false, message: 'An internal error occurred.' });
    }
});

app.get('/api/purchase-history', authenticateToken, async (req, res) => {
    // Logic from previous steps, no changes needed
});

app.get('/api/payment-methods', authenticateToken, async (req, res) => {
    // Logic from previous steps, no changes needed
});

app.post('/api/deposit/request', authenticateToken, async (req, res) => {
    // Logic from previous steps, no changes needed
});

// --- ADMIN ROUTES ---
app.post('/api/admin/deposits', authenticateAdmin, async (req, res) => {
    try {
        const deposits = await knex('deposits').where({ status: 'pending' }).orderBy('created_at', 'asc');
        res.json({ success: true, deposits });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch deposits.' });
    }
});

app.post('/api/admin/deposits/approve', authenticateAdmin, async (req, res) => {
    const { depositId } = req.body;
    const trx = await knex.transaction();
    try {
        const deposit = await trx('deposits').where({ id: depositId, status: 'pending' }).first();
        if (!deposit) {
            await trx.rollback();
            return res.status(404).json({ success: false, message: 'Deposit not found or already processed.' });
        }
        await trx('users').where({ id: deposit.user_id }).increment('balance', deposit.amount);
        await trx('deposits').where({ id: depositId }).update({ status: 'approved' });
        await trx.commit();
        res.json({ success: true, message: `Deposit #${depositId} approved.` });
    } catch (error) {
        await trx.rollback();
        res.status(500).json({ success: false, message: 'Failed to approve deposit.' });
    }
});

app.post('/api/admin/deposits/cancel', authenticateAdmin, async (req, res) => {
     const { depositId } = req.body;
     try {
        const updated = await knex('deposits').where({ id: depositId, status: 'pending' }).update({ status: 'cancelled' });
        if(updated){
            res.json({ success: true, message: `Deposit #${depositId} has been cancelled.` });
        } else {
            res.status(404).json({ success: false, message: 'Deposit not found or already processed.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to cancel deposit.' });
    }
});

app.post('/api/admin/payment-methods', authenticateAdmin, async (req, res) => {
    try {
        const methods = await knex('payment_methods').select('*');
        res.json({ success: true, data: methods });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch payment methods.' });
    }
});

app.post('/api/admin/payment-methods/update', authenticateAdmin, async (req, res) => {
    const { methods } = req.body; // methods should be an array of {method: 'bKash', number: '01...'}
    const trx = await knex.transaction();
    try {
        await trx('payment_methods').del(); // Delete all old methods
        if (methods && methods.length > 0) {
            const validMethods = methods.filter(m => m.method && m.number).map(m => ({ method: m.method, number: m.number, is_active: true }));
            if (validMethods.length > 0) {
                 await trx('payment_methods').insert(validMethods);
            }
        }
        await trx.commit();
        res.json({ success: true, message: 'Payment methods updated successfully.' });
    } catch (error) {
        await trx.rollback();
        res.status(500).json({ success: false, message: 'Failed to update payment methods.' });
    }
});

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

