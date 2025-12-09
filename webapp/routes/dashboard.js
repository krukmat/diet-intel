const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all dashboard routes
router.use(requireAuth);

// Dashboard home page
router.get('/', (req, res) => {
  const welcomeMessage = req.query.welcome === 'true';
  
  res.render('dashboard/index', {
    title: 'Dashboard',
    description: 'Your personal nutrition tracking dashboard',
    welcomeMessage,
    user: res.locals.currentUser
  });
});

// User profile page
router.get('/profile', (req, res) => {
  res.render('dashboard/profile', {
    title: 'Profile Settings',
    description: 'Manage your account settings and preferences',
    user: res.locals.currentUser
  });
});

module.exports = router;