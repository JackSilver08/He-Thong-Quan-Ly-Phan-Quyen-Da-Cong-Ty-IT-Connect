/// <reference types="node" />
import process from 'node:process';
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
  await expect(page.getByRole('heading', { name: /Bảng điều khiển|Dashboard/i })).toBeVisible();

  for (const path of ['/users', '/companies', '/projects', '/permissions', '/resigned', '/audit']) {
    await page.goto(path);
    await expect(page.locator('body')).not.toContainText('Application error');
  }
});

test('regular user signs in and opens personal access portal without errors', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill('cs.phuc');
  await page.locator('input[autocomplete="current-password"]').fill('User@123456');
  await page.getByRole('button', { name: 'Enter' }).click();

  await expect(page).toHaveURL(/\/my-access/);
  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.locator('body')).toContainText('Cao Sỹ Phúc');
  // Đảm bảo không bị bắn toast lỗi quyền truy cập
  await expect(page.locator('.toast-error')).toHaveCount(0);
});

test('regular user attempting to visit admin routes is redirected to my-access', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill('cs.phuc');
  await page.locator('input[autocomplete="current-password"]').fill('User@123456');
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(page).toHaveURL(/\/my-access/);

  // Thử truy cập trang quản trị nhân viên
  await page.goto('/users');
  await expect(page).toHaveURL(/\/my-access/);
  await expect(page.locator('.toast-error')).toHaveCount(0);
});

