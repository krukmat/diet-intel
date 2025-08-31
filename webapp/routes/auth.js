const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { checkAuth, redirectIfAuthenticated, refreshTokenIfNeeded } = require('../middleware/auth');

const router = express.Router();
const API_BASE_URL = process.env.DIETINTEL_API_URL || 'http://localhost:8000';

// Apply checkAuth middleware to all auth routes
router.use(checkAuth);

// Login page
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('auth/login', {
    title: 'Sign In',
    description: 'Sign in to your DietIntel account',
    redirect: req.query.redirect || '/'
  });
});

// Register page
router.get('/register', redirectIfAuthenticated, (req, res) => {
  res.render('auth/register', {
    title: 'Create Account',
    description: 'Create your DietIntel account'
  });
});

// Login form submission
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 1 }).withMessage('Password is required')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/login', {
        title: 'Sign In',
        description: 'Sign in to your DietIntel account',
        redirect: req.body.redirect || '/',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { email, password, redirect } = req.body;

    // Make login request to backend API
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });

    // Set tokens as HTTP-only cookies
    res.cookie('access_token', response.data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refresh_token', response.data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // Redirect to intended page or home
    const redirectUrl = redirect && redirect !== '/' ? redirect : '/dashboard';
    res.redirect(redirectUrl);

  } catch (error) {
    let errorMessage = 'Login failed. Please try again.';
    
    if (error.response) {
      if (error.response.status === 401) {
        errorMessage = 'Invalid email or password.';
      } else if (error.response.data?.detail) {
        errorMessage = error.response.data.detail;
      }
    }

    res.render('auth/login', {
      title: 'Sign In',
      description: 'Sign in to your DietIntel account',
      redirect: req.body.redirect || '/',
      errors: [{ msg: errorMessage }],
      formData: req.body
    });
  }
});

// Register form submission
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('full_name').isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters'),
  body('confirm_password').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/register', {
        title: 'Create Account',
        description: 'Create your DietIntel account',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { email, password, full_name, developer_code } = req.body;

    // Make registration request to backend API
    const response = await axios.post(`${API_BASE_URL}/auth/register`, {
      email,
      password,
      full_name,
      developer_code: developer_code || undefined
    });

    // Set tokens as HTTP-only cookies
    res.cookie('access_token', response.data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refresh_token', response.data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // Redirect to dashboard with welcome message
    res.redirect('/dashboard?welcome=true');

  } catch (error) {
    let errorMessage = 'Registration failed. Please try again.';
    
    if (error.response) {
      if (error.response.status === 409) {
        errorMessage = 'An account with this email already exists.';
      } else if (error.response.data?.detail) {
        errorMessage = error.response.data.detail;
      }
    }

    res.render('auth/register', {
      title: 'Create Account',
      description: 'Create your DietIntel account',
      errors: [{ msg: errorMessage }],
      formData: req.body
    });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    
    // Call backend logout if we have a refresh token
    if (refreshToken) {
      try {
        await axios.post(`${API_BASE_URL}/auth/logout`, {
          refresh_token: refreshToken
        });
      } catch (error) {
        // Ignore errors from backend logout - best effort
      }
    }
  } catch (error) {
    // Ignore errors - we'll clear cookies anyway
  }
  
  // Clear authentication cookies
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  
  // Redirect to home page
  res.redirect('/?logged_out=true');
});

module.exports = router;