const express = require('express');
const cors = require('cors');
const postsRouter = require('./routes/posts');
const usersRouter = require('./routes/users');
const subscriptionsRouter = require('./routes/subscriptions');
const productSubscriptionsRouter = require('./routes/product-subscriptions');

const app = express();

// Configure CORS to allow multiple origins
const allowedOrigins = [
  'http://localhost:5173', // Local development
  process.env.COMPANY_WEBSITE // Live site (https://www.gracemobility.co.in)
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g., Postman) or from allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());
app.use('/api/posts', postsRouter);
app.use('/api/users', usersRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/product-subscriptions', productSubscriptionsRouter);

module.exports = app;