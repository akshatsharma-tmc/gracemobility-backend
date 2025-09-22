const express = require('express');
const router = express.Router();
const { ddbDocClient, GetCommand, PutCommand } = require('../config/aws');

router.post('/', async (req, res) => {
  const { email, name } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: 'Email and name are required' });
  }

  try {
    // Check if email already exists
    const getParams = {
      TableName: process.env.SUBSCRIPTIONS_TABLE,
      Key: { email }
    };
    const existingSubscription = await ddbDocClient.send(new GetCommand(getParams));

    if (existingSubscription.Item) {
      return res.status(409).json({ error: 'Email is already subscribed' });
    }

    // Create new subscription
    const putParams = {
      TableName: process.env.SUBSCRIPTIONS_TABLE,
      Item: {
        email,
        name,
        subscriptionDate: new Date().toISOString()
      }
    };
    await ddbDocClient.send(new PutCommand(putParams));

    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err) {
    console.error('Subscription error:', err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

module.exports = router;