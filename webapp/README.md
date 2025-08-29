# DietIntel WebApp

A responsive Express.js web application for viewing and managing DietIntel meal plans with beautiful UI and comprehensive meal plan details.

## Features

- 🍽️ **Meal Plan Viewer** - Detailed visualization of meal plans with nutritional breakdown
- 📊 **Interactive Charts** - Macronutrient distribution with Chart.js visualizations
- 🔍 **Barcode Lookup Demo** - Test barcode scanning directly in the browser
- 📸 **OCR Demo** - Upload nutrition labels for OCR processing
- 📱 **Responsive Design** - Works perfectly on desktop, tablet, and mobile devices
- 🎨 **Modern UI** - Built with Tailwind CSS for beautiful, consistent styling
- 🔗 **API Integration** - Seamless connection to DietIntel API backend
- ⚡ **Performance** - Fast loading with optimized assets and caching

## Screenshots

### Meal Plan Detail View
- Complete nutritional breakdown with macronutrient charts
- Interactive meal cards with expandable nutrition information
- Progress indicators for calorie targets
- Export and sharing functionality

### Meal Plans Dashboard
- Grid view of all meal plans with status indicators
- Search and filter capabilities
- Quick stats overview
- Plan management actions (duplicate, delete, edit)

## Tech Stack

### Backend
- **Express.js** - Fast, unopinionated web framework
- **EJS** - Embedded JavaScript templating
- **Helmet** - Security middleware
- **Morgan** - HTTP request logger
- **Compression** - Response compression middleware

### Frontend
- **Tailwind CSS** - Utility-first CSS framework
- **Chart.js** - Beautiful interactive charts
- **Vanilla JavaScript** - No heavy frameworks, pure performance
- **Responsive Design** - Mobile-first approach

### Development
- **Nodemon** - Auto-restart during development
- **ESLint** - Code linting and formatting
- **Jest** - Testing framework

## Quick Start

### Prerequisites
- Node.js 16+ and npm 8+
- DietIntel API running on `http://localhost:8000`

### Installation

1. **Navigate to webapp directory:**
   ```bash
   cd webapp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Open in browser:**
   ```
   http://localhost:3000
   ```

## Environment Configuration

```bash
# Server
PORT=3000
NODE_ENV=development

# DietIntel API
DIETINTEL_API_URL=http://localhost:8000
API_TIMEOUT=30000

# Security  
SESSION_SECRET=your-session-secret

# Features
ENABLE_DEMO_MODE=true
ENABLE_API_PROXY=true
```

## Project Structure

```
webapp/
├── app.js                 # Express app setup
├── package.json          # Dependencies and scripts
├── routes/               # Route handlers
│   ├── index.js         # Home and general routes
│   ├── plans.js         # Meal plan routes
│   └── api.js           # API proxy routes
├── views/               # EJS templates
│   ├── layout.ejs       # Base layout
│   ├── index.ejs        # Homepage
│   ├── error.ejs        # Error page
│   └── plans/           # Meal plan templates
│       ├── index.ejs    # Plans dashboard
│       ├── detail.ejs   # Plan detail view
│       └── new.ejs      # Create new plan
├── public/              # Static assets
│   ├── css/            # Stylesheets
│   ├── js/             # Client-side scripts
│   └── images/         # Images and icons
├── utils/              # Utilities
│   └── api.js          # DietIntel API client
└── middleware/         # Custom middleware
```

## API Integration

The webapp acts as a frontend for the DietIntel API with the following integrations:

### Meal Plan Management
- **GET /plans** - List all meal plans
- **GET /plans/:id** - View meal plan details  
- **POST /plans/generate** - Generate new meal plan
- **PUT /plans/customize/:id** - Customize existing plan
- **DELETE /plans/:id** - Delete meal plan

### Product Lookup
- **POST /api/barcode** - Barcode product lookup
- **POST /api/scan-label** - OCR nutrition label scanning
- **POST /api/scan-label-external** - External OCR processing

### Health & Monitoring
- **GET /api/health** - API connectivity check
- **GET /health** - WebApp health status

## Routes

### Public Routes
- **GET /** - Homepage with features and demos
- **GET /about** - About page
- **GET /docs** - API documentation

### Meal Plan Routes
- **GET /plans** - Meal plans dashboard
- **GET /plans/:id** - Detailed meal plan view
- **GET /plans/new** - Generate new meal plan form
- **POST /plans/generate** - Create new meal plan
- **GET /plans/generated** - Success page after generation

### API Proxy Routes
- **POST /api/barcode** - Proxy to DietIntel barcode endpoint
- **POST /api/scan-label** - Proxy to DietIntel OCR endpoint
- **GET /api/health** - Combined health check

## Development

### Available Scripts

```bash
# Development with auto-reload
npm run dev

# Production build
npm start

# Run tests
npm test

# Lint code
npm run lint

# Build CSS (if using Tailwind build process)
npm run build:css
```

### Development Workflow

1. **Start DietIntel API:**
   ```bash
   # In main project directory
   docker-compose up
   ```

2. **Start webapp in development mode:**
   ```bash
   cd webapp
   npm run dev
   ```

3. **Make changes to code** - Server auto-restarts with nodemon

4. **Test in browser** - Navigate to `http://localhost:3000`

### Adding New Features

1. **Create route handler** in appropriate file in `/routes`
2. **Add EJS template** in `/views` directory
3. **Update navigation** in `views/layout.ejs`
4. **Add API integration** in `utils/api.js` if needed
5. **Test functionality** and update documentation

## Deployment

### Docker Deployment

The webapp can be deployed alongside the main DietIntel API using Docker:

```bash
# From main project directory
docker-compose up --build
```

### Standalone Deployment

For deploying just the webapp:

```bash
# Build production version
npm run build

# Start production server
NODE_ENV=production npm start
```

### Environment Variables for Production

```bash
NODE_ENV=production
PORT=3000
DIETINTEL_API_URL=https://api.dietintel.com
SESSION_SECRET=your-super-secret-key
RATE_LIMIT_MAX_REQUESTS=1000
```

## Security Features

- **Helmet.js** - Sets various HTTP headers for security
- **Rate Limiting** - Prevents API abuse
- **Input Validation** - Server-side validation with express-validator
- **CORS Protection** - Controlled cross-origin requests
- **Environment Secrets** - Secure configuration management

## Performance

- **Response Compression** - Gzip compression for all responses
- **Static Asset Serving** - Efficient serving of CSS, JS, and images
- **Connection Pooling** - Efficient API connections
- **Caching Headers** - Browser caching for static assets

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow existing code style and patterns
2. Add tests for new features
3. Update documentation
4. Test across different browsers
5. Ensure responsive design works on mobile

## Troubleshooting

### Common Issues

**WebApp can't connect to API:**
- Check `DIETINTEL_API_URL` in `.env`
- Verify DietIntel API is running
- Check firewall/network settings

**Styles not loading:**
- Ensure Tailwind CSS CDN is accessible
- Check Content Security Policy settings
- Verify static file serving

**Charts not displaying:**
- Check Chart.js CDN is accessible
- Verify data format in templates
- Check browser console for errors

### Debug Mode

Enable debug logging:
```bash
DEBUG=dietintel:* npm run dev
```

This will show detailed request/response logging for troubleshooting.

## License

MIT License - See main project LICENSE file.