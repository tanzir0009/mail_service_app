const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const { knex, setupDatabase } = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ## .env file er bebohar bondho kora hoyeche ##
// require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
// ## GURUTTWOPURNO PORIBORTON: CORS Configuration
const corsOptions = {
    origin: 'https://forsemail.42web.io',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ## NOTUN DEBUGGING LOGGER: Shob request log korar jonno ##
app.use((req, res, next) => {
    console.log(`--> Incoming Request: ${req.method} ${req.originalUrl} from ${req.ip}`);
    next();
});

// --- Secrets and Variables ---
const clientKey = process.env.API_CLIENT_KEY;
const apiHost = 'https://gapi.hotmail007.com';
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const RUPANTOR_PAY_API_KEY = process.env.RUPANTOR_PAY_API_KEY;
const APP_BASE_URL = process.env.APP_BASE_URL;

if (!clientKey || !JWT_SECRET || !ADMIN_SECRET_KEY || !RUPANTOR_PAY_API_KEY || !APP_BASE_URL) {
    console.error("\n❌ Critical Error: One or more required keys are missing from the Render Environment Variables.");
    process.exit(1);
}

let ourPriceList = {};
try {
    ourPriceList = JSON.parse(fs.readFileSync('./prices.json', 'utf8'));
} catch (error) {
    console.error('❌ Error: Could not read prices.json.');
    process.exit(1);
}

// --- Keep-alive Endpoint ---
app.get('/', (req, res) => {
    res.status(200).send('Server is alive and running successfully!');
});

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
apiRouter.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await knex('users').where({ username }).first();
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: "Invalid username or password." });
        }
        const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ success: true, accessToken });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});
apiRouter.get('/me', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.get('/stock', async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/mail', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.get('/purchase-history', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.get('/payment-methods', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/deposit/request', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/payment/auto/checkout', authenticateToken, async (req, res) => { /* ... Code unchanged ... */ });
apiRouter.post('/payment/auto/webhook', async (req, res) => { /* ... Code unchanged ... */ });

// --- Admin Endpoints ---
const adminRouter = express.Router();
adminRouter.post('/payment-methods', async (req, res) => { /* ... Code unchanged ... */ });
adminRouter.post('/payment-methods/update', async (req, res) => { /* ... Code unchanged ... */ });
adminRouter.post('/deposits', async (req, res) => { /* ... Code unchanged ... */ });
adminRouter.post('/deposits/approve', async (req, res) => { /* ... Code unchanged ... */ });
adminRouter.post('/deposits/cancel', async (req, res) => { /* ... Code unchanged ... */ });

// ## SHESH PORIBORTON: Router-gulo shothik bhabe bebohar kora
apiRouter.use('/admin', adminRouter); // Admin route-gulo '/api/admin' er under-e thakbe
app.use('/api', apiRouter); // Shob public route '/api' er under-e thakbe

app.listen(PORT, async () => {
    await setupDatabase();
    console.log(`\n✅ Server started successfully. Now listening for requests...`);
});

