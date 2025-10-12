// EPIC_A.A1: Helper para montar app Express en tests (alta señal y reutilizable)
// RESTAURADO: Fix aplicado - eliminada express-ejs-layouts que causaba "requires a middleware function"

/**
 * Helper para crear app Express configurada para tests Jest
 * Incluye middleware, view engine, static files y router profiles
 */
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
  app.set('views', path.join(__dirname, '..', 'views')); // Correcta ruta relativa desde tests

  // Static files (CSS, JS, img) - ruta correcta
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Globals necesarios para vistas EJS
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

  // Registrar router profiles (solo para rutas de perfil)
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
