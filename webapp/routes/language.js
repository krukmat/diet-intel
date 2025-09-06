const express = require('express');
const router = express.Router();

// Language switching endpoint
router.post('/switch', (req, res) => {
  const { language, redirect } = req.body;
  
  // Validate language
  const supportedLanguages = ['en', 'es'];
  if (!supportedLanguages.includes(language)) {
    return res.status(400).json({ error: 'Unsupported language' });
  }
  
  // Set language cookie
  res.cookie('i18next', language, {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    httpOnly: false,
    sameSite: 'lax'
  });
  
  // Redirect back or to home page
  const redirectUrl = redirect && redirect.startsWith('/') ? redirect : '/';
  res.redirect(redirectUrl);
});

// API endpoint to get current language
router.get('/current', (req, res) => {
  res.json({
    language: req.i18n.language,
    languages: req.i18n.languages
  });
});

module.exports = router;