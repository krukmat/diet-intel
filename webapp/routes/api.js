const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const dietIntelAPI = require('../utils/api');

// Proxy endpoint for barcode lookup
router.post('/barcode', [
  body('barcode').isLength({ min: 8, max: 20 }).withMessage('Barcode must be between 8 and 20 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await dietIntelAPI.lookupBarcode(req.body.barcode);
    res.json(result);
  } catch (error) {
    console.error('Barcode lookup error:', error);
    res.status(500).json({ 
      error: 'Failed to lookup product',
      message: error.message 
    });
  }
});

// Proxy endpoint for OCR label scanning
router.post('/scan-label', async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const result = await dietIntelAPI.scanLabel(req.files.image);
    res.json(result);
  } catch (error) {
    console.error('OCR scanning error:', error);
    res.status(500).json({ 
      error: 'Failed to scan label',
      message: error.message 
    });
  }
});

// Proxy endpoint for external OCR
router.post('/scan-label-external', [
  body('provider').optional().isIn(['mindee', 'gpt4o', 'azure']).withMessage('Invalid OCR provider')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.files || !req.files.image) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const provider = req.body.provider || 'mindee';
    const result = await dietIntelAPI.scanLabelExternal(req.files.image, provider);
    res.json(result);
  } catch (error) {
    console.error('External OCR scanning error:', error);
    res.status(500).json({ 
      error: 'Failed to scan label with external OCR',
      message: error.message 
    });
  }
});

// Health check for API connectivity
router.get('/health', async (req, res) => {
  try {
    const apiHealth = await dietIntelAPI.healthCheck();
    res.json({
      webapp_status: 'healthy',
      api_status: apiHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      webapp_status: 'healthy',
      api_status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get nutrition trends (mock endpoint for demo)
router.get('/trends/:days', (req, res) => {
  const days = parseInt(req.params.days) || 7;
  
  // Generate mock trend data
  const trends = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    trends.push({
      date: date.toISOString().split('T')[0],
      calories: Math.floor(2000 + Math.random() * 500),
      protein: Math.floor(100 + Math.random() * 50),
      fat: Math.floor(60 + Math.random() * 30),
      carbs: Math.floor(200 + Math.random() * 100),
      meals_logged: Math.floor(3 + Math.random() * 2)
    });
  }
  
  res.json({
    period_days: days,
    trends: trends,
    averages: {
      calories: Math.floor(trends.reduce((sum, day) => sum + day.calories, 0) / trends.length),
      protein: Math.floor(trends.reduce((sum, day) => sum + day.protein, 0) / trends.length),
      fat: Math.floor(trends.reduce((sum, day) => sum + day.fat, 0) / trends.length),
      carbs: Math.floor(trends.reduce((sum, day) => sum + day.carbs, 0) / trends.length)
    }
  });
});

module.exports = router;