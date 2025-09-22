const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { ddbDocClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('../config/aws');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const params = { TableName: process.env.POSTS_TABLE };
    const data = await ddbDocClient.send(new ScanCommand(params));
    res.json(data.Items);
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.post('/', auth, async (req, res) => {
  const { title, content, excerpt, author, imageUrl, readTime } = req.body;
  try {
    const params = {
      TableName: process.env.POSTS_TABLE,
      Item: {
        id: uuidv4(),
        title,
        content,
        excerpt,
        author,
        imageUrl,
        readTime,
        date: new Date().toISOString()
      }
    };
    await ddbDocClient.send(new PutCommand(params));
    res.status(201).json({ message: 'Post created' });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

router.post('/upload-url', auth, async (req, res) => {
  const { fileName, contentType } = req.body;
  try {
    const { s3Client } = require('../config/aws');
    const key = `images/${uuidv4()}-${fileName}`;
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: contentType
    };
    console.log('Generating presigned URL for params:', params);
    const url = await getSignedUrl(s3Client, new PutObjectCommand(params), { expiresIn: 60 });
    console.log('Presigned URL generated:', url);
    res.json({ url, key: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}` });
  } catch (err) {
    console.error('Upload URL error:', err.message);
    res.status(500).json({ error: 'Failed to generate upload URL', details: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { title, content, excerpt, imageUrl, readTime } = req.body;
  try {
    const params = {
      TableName: process.env.POSTS_TABLE,
      Key: { id },
      UpdateExpression: 'set title = :t, content = :c, excerpt = :e, imageUrl = :i, readTime = :r',
      ExpressionAttributeValues: {
        ':t': title,
        ':c': content,
        ':e': excerpt,
        ':i': imageUrl,
        ':r': readTime
      }
    };
    await ddbDocClient.send(new UpdateCommand(params));
    res.json({ message: 'Post updated' });
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;
  try {
    const params = {
      TableName: process.env.POSTS_TABLE,
      Key: { id }
    };
    await ddbDocClient.send(new DeleteCommand(params));
    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;