# Contributing to sorostream-app

Thank you for your interest! This repo participates in the **Stellar Wave Program** on [Drips Wave](https://drips.network/wave).

## Wave Contributor Workflow

1. **Browse open issues** — pick one labelled `Stellar Wave`.
2. **Apply via Drips Wave** — do **not** begin coding until assigned by the maintainer.
3. **Fork & branch** — `feat/N-description` or `fix/N-description`.
4. **Code** — `npm run build` must pass. All layouts must be mobile responsive.
5. **PR** — title references the issue, body includes `Closes #N`.

## Local Setup

```bash
cp .env.example .env.local
# Fill in your contract ID and network

npm install
npm run dev    # http://localhost:3000
npm run build  # verify production build
npm run lint   # ESLint check
```
## Env Vars

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` or `mainnet` |
| `NEXT_PUBLIC_CONTRACT_ID` | Deployed StreamContract address |
| `NEXT_PUBLIC_RPC_URL` | Soroban RPC endpoint |

## Contributing Translations (i18n)

We support multi-language (i18n) localization to make SoroStream accessible to communities around the world.

To contribute new translations or fix existing ones:
1. **Locale Files Location:** All translations are stored as JSON files under [src/locales/](file:///home/jerry/Documents/sorostream-app/src/locales/).
2. **Adding a Language:** Create a new JSON file named after the language's ISO 639-1 code (e.g., `fr.json` for French, `zh.json` for Chinese). Use [src/locales/en.json](file:///home/jerry/Documents/sorostream-app/src/locales/en.json) as the base template.
3. **Registering the Language:** Add your language option to the `<select>` dropdown inside [src/app/settings/page.tsx](file:///home/jerry/Documents/sorostream-app/src/app/settings/page.tsx).
4. **Validation:** Run `npm run lint` to verify that all translation keys are fully aligned. The translation validation script will automatically check and fail if any keys are missing compared to `en.json`.

