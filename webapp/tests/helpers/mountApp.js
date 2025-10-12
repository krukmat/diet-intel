// EPIC_A.A1: Helper para montar app Express en tests (alta señal y reutilizable)

/**
 * Helper para crear app Express configurada para tests Jest
 * Incluye middleware, view engine, static files y router profiles
 */
function mountApp() {
  const express = require('express');
  const path = require('path');
  const { expressLayouts } = require('express-ejs-layouts');
  const cookieParser = require('cookie-parser');

  // Crear app
  const app = express();

  // Middleware básico (igual que app.js principal)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // View engine setup (EJS + layouts)
  app.use(expressLayouts);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../..', 'views'));
  app.set('layout', 'layout');

  // Static files (CSS, JS, img)
  app.use(express.static(path.join(__dirname, '../..', 'public')));

  // i18n mock mínimo para tests
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

  // Registrar router profiles
  const profilesRouter = require('../../routes/profiles');
  app.use('/profiles', profilesRouter);

  // Health route para tests
  app.get('/health', (req, res) => {
    res.json({ status: 'test' });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

module.exports = { mountApp };
