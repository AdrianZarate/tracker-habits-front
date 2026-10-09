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

for (const width of [1440, 375]) {
  test(`local example ${width}px is reversible, keyboard accessible and never persists or requests data`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const dataRequests = [];
    page.on('request', request => {
      if (['fetch', 'xhr'].includes(request.resourceType())) dataRequests.push(request.url());
    });
    await page.goto(origin);
    const preview = page.getByRole('figure', { name: 'Vista ilustrativa · datos de ejemplo' });
    const rows = preview.getByRole('listitem');
    const names = ['Leer 10 minutos', 'Dar un paseo', 'Estirar al despertar'];
    const initial = [true, true, false];
    const history = preview.getByText('Ejemplo de registros completados: 12 y 13 de mayo.');
    await expect(preview.getByText('Datos de ejemplo. Puedes marcar/desmarcar; los cambios no se guardan ni pertenecen a tu cuenta.', { exact: true })).toHaveCount(0);
    const storage = await page.evaluate(() => {
      window.demoStorageWrites = [];
      for (const method of ['setItem', 'removeItem', 'clear']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (...args) {
          window.demoStorageWrites.push([method, ...args]);
          return original.apply(this, args);
        };
      }
      return [Object.entries(localStorage), Object.entries(sessionStorage)];
    });
    for (let i = 0; i < names.length; i++) {
      const row = rows.nth(i), checkbox = row.getByRole('checkbox', { name: names[i], exact: true });
      await expect(checkbox).toBeChecked({ checked: initial[i] });
      await expect(row.locator('.habit-status')).toHaveText(initial[i] ? 'Completado hoy' : 'Sin completar hoy');
      await expectContrast(row.locator('.habit-status'), row);
      if (initial[i]) await expectContrast(row.locator('.habit-circle'));
      const box = await row.locator('label').boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      const circle = row.locator('.habit-circle');
      expect((await circle.boundingBox()).width).toBe(28);
      await checkbox.focus();
      await page.keyboard.press('Space');
      await expect(checkbox).toBeChecked({ checked: !initial[i] });
      await expect(row.locator('.habit-status')).toHaveText(initial[i] ? 'Sin completar hoy' : 'Completado hoy');
      expect(await circle.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2);
      await page.keyboard.press('Space');
      await expect(checkbox).toBeChecked({ checked: initial[i] });
      await expect(row.locator('.habit-status')).toHaveText(initial[i] ? 'Completado hoy' : 'Sin completar hoy');
    }
    await rows.first().getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Empezar con Google' }).click();
    await page.keyboard.press('Escape');
    await expect(rows.first().getByRole('checkbox')).not.toBeChecked();
    await expect(history).toHaveText('Ejemplo de registros completados: 12 y 13 de mayo.');
    expect(dataRequests).toEqual([]);
    expect(await page.evaluate(() => window.demoStorageWrites)).toEqual([]);
    expect(await page.evaluate(() => [Object.entries(localStorage), Object.entries(sessionStorage)])).toEqual(storage);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(width === 1440 ? 'landing-interactive-example-desktop.png' : 'landing-interactive-example-mobile.png'), fullPage: true });
    await page.reload();
    for (let i = 0; i < names.length; i++) await expect(rows.nth(i).getByRole('checkbox')).toBeChecked({ checked: initial[i] });
    expect(dataRequests).toEqual([]);
  });
}

async function expectContrast(locator, surface = locator) {
  const foreground = await locator.evaluate(el => getComputedStyle(el).color);
  const background = await surface.evaluate(el => getComputedStyle(el).backgroundColor);
  const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number)
    .map(n => n / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
    .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  expect((values[0] + 0.05) / (values[1] + 0.05)).toBeGreaterThanOrEqual(4.5);
}

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
