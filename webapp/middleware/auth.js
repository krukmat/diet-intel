const axios = require('axios');

/**
 * Authentication middleware for webapp routes
 */

const API_BASE_URL = process.env.DIETINTEL_API_URL || 'http://localhost:8000';

// Middleware to check if user is authenticated
const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies.access_token;
    
    if (!token) {
      return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
    }

    // Verify token with backend API
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Store user data in res.locals for templates
    res.locals.currentUser = response.data;
    res.locals.isAuthenticated = true;
    
    next();
  } catch (error) {
    // Token is invalid, clear it and redirect to login
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
};

// Middleware to check auth status without requiring it
const checkAuth = async (req, res, next) => {
  try {
    const token = req.cookies.access_token;
    
    if (!token) {
      res.locals.isAuthenticated = false;
      res.locals.currentUser = null;
      return next();
    }

    // Verify token with backend API
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    res.locals.currentUser = response.data;
    res.locals.isAuthenticated = true;
  } catch (error) {
    // Token is invalid, clear it
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.locals.isAuthenticated = false;
    res.locals.currentUser = null;
  }
  
  next();
};

// Middleware to redirect authenticated users away from auth pages
const redirectIfAuthenticated = (req, res, next) => {
  if (res.locals.isAuthenticated) {
    const redirectUrl = req.query.redirect || '/';
    return res.redirect(redirectUrl);
  }
  next();
};

// Helper function to refresh token if needed
const refreshTokenIfNeeded = async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    
    if (!refreshToken) {
      return false;
    }

    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken
    });

    // Set new tokens as cookies
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

    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  requireAuth,
  checkAuth,
  redirectIfAuthenticated,
  refreshTokenIfNeeded
};