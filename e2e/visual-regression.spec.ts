import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for the dashboard in light and dark themes.
 *
 * Uses Playwright's built-in screenshot comparison. On first run the snapshots
 * are written to e2e/snapshots/. Subsequent runs diff against those baselines.
 * Update baselines with: npx playwright test --update-snapshots visual-regression
 */

async function setTheme(page: import('@playwright/test').Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(t);
    document.documentElement.style.colorScheme = t;
  }, theme);
}

test.describe('Dashboard visual regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard and let it settle before taking snapshots
    await page.goto('/dashboard');
    // Wait for any loading skeletons to resolve
    await page.waitForTimeout(800);
  });

  test('dashboard matches snapshot in dark theme', async ({ page }) => {
    await setTheme(page, 'dark');
    await page.reload();
    await page.waitForTimeout(800);

    await expect(page).toHaveScreenshot('dashboard-dark.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('dashboard matches snapshot in light theme', async ({ page }) => {
    await setTheme(page, 'light');
    await page.reload();
    await page.waitForTimeout(800);

    await expect(page).toHaveScreenshot('dashboard-light.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('nav header matches snapshot in dark theme', async ({ page }) => {
    await setTheme(page, 'dark');
    await page.reload();

    const nav = page.locator('header').first();
    await expect(nav).toHaveScreenshot('nav-dark.png', {
      animations: 'disabled',
    });
  });

  test('nav header matches snapshot in light theme', async ({ page }) => {
    await setTheme(page, 'light');
    await page.reload();

    const nav = page.locator('header').first();
    await expect(nav).toHaveScreenshot('nav-light.png', {
      animations: 'disabled',
    });
  });

  test('theme toggle switches between light and dark', async ({ page }) => {
    await setTheme(page, 'dark');
    await page.reload();
    await page.waitForTimeout(400);

    // Take a baseline of the dark state
    const darkClass = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(darkClass).toBe(true);

    // Click the theme toggle
    const themeToggle = page.getByRole('button', { name: /toggle theme|light mode|dark mode/i });
    await themeToggle.click();

    // After toggle the class should switch
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('light')))
      .toBe(true);
  });
});
