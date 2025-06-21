const express = require('express');
const path = require('path');
// Added this line - imported express-session middleware
const session = require('express-session');
require('dotenv').config();

const app = express();

// added this below
app.use(session({
    secret: 'dog-walk-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '/public')));

// Routes
const walkRoutes = require('./routes/walkRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/walks', walkRoutes);
app.use('/api/users', userRoutes);

// Export the app instead of listening here
module.exports = app;