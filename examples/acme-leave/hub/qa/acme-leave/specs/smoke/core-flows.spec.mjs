// Smoke: one core flow per role, read-only (nothing is created or changed). Safe on any environment.
import { test, expect, loginPage } from '../../../../lib/qa.mjs';

test.describe('acme-leave core flows', () => {
  test('the app is up', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);
  });

  test('employee sees their balance and their requests', async ({ page, appName }) => {
    await loginPage(page, appName, 'employee');
    await expect(page.getByTestId('remaining')).toHaveText(/^-?\d+$/);
    await expect(page.getByTestId('my-requests')).toBeVisible();
    await expect(page.getByTestId('nav-team')).toBeHidden();
  });

  test('manager can open the team list', async ({ page, appName }) => {
    await loginPage(page, appName, 'manager');
    await page.getByTestId('nav-team').click();
    await expect(page.getByTestId('team-requests')).toBeVisible();
  });
});
