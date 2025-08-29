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

// About page
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'About DietIntel',
    description: 'Learn more about DietIntel\'s mission and technology'
  });
});

// API Documentation page
router.get('/docs', (req, res) => {
  res.render('docs', {
    title: 'API Documentation',
    description: 'Complete API reference for DietIntel services'
  });
});

module.exports = router;