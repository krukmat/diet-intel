# Configuration

This document is the canonical index for configuration across the DietIntel stack.

## Backend (FastAPI)

- Environment variables: `docs/ENVIRONMENT_VARIABLES.md`
- Local dev stack: `scripts/start-dev.sh` and `.env.example`

## Mobile (React Native)

- API environments and switching: `mobile/README_API_CONFIG.md`
- Demo login credentials (build-time overrides):
  - `EXPO_PUBLIC_DEMO_EMAIL`
  - `EXPO_PUBLIC_DEMO_PASSWORD`
  - `EXPO_PUBLIC_DEMO_ENABLED`
  - `EXPO_PUBLIC_DEMO_BANNER`

## Notes

- Never commit real credentials; keep them in `.env` or Expo build secrets.
- For Android emulator, the backend host should be `10.0.2.2` (not `localhost`).

