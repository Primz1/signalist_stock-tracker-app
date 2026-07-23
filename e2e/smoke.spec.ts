import { test, expect } from '@playwright/test';

test('sign-in page loads', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
});
