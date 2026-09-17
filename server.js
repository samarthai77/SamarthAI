const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

// ===== SUPABASE DIAGNOSTIC START =====
const dns = require('dns').promises;

(async () => {
  try {
    const url = new URL(process.env.SUPABASE_URL);
    const host = url.hostname;

    console.log('[SUPABASE DIAG] Host:', host);

    const dnsResult = await dns.lookup(host);
    console.log('[SUPABASE DIAG] DNS OK:', dnsResult);

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/users?select=id&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        }
      }
    );

    console.log('[SUPABASE DIAG] HTTP Status:', response.status);
    console.log('[SUPABASE DIAG] Supabase connection OK');
  } catch (err) {
    console.error('[SUPABASE DIAG] FAILED:', {
      name: err.name,
      message: err.message,
      code: err.code,
      cause: err.cause?.message,
      causeCode: err.cause?.code
    });
  }
})();
// ===== SUPABASE DIAGNOSTIC END =====

const app = express();


app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.get('/css/style.css', (req, res) => {
  res.sendFile(__dirname + '/frontend/style.css');
});

app.get('/js/app.js', (req, res) => {
  res.sendFile(__dirname + '/frontend/app.js');
});
app.use(express.static('frontend'));
app.use('/css', express.static(__dirname + '/frontend'));
app.use('/js', express.static(__dirname + '/frontend'));
// ======= Routes =========
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const chatRoutes = require('./routes/chat');
app.use('/api/chat', chatRoutes);

const autonomousEngineRouter = require('./routes/autonomousEngine');
app.use('/api/autonomous', autonomousEngineRouter);

// ======= SERVICES ROUTE =========
const servicesRoutes = require('./routes/services');
const servicePortfolioRoutes = require('./routes/servicePortfolio');
app.use('/api/service-portfolio', servicePortfolioRoutes);
app.use('/api/services', servicesRoutes);
const requestsRoutes = require('./routes/requests');
app.use('/api/requests', requestsRoutes);
const sosRoutes = require('./routes/sos');
app.use('/api/sos', sosRoutes);
const familyRoutes = require('./routes/family');
app.use('/api/family', familyRoutes);
const reviewsRoutes = require('./routes/reviews');
app.use('/api/reviews', reviewsRoutes);
const messagesRoutes = require('./routes/messages');
app.use('/api/messages', messagesRoutes);
const notificationsRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationsRoutes);
const gpsRoutes = require('./routes/gps');
app.use('/api/gps', gpsRoutes);
const memoryRoutes = require('./routes/memory');
app.use('/api/memory', memoryRoutes);
const scannerRoutes = require('./routes/scanner');
const weatherRoutes = require('./routes/weather');
app.use('/api/weather', weatherRoutes);
app.use('/api/scanner', scannerRoutes);
app.get('/', (req, res) => {
    res.json({ message: 'SamarthAI Backend Live!', status: 'success' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`SamarthAI server running on port ${PORT}`);
});    

