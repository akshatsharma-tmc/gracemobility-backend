const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ddbDocClient } = require('../config/aws');
const { PutCommand, GetCommand, ScanCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const params = { TableName: process.env.USERS_TABLE, Key: { id: '1' } }; // Check admin first
    let userData = await ddbDocClient.send(new GetCommand(params));
    if (!userData.Item || userData.Item.username !== username || !await bcrypt.compare(password, userData.Item.password)) {
      const scanParams = {
        TableName: process.env.USERS_TABLE,
        FilterExpression: 'username = :u',
        ExpressionAttributeValues: { ':u': username }
      };
      userData = await ddbDocClient.send(new ScanCommand(scanParams));
      if (!userData.Items[0] || !await bcrypt.compare(password, userData.Items[0].password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      userData.Item = userData.Items[0];
    }
    const token = jwt.sign(
      { id: userData.Item.id, name: userData.Item.name, role: userData.Item.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: userData.Item.id, name: userData.Item.name, role: userData.Item.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register (admin only)
router.post('/register', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can register users' });
    }
    const { username, password, role, name } = req.body;
    if (!username || !password || !role || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const user = { id, username, password: hashed, role, name };
    const params = { TableName: process.env.USERS_TABLE, Item: user };
    await ddbDocClient.send(new PutCommand(params));
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users (admin only)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view users' });
    }
    const params = { TableName: process.env.USERS_TABLE };
    const data = await ddbDocClient.send(new ScanCommand(params));
    res.json(data.Items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete users' });
    }
    const params = { TableName: process.env.USERS_TABLE, Key: { id: req.params.id } };
    await ddbDocClient.send(new DeleteCommand(params));
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user password (admin only)
router.put('/:id/password', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can change passwords' });
    }
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    const params = {
      TableName: process.env.USERS_TABLE,
      Key: { id },
      UpdateExpression: 'set password = :p',
      ExpressionAttributeValues: { ':p': hashed }
    };
    await ddbDocClient.send(new UpdateCommand(params));
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

module.exports = router;