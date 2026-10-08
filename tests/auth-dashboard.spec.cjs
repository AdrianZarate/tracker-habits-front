const path = require('node:path');
const { test: base, expect } = require(require.resolve('@playwright/test', {
  paths: [process.cwd(), ...process.env.PATH.split(path.delimiter).map(p => path.resolve(p, '..'))],
}));
const origin = 'http://127.0.0.1:4173';
const session = {
  _id: 'mock-user', fullName: 'Usuario de prueba', email: 'mock@example.invalid',
  roles: ['user'], token: 'renewed-mock-token',
};

// Only static frontend GETs reach the server. All API responses are synthetic;
// unexpected requests (including OAuth and API writes) are blocked, never forwarded.
const test = base.extend({
  mockApi: [async ({ page }, use) => {
    const api = {
      calls: [], unexpected: [], status: 200, session,
      habits: [{ habitId: 'read', title: 'Leer', slug: 'leer' }],
      logs: [], beforeStatus: async () => {},
    };
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (['fetch', 'xhr'].includes(request.resourceType())) {
        const endpoint = ['/auth/check-status', '/habits/logs', '/habits']
          .find(suffix => url.pathname.endsWith(suffix));
        const method = request.method();
        api.calls.push({ endpoint, method, authorization: request.headers().authorization });
        const headers = { 'access-control-allow-origin': origin };
        if (method === 'GET' && endpoint === '/auth/check-status') {
          await api.beforeStatus();
          return route.fulfill({ status: api.status, json: api.session, headers });
        }
        if (method === 'GET' && endpoint === '/habits/logs') {
          return route.fulfill({ json: api.logs, headers });
        }
        if (method === 'GET' && endpoint === '/habits') {
          return route.fulfill({ json: api.habits, headers });
        }
        if (method === 'POST' && endpoint === '/habits') {
          api.createdPayload = request.postDataJSON();
          api.habits = [...api.habits, { habitId: 'walk', title: api.createdPayload.title }];
          api.logs = [{ habitId: 'walk', date: new Date().toISOString(), completed: true }];
          return route.fulfill({ status: 201, json: {
            _id: 'mock-created', habitId: 'walk', userId: 'mock-user', active: true,
          }, headers });
        }
        api.unexpected.push(`${method} ${url.pathname}`);
        return route.abort();
      }
      if (url.origin === origin && request.method() === 'GET' && !url.pathname.startsWith('/api')) {
        return route.continue();
      }
      return route.abort();
    });
    await use(api);
    expect(api.unexpected, 'No unhandled API request may reach a real server').toEqual([]);
  }, { auto: true }],
});

async function storeSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'stored-mock-token');
    localStorage.setItem('fullName', 'Nombre anterior');
    localStorage.setItem('email', 'old@example.invalid');
    localStorage.setItem('picture', 'mock-picture');
  });
}

function callsFor(api, endpoint, method = 'GET') {
  return api.calls.filter(call => call.endpoint === endpoint && call.method === method);
}

function habitRow(page, title) {
  return page.getByRole('listitem').filter({ has: page.getByText(title, { exact: true }) });
}

test('no stored token redirects protected routes without status or habit requests', async ({ page, mockApi }) => {
  for (const route of ['/dashboard', '/habits/example']) {
    await page.goto(`${origin}${route}`);
    await expect(page).toHaveURL(`${origin}/login`);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión', exact: true })).toBeVisible();
  }
  expect(mockApi.calls).toEqual([]);
});

test('stored token is validated before dashboard restore and renewed for data requests', async ({ page, mockApi }) => {
  await storeSession(page);
  let release;
  const pendingStatus = new Promise(resolve => { release = resolve; });
  mockApi.beforeStatus = () => pendingStatus;
  try {
    await page.goto(`${origin}/dashboard`);
    await expect.poll(() => callsFor(mockApi, '/auth/check-status').length).toBeGreaterThan(0);
    await expect(page.locator('.animate-spin')).toBeVisible();
    expect(callsFor(mockApi, '/habits')).toHaveLength(0);
    await expect(page.getByText('Estos son tus hábitos diarios')).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByText(session.fullName, { exact: true })).toBeVisible();
  await expect(habitRow(page, 'Leer')).toBeVisible();
  expect(callsFor(mockApi, '/auth/check-status').every(call => call.authorization === 'Bearer stored-mock-token')).toBeTruthy();
  expect(callsFor(mockApi, '/habits').every(call => call.authorization === 'Bearer renewed-mock-token')).toBeTruthy();
  expect(await page.evaluate(() => ({
    token: localStorage.getItem('token'), fullName: localStorage.getItem('fullName'), email: localStorage.getItem('email'),
  }))).toEqual({ token: session.token, fullName: session.fullName, email: session.email });
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/login`);
  expect(await page.evaluate(() => ['token', 'fullName', 'email', 'picture'].map(key => localStorage.getItem(key)))).toEqual([null, null, null, null]);
});

test('failed stored-session validation clears session and finishes loading', async ({ page, mockApi }) => {
  await storeSession(page);
  // A non-401 rejection exercises provider catch/finally, not Axios hard navigation.
  mockApi.status = 403;
  mockApi.session = { message: 'Invalid mock session' };
  await page.goto(`${origin}/dashboard`);
  await expect(page).toHaveURL(`${origin}/login`);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión', exact: true })).toBeVisible();
  expect(callsFor(mockApi, '/auth/check-status').length).toBeGreaterThan(0);
  expect(callsFor(mockApi, '/habits')).toHaveLength(0);
  expect(await page.evaluate(() => ['token', 'fullName', 'email', 'picture'].map(key => localStorage.getItem(key)))).toEqual([null, null, null, null]);
});

test('dashboard joins today logs and refreshes habits and logs after mocked creation', async ({ page, mockApi }) => {
  await storeSession(page);
  const today = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  mockApi.habits.push({ habitId: 'sleep', title: 'Dormir' }, { habitId: 'water', title: 'Beber agua' });
  mockApi.logs = [
    { habitId: 'read', date: today, completed: true },
    { habitId: 'sleep', date: yesterday, completed: true },
    { habitId: 'water', date: today, completed: false },
  ];
  await page.goto(`${origin}/dashboard`);
  await expect(habitRow(page, 'Leer').getByRole('button', { name: '✓ Hecho', exact: true })).toBeVisible();
  for (const title of ['Dormir', 'Beber agua']) {
    await expect(habitRow(page, title).getByRole('button', { name: 'Completar', exact: true })).toBeVisible();
  }
  const initialHabits = callsFor(mockApi, '/habits').length;
  const initialLogs = callsFor(mockApi, '/habits/logs').length;
  expect(initialHabits).toBeGreaterThan(0);
  expect(initialLogs).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Nuevo hábito', exact: true }).click();
  await page.getByPlaceholder('Ej. Meditar 10 minutos').fill('Caminar');
  await page.getByRole('button', { name: 'Crear hábito', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo hábito', exact: true })).toHaveCount(0);
  await expect(habitRow(page, 'Caminar').getByRole('button', { name: '✓ Hecho', exact: true })).toBeVisible();
  await expect(habitRow(page, 'Leer').getByRole('button', { name: 'Completar', exact: true })).toBeVisible();
  expect(mockApi.createdPayload).toEqual({ title: 'Caminar' });
  expect(callsFor(mockApi, '/habits', 'POST')).toHaveLength(1);
  expect(callsFor(mockApi, '/habits').length).toBeGreaterThan(initialHabits);
  expect(callsFor(mockApi, '/habits/logs').length).toBeGreaterThan(initialLogs);
});
