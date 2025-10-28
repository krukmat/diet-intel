// EPIC_A.A1: Helper para montar app Express en tests (alta señal y reutilizable)
// RESTAURADO: Fix aplicado - eliminada express-ejs-layouts que causaba "requires a middleware function"

/**
 * Helper para crear app Express configurada para tests Jest
 * Incluye middleware, view engine, static files y router profiles
 */

// FIX CRÍTICO: Mockear middleware de autenticación ANTES de importar routers
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    const token = req.cookies.access_token;
    if (!token) {
      return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
    }
    res.locals.currentUser = { id: 'u1', full_name: 'Test User' };
    res.locals.isAuthenticated = true;
    next();
  },
  checkAuth: (req, res, next) => {
    const token = req.cookies.access_token;
    if (token) {
      res.locals.currentUser = { id: 'u1', full_name: 'Test User' };
      res.locals.isAuthenticated = true;
    } else {
      res.locals.currentUser = null;
      res.locals.isAuthenticated = false;
    }
    next();
  },
  redirectIfAuthenticated: (req, res, next) => {
    if (res.locals.isAuthenticated) {
      const redirectUrl = req.query.redirect || '/';
      return res.redirect(redirectUrl);
    }
    next();
  }
}));

// FIX CRÍTICO 2: Mockear utils/api ANTES de importar routers
jest.mock('../../utils/api', () => ({
  getProfile: jest.fn(),
  getCurrentUser: jest.fn(),
  updateProfile: jest.fn(),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  getBlockedUsers: jest.fn(),
  getBlockers: jest.fn(),
  getFeed: jest.fn(),
  getDiscoverFeed: jest.fn()
}));

function mountApp() {
  const express = require('express');
  const path = require('path');
  const cookieParser = require('cookie-parser');

  // Crear app
  const app = express();

  // Middleware básico (igual que app.js principal)
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // View engine setup (EJS solo, sin layouts para evitar complicaciones en tests)
  app.set('view engine', 'ejs');
  // FIX CRÍTICO: Ruta correcta a views desde tests/helpers (necesita subir 2 niveles)
  app.set('views', path.join(__dirname, '..', '..', 'views'));

  // Static files (CSS, JS, img) - ruta correcta
  app.use(express.static(path.join(__dirname, '..', '..', 'public')));

  // Middleware de autenticación simulado para tests
  // FIX: Respetar cookies de autenticación en lugar de autenticar siempre
  const mockAuthMiddleware = (req, res, next) => {
    const token = req.cookies.access_token;
    
    if (token) {
      // Simular usuario autenticado cuando hay cookie
      res.locals.currentUser = { id: 'u1', full_name: 'Test User' };
      res.locals.isAuthenticated = true;
    } else {
      // Usuario anónimo cuando no hay cookie
      res.locals.currentUser = null;
      res.locals.isAuthenticated = false;
    }
    next();
  };

  // Globals necesarios para vistas EJS
  app.use(mockAuthMiddleware); // Simular auth basado en cookies

  app.use((req, res, next) => {
    req.t = (key) => key; // Return key as-is for tests
    req.i18n = { language: 'en' };
    res.locals.t = req.t;
    res.locals.i18n = req.i18n;
    res.locals.req = req;
    res.locals.apiUrl = 'http://localhost:8000';
    res.locals.appName = 'DietIntel';
    res.locals.currentYear = new Date().getFullYear();
    next();
  });

  // Registrar routers de social (feeds y profiles)
  const profilesRouter = require('../../routes/profiles');
  const feedRouter = require('../../routes/feed');
  const analyticsRouter = require('../../routes/analytics');
  app.use('/profiles', profilesRouter);
  app.use('/analytics', analyticsRouter);
  app.use('/', feedRouter); // Feed routes under root path

  // Health route para tests
  app.get('/health', (req, res) => {
    res.json({ status: 'test' });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler para tests - captura errores y los imprime
  app.use((err, req, res, next) => {
    console.error('Test error handler:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message,
      stack: process.env.NODE_ENV === 'test' ? err.stack : undefined
    });
  });

  return app;
}

module.exports = { mountApp };
