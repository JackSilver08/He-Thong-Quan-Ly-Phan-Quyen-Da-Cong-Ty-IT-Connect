import { test, expect } from '@playwright/test';

test('unauthenticated users are sent to login', async ({ page }) => {
  await page.goto('/users');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
});

test('administrator can sign in and open core pages', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill(process.env.E2E_USERNAME || 'admin');
  await page.locator('input[autocomplete="current-password"]').fill(process.env.E2E_PASSWORD || 'Admin@123456');
  await page.getByRole('button', { name: 'Enter' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  for (const path of ['/users', '/companies', '/projects', '/permissions', '/resigned', '/audit']) {
    await page.goto(path);
    await expect(page.locator('body')).not.toContainText('Application error');
  }
});
