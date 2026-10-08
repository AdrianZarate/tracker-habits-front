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
      calls: [], unexpected: [], status: 200, createStatus: 201, session,
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
          if (api.createStatus !== 201) return route.fulfill({ status: api.createStatus, json: { message: 'Synthetic error' }, headers });
          api.habits = [...api.habits, { habitId: 'walk', ...api.createdPayload }];
          api.logs = [{ habitId: 'walk', date: new Date().toISOString(), completed: true }];
          return route.fulfill({ status: 201, json: {
            _id: 'mock-created', habitId: 'walk', userId: 'mock-user', active: true,
          }, headers });
        }
        if (method === 'POST' && /\/habits\/[^/]+\/complete$/.test(url.pathname)) {
          return route.fulfill({ json: { _id: 'synthetic', habitId: 'read', date: new Date().toISOString(), completed: true }, headers });
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
  expect(mockApi.createdPayload).toEqual({ title: 'Caminar', configuration: {
    schedule: { kind: 'daily' }, goal: { kind: 'checkbox' },
  } });
  expect(callsFor(mockApi, '/habits', 'POST')).toHaveLength(1);
  expect(callsFor(mockApi, '/habits').length).toBeGreaterThan(initialHabits);
  expect(callsFor(mockApi, '/habits/logs').length).toBeGreaterThan(initialLogs);
});

async function openCreate(page) {
  await storeSession(page);
  await page.goto(`${origin}/dashboard`);
  await page.getByRole('button', { name: 'Nuevo hábito', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('  Leer por la noche  ');
}

test('create sends trimmed personal metadata and complete selected-weekday quantity configuration', async ({ page, mockApi }) => {
  await openCreate(page);
  await page.getByLabel('Categoría', { exact: true }).fill('  Aprendizaje  ');
  await page.getByLabel('Color', { exact: true }).fill('  #Ab12Ef  ');
  await page.getByLabel('Icono', { exact: true }).fill(' book ');
  await page.getByLabel('Frecuencia', { exact: true }).selectOption('weekdays');
  await page.getByLabel('Lunes', { exact: true }).check();
  await page.getByLabel('Lunes', { exact: true }).uncheck();
  await page.getByLabel('Lunes', { exact: true }).check();
  await page.getByLabel('Domingo', { exact: true }).check();
  await page.getByLabel('Tipo de objetivo', { exact: true }).selectOption('quantity');
  await page.getByLabel('Cantidad objetivo', { exact: true }).fill('20.5');
  await page.getByLabel('Unidad', { exact: true }).fill(' páginas ');
  await page.getByRole('button', { name: 'Crear hábito', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(mockApi.createdPayload).toEqual({ title: 'Leer por la noche', category: 'Aprendizaje', color: '#Ab12Ef', icon: 'book',
    configuration: { schedule: { kind: 'weekdays', days: [1, 7] }, goal: { kind: 'quantity', target: 20.5, unit: 'páginas' } } });
  const row = habitRow(page, 'Leer por la noche');
  await expect(row).toContainText('Aprendizaje');
  await expect(row).toContainText('Lunes, Domingo');
  await expect(row).toContainText('20.5 páginas por día');
  await expect(row.getByRole('button', { name: 'Registro de cantidad pendiente', exact: true })).toBeDisabled();
});

test('weekly create rejects invalid fields locally and retains values after recoverable API error', async ({ page, mockApi }) => {
  await openCreate(page);
  const submit = page.getByRole('button', { name: 'Crear hábito', exact: true });
  const noPost = () => expect(callsFor(mockApi, '/habits', 'POST')).toHaveLength(0);
  for (const [label, invalid, valid] of [
    ['Título', '  ab  ', 'Leer por la noche'],
    ['Título', 'a'.repeat(201), 'Leer por la noche'],
    ['Categoría', 'a'.repeat(81), 'Lectura'],
    ['Color', 'red', '#123abc'],
    ['Icono', 'a'.repeat(65), 'book'],
  ]) {
    await page.getByLabel(label, { exact: true }).fill(invalid);
    await submit.click();
    await expect(page.getByRole('alert')).toBeVisible();
    noPost();
    await page.getByLabel(label, { exact: true }).fill(valid);
  }
  await page.getByLabel('Frecuencia', { exact: true }).selectOption('weekdays');
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('Selecciona al menos un día');
  noPost();
  await page.getByLabel('Frecuencia', { exact: true }).selectOption('weekly');
  for (const invalid of ['0', '8', '1.5']) {
    await page.getByLabel('Días por semana', { exact: true }).fill(invalid);
    await submit.click();
    await expect(page.getByRole('alert')).toContainText('entre 1 y 7');
    noPost();
  }
  await page.getByLabel('Días por semana', { exact: true }).fill('7');
  await page.getByLabel('Tipo de objetivo', { exact: true }).selectOption('quantity');
  for (const invalid of ['0', '-1', '1000000001', '']) {
    await page.getByLabel('Cantidad objetivo', { exact: true }).fill(invalid);
    await submit.click();
    await expect(page.getByRole('alert')).toContainText('cantidad');
    noPost();
  }
  await page.getByLabel('Cantidad objetivo', { exact: true }).fill('1000000000');
  for (const invalid of ['   ', 'a'.repeat(33)]) {
    await page.getByLabel('Unidad', { exact: true }).fill(invalid);
    await submit.click();
    await expect(page.getByRole('alert')).toContainText('unidad');
    noPost();
  }
  await page.getByLabel('Unidad', { exact: true }).fill('páginas');
  mockApi.createStatus = 500;
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('No se pudo crear');
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Leer por la noche');
  mockApi.createStatus = 201;
  await submit.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(mockApi.createdPayload.configuration).toEqual({ schedule: { kind: 'weekly', timesPerWeek: 7 },
    goal: { kind: 'quantity', target: 1000000000, unit: 'páginas' } });
});

test('quantity and inactive cards never invoke binary completion; unknown icon has a safe fallback', async ({ page, mockApi }) => {
  mockApi.habits = [{ habitId: 'read', title: 'Lectura medida', category: 'Libros', color: '#123abc', icon: '__proto__',
    configuration: { schedule: { kind: 'weekly', timesPerWeek: 3 }, goal: { kind: 'quantity', target: 20, unit: 'páginas' } } },
    { habitId: 'paused', title: 'Pausado', active: true, status: 'paused' }];
  await storeSession(page);
  await page.goto(`${origin}/dashboard`);
  const row = habitRow(page, 'Lectura medida');
  await expect(row).toContainText('3 días por semana');
  await expect(row.getByRole('button', { name: 'Registro de cantidad pendiente', exact: true })).toBeDisabled();
  await expect(row.locator('svg[data-habit-icon="fallback"]')).toHaveCount(1);
  await expect(habitRow(page, 'Pausado').getByRole('button', { name: 'Completar', exact: true })).toBeDisabled();
  expect(mockApi.calls.filter(c => c.method === 'POST')).toHaveLength(0);
});
