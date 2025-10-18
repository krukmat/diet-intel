const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts');
const i18next = require('./i18n');
const middleware = require('i18next-http-middleware');
require('dotenv').config();

// Import routes
const indexRoutes = require('./routes/index');
const feedRoutes = require('./routes/feed');
const planRoutes = require('./routes/plans');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const languageRoutes = require('./routes/language');
const profilesRouter = require('./routes/profiles');

// Import auth middleware
const { checkAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.DIETINTEL_API_URL || "http://localhost:8000"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// Middleware
app.use(compression());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// i18next middleware
app.use(middleware.handle(i18next));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');

// Global middleware to pass API URL and check authentication
app.use(checkAuth);
app.use((req, res, next) => {
  res.locals.apiUrl = process.env.DIETINTEL_API_URL || 'http://localhost:8000';
  res.locals.appName = 'DietIntel';
  res.locals.currentYear = new Date().getFullYear();
  res.locals.t = req.t; // Make translation function available to templates
  res.locals.i18n = req.i18n; // Make i18n object available to templates
  res.locals.req = req; // Make request object available to templates
  next();
});

// Routes
app.use('/', feedRoutes);
app.use('/', indexRoutes);
app.use('/plans', planRoutes);
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/language', languageRoutes);
app.use('/profiles', profilesRouter);

// Redirect /profile to /dashboard/profile for convenience
app.get('/profile', (req, res) => {
  res.redirect('/dashboard/profile');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    error: { status: 404, stack: '' }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong!' 
    : err.message;

  res.status(status).render('error', {
    title: 'Error',
    message: message,
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 DietIntel WebApp running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API URL: ${process.env.DIETINTEL_API_URL || 'http://localhost:8000'}`);
  });
}

module.exports = app;
