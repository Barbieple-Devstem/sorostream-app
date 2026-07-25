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

## Project Structure

```
sorostream-app/
├── components/          # Reusable UI components
│   ├── ui/              # Base UI components (buttons, inputs, etc.)
│   └── __tests__/       # Component tests
├── src/
│   ├── app/             # Next.js App Router pages
│   │   ├── dashboard/   # Dashboard page with stream list
│   │   ├── stream/      # Stream creation and detail pages
│   │   └── settings/    # User settings page
│   ├── components/      # Page-specific components
│   ├── context/         # React context providers (wallet, bookmarks, etc.)
│   ├── lib/             # Utility functions and business logic
│   │   └── __tests__/   # Unit tests for utilities
│   └── locales/         # i18n translation files
├── e2e/                 # Playwright end-to-end tests
└── public/              # Static assets
```

## Component Conventions

### File Organization

- **Colocation**: Keep components close to where they're used
  - Page-specific components go in `src/app/[page]/components/`
  - Shared components go in `components/`
  - Utility functions go in `src/lib/`

- **Naming**:
  - Use PascalCase for component files: `StreamCard.tsx`
  - Use kebab-case for utility files: `stream-utils.ts`
  - Test files should be `__tests__/filename.test.ts` or `filename.test.ts`

### Component Structure

```tsx
"use client"; // Add if component uses hooks or browser APIs

import { useState, useEffect } from "react";

interface ComponentProps {
  // Define props interface
}

export default function Component({ prop }: ComponentProps) {
  // Component logic
  
  return (
    <div className="...">
      {/* JSX */}
    </div>
  );
}
```

### Styling Conventions

- Use Tailwind CSS for all styling
- Follow the existing color scheme (gray-900 background, green-700 accents)
- Ensure all components are mobile-responsive
- Use semantic HTML elements
- Include proper ARIA labels for accessibility

## Testing

### Unit Tests

- **Required for**: All utility functions in `src/lib/`
- **Framework**: Vitest
- **Location**: `src/lib/__tests__/` or alongside the file
- **Run**: `npm run test` or `npm run test:ui`

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:ui

# Run tests once
npm run test:run
```

Example test structure:
```ts
import { describe, it, expect } from "vitest";

describe("Utility Function", () => {
  it("should handle valid input", () => {
    expect(functionName(input)).toBe(expected);
  });

  it("should handle edge cases", () => {
    expect(functionName(edgeCase)).toBe(expected);
  });
});
```

### End-to-End Tests

- **Required for**: New user flows and critical paths
- **Framework**: Playwright
- **Location**: `e2e/`
- **Run**: `npm run test:e2e` or `npm run test:e2e:ui`

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

### Test Coverage Requirements

- **Utility functions**: 100% coverage for core logic
- **Components**: Test critical paths and user interactions
- **New features**: At least one E2E test for the main user flow

## Contributing Translations (i18n)

We support multi-language (i18n) localization to make SoroStream accessible to communities around the world.

To contribute new translations or fix existing ones:
1. **Locale Files Location:** All translations are stored as JSON files under `src/locales/`.
2. **Adding a Language:** Create a new JSON file named after the language's ISO 639-1 code (e.g., `fr.json` for French, `zh.json` for Chinese). Use `src/locales/en.json` as the base template.
3. **Registering the Language:** Add your language option to the `<select>` dropdown inside `src/app/settings/page.tsx`.
4. **Validation:** Run `npm run lint` to verify that all translation keys are fully aligned. The translation validation script will automatically check and fail if any keys are missing compared to `en.json`.

## PR Checklist

Before submitting your PR, ensure:

- [ ] Code follows the project structure and naming conventions
- [ ] All tests pass (`npm run test` and `npm run test:e2e`)
- [ ] Build succeeds (`npm run build`)
- [ ] Linting passes (`npm run lint`)
- [ ] Components are mobile-responsive
- [ ] Accessibility requirements are met (ARIA labels, keyboard navigation)
- [ ] Translation keys are added/updated if UI text changed

## Getting Help

- Check existing issues for similar problems
- Review the codebase for examples of similar implementations
- Ask questions in the PR description if something is unclear

