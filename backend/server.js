const express = require('express');
const cors = require('cors');
const multer = require('multer');
const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1'
});

// Initialize AWS Rekognition
const rekognition = new AWS.Rekognition();

// Configure multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// Routes
app.post('/api/detect-labels', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    // Prepare image parameters
    const imageParams = {
      Image: {
        Bytes: req.file.buffer
      }
    };

    // Detect labels
    const labelParams = {
      ...imageParams,
      MaxLabels: 10,
      MinConfidence: 70
    };

    // Detect text
    const textParams = {
      ...imageParams,
      Filters: {
        WordFilter: {
          MinConfidence: 70
        }
      }
    };

    // Execute both label and text detection in parallel
    Promise.all([
      new Promise((resolve, reject) => {
        rekognition.detectLabels(labelParams, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      }),
      new Promise((resolve, reject) => {
        rekognition.detectText(textParams, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      })
    ])
    .then(([labelData, textData]) => {
      res.json({
        Labels: labelData.Labels,
        TextDetections: textData.TextDetections
      });
    })
    .catch(err => {
      console.error('Error:', err);
      res.status(500).json({ error: 'Failed to process image' });
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
