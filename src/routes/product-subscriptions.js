const express = require('express');
     const router = express.Router();
     const { ddbDocClient, GetCommand, PutCommand, DeleteCommand, ScanCommand } = require('../config/aws');
     const nodemailer = require('nodemailer');
     const crypto = require('crypto');

     // GET all product subscriptions (for testing or admin use)
     router.get('/', async (req, res) => {
       try {
         const params = { TableName: process.env.PRODUCT_SUBSCRIPTIONS_TABLE };
         const data = await ddbDocClient.send(new ScanCommand(params));
         res.json(data.Items);
       } catch (err) {
         console.error('Get product subscriptions error:', err.message);
         res.status(500).json({ error: 'Failed to fetch subscriptions' });
       }
     });

     router.post('/', async (req, res) => {
       const { email, name } = req.body;

       if (!email || !name) {
         return res.status(400).json({ error: 'Email and name are required' });
       }

       try {
         // Check if email already exists
         const getParams = {
           TableName: process.env.PRODUCT_SUBSCRIPTIONS_TABLE,
           Key: { email }
         };
         const existingSubscription = await ddbDocClient.send(new GetCommand(getParams));

         if (existingSubscription.Item) {
           return res.status(409).json({ error: 'This email is already subscribed. Try a different email or contact us to unsubscribe.' });
         }

         // Create new subscription
         const putParams = {
           TableName: process.env.PRODUCT_SUBSCRIPTIONS_TABLE,
           Item: {
             email,
             name,
             subscriptionDate: new Date().toISOString()
           }
         };
         await ddbDocClient.send(new PutCommand(putParams));

         // Generate unsubscribe token
         const unsubscribeToken = crypto.createHash('sha256').update(email + process.env.SECRET_KEY).digest('hex');
         const unsubscribeUrl = `${process.env.COMPANY_WEBSITE}/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubscribeToken}`;

         // Send email
         const transporter = nodemailer.createTransport({
           host: process.env.SMTP_HOST,
           port: process.env.SMTP_PORT,
           secure: false,
           auth: {
             user: process.env.SMTP_USER,
             pass: process.env.SMTP_PASS
           }
         });

         const mailOptions = {
           from: `"Grace.ev Team" <${process.env.SMTP_USER}>`,
           to: email,
           subject: '🎉 Thanks for subscribing – You’ll be the first to know!',
           html: `
             <h2>Hi ${name},</h2>
             <p>Thank you for showing interest in Grace.ev!</p>
             <p>You’re now on our early access list, which means you’ll be the first to get updates about new launches, special offers, and product announcements.</p>
             <p>We’re excited to keep you in the loop. Stay tuned—something amazing is on the way!</p>
             <p>If you ever change your mind, you can <a href="${unsubscribeUrl}">unsubscribe</a> anytime with just one click.</p>
             <p>Cheers,<br>The Grace.ev Team</p>
             <p><a href="${process.env.COMPANY_WEBSITE}">${process.env.COMPANY_WEBSITE}</a></p>
           `
         };

         await transporter.sendMail(mailOptions);
         console.log(`Email sent to ${email}`);

         res.status(201).json({ message: 'Subscribed successfully' });
       } catch (err) {
         console.error('Product subscription error:', err.message, err.stack);
         res.status(500).json({ error: 'Failed to subscribe' });
       }
     });

     router.delete('/', async (req, res) => {
       const { email, token } = req.query;

       if (!email || !token) {
         return res.status(400).json({ error: 'Email and token are required' });
       }

       try {
         // Verify token
         const expectedToken = crypto.createHash('sha256').update(email + process.env.SECRET_KEY).digest('hex');
         if (token !== expectedToken) {
           return res.status(401).json({ error: 'Invalid unsubscribe token' });
         }

         // Check if subscription exists
         const getParams = {
           TableName: process.env.PRODUCT_SUBSCRIPTIONS_TABLE,
           Key: { email }
         };
         const existingSubscription = await ddbDocClient.send(new GetCommand(getParams));

         if (!existingSubscription.Item) {
           return res.status(404).json({ error: 'Subscription not found' });
         }

         // Delete subscription
         const deleteParams = {
           TableName: process.env.PRODUCT_SUBSCRIPTIONS_TABLE,
           Key: { email }
         };
         await ddbDocClient.send(new DeleteCommand(deleteParams));

         res.status(200).json({ message: 'Unsubscribed successfully' });
       } catch (err) {
         console.error('Unsubscribe error:', err.message, err.stack);
         res.status(500).json({ error: 'Failed to unsubscribe' });
       }
     });

     module.exports = router;