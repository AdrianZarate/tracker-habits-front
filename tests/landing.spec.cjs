const path = require('node:path');
const { test, expect } = require(require.resolve('@playwright/test', {
  paths: [process.cwd(), ...process.env.PATH.split(path.delimiter).map(p => path.resolve(p, '..'))],
}));
const origin = 'http://127.0.0.1:4173';

test.beforeEach(async ({ page }) => {
  // Fresh Playwright contexts are signed out. Never contact OAuth or write API data.
  await page.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    return url.origin === origin && request.method() === 'GET' && !url.pathname.startsWith('/api')
      ? route.continue()
      : route.abort();
  });
});

test('public introduction, honest preview and login calls to action', async ({ page }) => {
  await page.goto(origin);
  await expect(page).toHaveURL(`${origin}/`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('HabitTracker');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Crea tus hábitos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Completa tu día' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Consulta tu historial' })).toBeVisible();
  await expect(page.getByText('Vista ilustrativa · datos de ejemplo')).toBeVisible();
  await expect(page.locator('#como-funciona ol > li')).toHaveCount(3);
  const ctas = page.getByRole('button', { name: /^(Iniciar sesión|Empezar con Google|Crear mi primer hábito)$/ });
  expect(await ctas.count()).toBeGreaterThanOrEqual(3);
  for (const cta of await ctas.all()) {
    await cta.click();
    await expect(page).toHaveURL(`${origin}/`);
    await expect(page.getByRole('dialog', { name: 'Iniciar sesión' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(cta).toBeFocused();
  }
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page).toHaveTitle(/HabitTracker/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /hábitos/);
  const favicon = await page.request.get(`${origin}/habit-tracker.svg`);
  expect(favicon.ok()).toBeTruthy();
});

test('responsive layout, skip link and keyboard navigation', async ({ page }) => {
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  }
  await page.goto(origin);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Saltar al contenido' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.goto(origin);
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Empezar con Google' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${origin}/`);
  await expect(page.getByRole('dialog', { name: 'Iniciar sesión' })).toBeVisible();
});

test('existing login, protected routes and wildcard keep their signed-out behavior', async ({ page }) => {
  for (const route of ['/login', '/dashboard', '/habits/example', '/not-a-route']) {
    await page.goto(`${origin}${route}`);
    await expect(page).toHaveURL(`${origin}/login`);
    const dialog = page.getByRole('dialog', { name: 'Iniciar sesión' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('#hero-title')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cerrar inicio de sesión' }).click();
    await expect(page).toHaveURL(`${origin}/`);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});
