const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3006;

const searchRoute = require('./routes/search');

// Middleware
app.use(cors());
app.use(express.json());

// Static image path
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/search', searchRoute);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
