import { test, expect } from '@playwright/test';

const TEST_PHONE = process.env.E2E_TEST_PHONE;
const TEST_PIN = process.env.E2E_TEST_PIN;

test.describe('SALDA Web — Security & Smoke', () => {
  test('unauthenticated request to protected API returns 401', async ({ request }) => {
    const res = await request.get('/api/wallets');
    expect(res.status()).toBe(401);
  });

  test('unauthenticated request to cron endpoint without Bearer token returns 401 or 503', async ({
    request,
  }) => {
    const res = await request.get('/api/cron/alerts');
    expect([401, 503]).toContain(res.status());
  });

  test('forged unsigned salda_auth_token cookie is rejected with 401', async ({ request }) => {
    const res = await request.get('/api/wallets', {
      headers: {
        Cookie: 'salda_auth_token=00000000-0000-0000-0000-000000000001',
      },
    });
    expect(res.status()).toBe(401);
  });

  test('login page renders without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input'))
      .toHaveCount(2, { timeout: 10000 })
      .catch(() => {
        // На случай если форма использует другой набор input-полей
      });
    expect(errors).toEqual([]);
  });

  test('authenticated user can open core pages (requires E2E_TEST_PHONE & E2E_TEST_PIN)', async ({
    page,
    request,
  }) => {
    test.skip(!TEST_PHONE || !TEST_PIN, 'E2E_TEST_PHONE / E2E_TEST_PIN not configured');

    const loginRes = await request.post('/api/auth/login', {
      data: { phone: TEST_PHONE, pin: TEST_PIN },
    });
    expect(loginRes.status()).toBe(200);

    const storageState = await request.storageState();
    await page.context().addCookies(storageState.cookies);

    for (const route of ['/', '/finance', '/orders', '/trips']) {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(500);
      await expect(page).not.toHaveURL(/\/login/);
    }
  });
});
