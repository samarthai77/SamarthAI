const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('frontend'));

// ======= Routes =========
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const chatRoutes = require('./routes/chat');
app.use('/api/chat', chatRoutes);
// ======= SERVICES ROUTE =========
const servicesRoutes = require('./routes/services');
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
const gpsRoutes = require('./routes/gps');
app.use('/api/gps', gpsRoutes);
const memoryRoutes = require('./routes/memory');
app.use('/api/memory', memoryRoutes);
app.get('/', (req, res) => {
    res.json({ message: 'SamarthAI Backend Live!', status: 'success' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`SamarthAI server running on port ${PORT}`);
});
