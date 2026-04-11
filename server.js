const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Trust Cloudflare / reverse-proxy forwarded headers (x-forwarded-proto, x-forwarded-host)
app.set('trust proxy', true);

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors({
    origin: ['http://localhost:3000', 'https://prisoners-cas-acdbentity-cnet.trycloudflare.com'],
    credentials: true,
}));

// Allow Google Sign-In popup (Cross-Origin-Opener-Policy)
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
});

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, 'uploads', 'papers');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
const reportsDir = path.join(__dirname, 'uploads', 'reports');
if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
}
const certsDir = path.join(__dirname, 'uploads', 'certificates');
if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Route files
const authRoutes = require('./routes/authRoutes');
const superadminRoutes = require('./routes/superadminRoutes');
const articleRoutes = require('./routes/articleRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reviewerRoutes = require('./routes/reviewerRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const pushRoutes = require('./routes/pushRoutes');
const siteConfigRoutes = require('./routes/siteConfigRoutes');

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviewer', reviewerRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/site-config', siteConfigRoutes);

// Public newsletter unsubscribe (no auth)
const { unsubscribe } = require('./controllers/newsletterController');
app.get('/api/newsletter/unsubscribe', unsubscribe);



app.get('/', (req, res) => {
    res.send('API is running...');
});

// ── Background job: finalize review outcomes when deadline has passed ──
// Runs every 30 seconds. Handles the case where one reviewer submitted their
// review but the second reviewer has not, and the 2-minute deadline has expired.
const { processExpiredReviewDeadlines } = require('./jobs/reviewDeadlineJob');
setInterval(() => {
    processExpiredReviewDeadlines().catch(err =>
        console.error('[Review Deadline Job] Error:', err)
    );
}, 30 * 1000);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
