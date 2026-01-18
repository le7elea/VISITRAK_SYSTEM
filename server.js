// server.js
const express = require('express');
const cors = require('cors');
const sendPasswordReset = require('./send-password-reset').default;

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Use your existing handler
app.post('/api/send-password-reset', async (req, res) => {
  await sendPasswordReset(req, res);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});