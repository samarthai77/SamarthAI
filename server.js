const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
  res.json({ message: '🚀 SamarthAI Backend Live!', status: 'success' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ SamarthAI server running on port ${PORT}`));
