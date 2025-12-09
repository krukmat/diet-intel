// Re-export from environments for backwards compatibility
import { getEnvironmentConfig } from './environments';

const config = getEnvironmentConfig();
export const API_BASE_URL = config.apiBaseUrl;