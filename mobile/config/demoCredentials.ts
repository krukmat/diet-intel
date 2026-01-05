export interface DemoCredentials {
  email: string;
  password: string;
  enabled: boolean;
  showBanner: boolean;
}

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (typeof value === 'undefined') {
    return fallback;
  }
  return value.toLowerCase() !== 'false';
};

export const DEMO_CREDENTIALS: DemoCredentials = {
  email: process.env.EXPO_PUBLIC_DEMO_EMAIL || 'test@example.com',
  password: process.env.EXPO_PUBLIC_DEMO_PASSWORD || 'password123',
  enabled: parseBoolean(process.env.EXPO_PUBLIC_DEMO_ENABLED, true),
  showBanner: parseBoolean(process.env.EXPO_PUBLIC_DEMO_BANNER, true),
};
