# API Configuration System

The DietIntel mobile app now supports configurable API endpoints to easily switch between different environments (DEV, STAGE, QA, PRODUCTION) and regions.

## Quick Start

### 1. Changing Default Environment

Edit `/mobile/config/environments.ts` and change the `DEFAULT_ENVIRONMENT` constant:

```typescript
// For Android emulator development
export const DEFAULT_ENVIRONMENT = 'android_dev';

// For iOS simulator development  
export const DEFAULT_ENVIRONMENT = 'ios_dev';

// For staging
export const DEFAULT_ENVIRONMENT = 'staging';

// For production
export const DEFAULT_ENVIRONMENT = 'production';
```

### 2. Runtime Environment Switching

In the mobile app:
1. Tap the ⚙️ settings icon in the header
2. Select "Test All Environments" to check connectivity
3. Choose an environment and tap "Switch"

### 3. Programmatic Switching

```typescript
import { apiService } from '../services/ApiService';

// Switch environments programmatically
apiService.switchEnvironment('staging');
apiService.switchEnvironment('production');

// Check current environment
const envInfo = apiService.getCurrentEnvironment();
console.log('Current environment:', envInfo.name, envInfo.config);
```

## Available Environments

| Environment | Description | Default URL |
|-------------|-------------|-------------|
| `dev` | Local development server | `http://localhost:8000` |
| `android_dev` | Android emulator development | `http://10.0.2.2:8000` |
| `ios_dev` | iOS simulator development | `http://localhost:8000` |
| `staging` | Staging environment | `https://staging-api.dietintel.com` |
| `qa` | QA testing environment | `https://qa-api.dietintel.com` |
| `production` | Production environment | `https://api.dietintel.com` |
| `eu_production` | European production server | `https://eu-api.dietintel.com` |
| `us_production` | US production server | `https://us-api.dietintel.com` |
| `asia_production` | Asia Pacific production server | `https://asia-api.dietintel.com` |

## Adding New Environments

1. Edit `/mobile/config/environments.ts`:

```typescript
export const environments: Record<string, EnvironmentConfig> = {
  // ... existing environments
  
  new_environment: {
    name: 'New Environment',
    apiBaseUrl: 'https://new-api.dietintel.com',
    description: 'Description of the new environment'
  }
};
```

2. The new environment will automatically appear in the configuration modal.

## API Service Features

The `ApiService` class provides:

- **Automatic Base URL Management**: Handles different base URLs per environment
- **Request/Response Logging**: Logs all API calls with environment info
- **Health Check**: Tests connectivity to any environment
- **Timeout Configuration**: 30s default, 45s for external OCR
- **Error Handling**: Consistent error handling across environments
- **Specific Method Support**: Pre-configured methods for all DietIntel endpoints

## Environment-Specific Setup

### Development (Local)

```bash
# Start the FastAPI backend
cd /path/to/DietIntel
python main.py

# The backend runs on http://localhost:8000
```

For Android emulator, use `android_dev` environment which maps to `http://10.0.2.2:8000`.
For iOS simulator, use `ios_dev` or `dev` environment which uses `http://localhost:8000`.

### Staging/QA

Update the URLs in `environments.ts` to match your actual staging/QA server URLs.

### Production

Before releasing:
1. Set `DEFAULT_ENVIRONMENT = 'production'` or appropriate regional server
2. Ensure production URLs are correct in `environments.ts`
3. Test connectivity using the configuration modal

## Security Considerations

- **No API Keys in Config**: The configuration only contains URLs, not sensitive data
- **HTTPS for Production**: All production environments should use HTTPS
- **Environment Validation**: The service validates environment existence and provides fallbacks
- **Request Logging**: Be mindful that API calls are logged (consider disabling in production)

## Troubleshooting

### Connection Issues

1. Use the configuration modal to test environment health
2. Check if the backend server is running on the expected port
3. For Android emulator, ensure you're using `10.0.2.2` instead of `localhost`
4. For network requests, ensure network permissions are configured in app.json

### Environment Not Switching

1. Check that the environment name exists in `environments.ts`
2. Verify the `apiService.switchEnvironment()` call is working
3. Look for console logs showing the environment switch

### API Calls Failing

1. Test the specific environment using the health check
2. Verify the backend API is running and accessible
3. Check for CORS issues if testing from simulator/emulator
4. Ensure the API endpoints match between frontend and backend

## Best Practices

1. **Use Different Environments for Different Purposes**:
   - `dev`/`android_dev`/`ios_dev` for local development
   - `staging` for feature testing
   - `qa` for quality assurance
   - `production` for live app

2. **Test Before Release**: Always test the target environment using the configuration modal

3. **Document Environment URLs**: Keep this README updated when adding new environments

4. **Monitor Health**: Regularly check environment health, especially for production

5. **Regional Deployment**: Use regional environments for better user experience

## Integration with CI/CD

You can set the default environment through environment variables during build:

```typescript
// In environments.ts
export const DEFAULT_ENVIRONMENT = process.env.EXPO_PUBLIC_API_ENVIRONMENT || 'android_dev';
```

Then in your build process:
```bash
# For staging build
EXPO_PUBLIC_API_ENVIRONMENT=staging expo build:android

# For production build  
EXPO_PUBLIC_API_ENVIRONMENT=production expo build:android
```