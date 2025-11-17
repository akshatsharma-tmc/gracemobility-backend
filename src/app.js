const express = require('express');
const cors = require('cors');
const postsRouter = require('./routes/posts');
const usersRouter = require('./routes/users');
const subscriptionsRouter = require('./routes/subscriptions');
const productSubscriptionsRouter = require('./routes/product-subscriptions');
const chatRouter = require('./routes/chat');

const app = express();

// Configure CORS to allow multiple origins
const allowedOrigins = [
  'http://localhost:5173', // Local development
  'http://13.204.187.229', // EC2 IP
  'https://gracemobility.in',
  process.env.COMPANY_WEBSITE // Live site[](https://gracemobility.co.in)
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
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
app.use('/api/chat', chatRouter);

module.exports = app;
