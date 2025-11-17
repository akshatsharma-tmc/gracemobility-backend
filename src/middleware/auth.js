const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  console.log('Auth Middleware - Received token:', token);
  console.log('Auth Middleware - JWT_SECRET:', process.env.JWT_SECRET);
  console.log('Auth Middleware - USERS_TABLE:', process.env.USERS_TABLE);

  if (!token) {
    console.log('Auth Middleware - Error: No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    console.log('Auth Middleware - Verifying token with JWT_SECRET:', process.env.JWT_SECRET);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Auth Middleware - Decoded token:', decoded);
    req.user = decoded;

    // Fetch user to verify role
    const { ddbDocClient, GetCommand } = require('../config/aws');
    const userParams = {
      TableName: process.env.USERS_TABLE,
      Key: { id: decoded.id }
    };
    console.log('Auth Middleware - Fetching user with params:', userParams);
    const userData = await ddbDocClient.send(new GetCommand(userParams));
    console.log('Auth Middleware - Fetched user:', userData.Item);

    if (!userData.Item) {
      console.log('Auth Middleware - Error: User not found for id:', decoded.id);
      return res.status(401).json({ error: 'User not found' });
    }
    req.user.role = userData.Item.role; // Ensure role is up-to-date
    console.log('Auth Middleware - User role:', req.user.role);
    next();
  } catch (err) {
    console.error('Auth Middleware - Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid token', details: err.message });
  }
};