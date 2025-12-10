# Translation Provider Options (2025-09-26 00:04)

## Objective
Evaluate free or near-free translation providers that can restore Spanish output without immediate paid subscriptions.

## Findings
- `deep_translator` ship with multiple providers, but under sandbox constraints outbound HTTPS is blocked; any provider requiring live HTTP requests (Google, Linguee, MyMemory) fails.
- Free API-based providers (Microsoft/Azure Translator, Yandex) require API keys even for limited free tiers. Without credentials, calls fail immediately.
- Offline dictionary-based approaches (our new fallback) work without network but only handle limited vocabulary.

## Options
1. **Activate Free Tier with API Keys**
   - Microsoft Translator: free tier ~2M chars/month. Needs `MICROSOFT_API_KEY` + `MICROSOFT_REGION`. Sign up at Azure portal.
   - Yandex Translate: offers free tier with OAuth token (`YANDEX_API_KEY`). Sign up at Yandex Cloud.
   - Implementation: store keys in environment (.env / deployment secrets), update translation service to prioritize configured provider.

2. **Proxy through Open Source APIs**
   - Use LibreTranslate (self-hostable) which provides open endpoints. Could run container inside infrastructure and call it without leaving network. Free but requires deployment.

3. **Embed Open Glossary + Hybrid Approach**
   - Expand dictionary coverage (ongoing). Combine with limited offline phrase templates to improve user experience until online providers configured.

## Recommendation
Pursue Option 1 (Microsoft Translator free tier) for production parity while maintaining offline fallback. Document operational steps:
1. Register Azure account, create Translator resource.
2. Store keys as `MICROSOFT_API_KEY` and `MICROSOFT_REGION` in deployment.
3. Update deployment scripts/k8s secrets accordingly.
4. Monitor usage to stay within free quota.

## Next Actions
- Await confirmation to proceed with Azure free tier setup or explore self-hosted LibreTranslate container.
- Once credentials available, update config and add integration tests hitting mocked provider with API key path.
