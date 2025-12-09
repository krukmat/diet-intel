const express = require('express');
const router = express.Router();

// Home page
router.get('/', (req, res) => {
  res.render('index', {
    title: 'DietIntel - Nutrition Tracking & Meal Planning',
    description: 'Intelligent nutrition tracking with barcode scanning, OCR, and AI-powered meal planning',
    features: [
      {
        icon: '🔍',
        title: 'Barcode Scanner',
        description: 'Instantly lookup product nutrition information by scanning barcodes'
      },
      {
        icon: '📸',
        title: 'OCR Label Scanning',
        description: 'Extract nutrition facts from food labels using advanced OCR technology'
      },
      {
        icon: '🍽️',
        title: 'AI Meal Planning',
        description: 'Generate personalized meal plans based on your goals and preferences'
      },
      {
        icon: '📊',
        title: 'Nutrition Analytics',
        description: 'Track your daily intake with detailed nutritional analysis'
      }
    ]
  });
});

// About page - redirect to home for now
router.get('/about', (req, res) => {
  res.redirect('/');
});

// API Documentation page - redirect to API docs
router.get('/docs', (req, res) => {
  const apiUrl = process.env.DIETINTEL_API_URL || 'http://localhost:8000';
  res.redirect(`${apiUrl}/docs`);
});

module.exports = router;