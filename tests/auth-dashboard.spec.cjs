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
      logs: [], beforeStatus: async () => {}, beforeHabits: async () => {}, beforeLogs: async () => {},
      beforeMutation: async () => {}, listStatus: 200, mutationStatus: 200, byStatus: null, settled: [],
    };
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (['fetch', 'xhr'].includes(request.resourceType())) {
        const endpoint = ['/auth/check-status', '/habits/logs', '/habits']
          .find(suffix => url.pathname.endsWith(suffix));
        const method = request.method();
        api.calls.push({ endpoint, path: url.pathname, search: url.search, method, authorization: request.headers().authorization });
        const headers = { 'access-control-allow-origin': origin };
        if (method === 'GET' && endpoint === '/auth/check-status') {
          await api.beforeStatus();
          return route.fulfill({ status: api.status, json: api.session, headers });
        }
        if (method === 'GET' && endpoint === '/habits/logs') {
          const logs = [...api.logs];
          await api.beforeLogs();
          return route.fulfill({ json: logs, headers });
        }
        if (method === 'GET' && endpoint === '/habits') {
          const filter = url.searchParams.get('status') ?? 'active';
          const habits = api.byStatus?.[filter] ?? api.habits, status = api.listStatus;
          await api.beforeHabits(filter);
          api.settled.push(`list:${filter}`);
          return route.fulfill({ json: habits, status, headers });
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
          const status = api.mutationStatus;
          await api.beforeMutation();
          api.settled.push('completion');
          return route.fulfill({ status, json: { _id: 'synthetic', habitId: 'read', date: new Date().toISOString(), completed: true }, headers });
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

async function openCreate(page) {
  await storeSession(page);
  await page.goto(`${origin}/dashboard`);
  await page.getByRole('button', { name: 'Nuevo hábito', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('  Leer por la noche  ');
}

test('create has only a name and omits retired configuration and appearance payloads', async ({ page, mockApi }) => {
  await openCreate(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('input')).toHaveCount(1);
  await expect(dialog.locator('select')).toHaveCount(0);
  for (const label of ['Categoría', 'Color', 'Icono', 'Frecuencia', 'Tipo de objetivo', 'Cantidad objetivo', 'Unidad']) {
    await expect(dialog.getByLabel(label, { exact: true })).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Crear hábito', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(mockApi.createdPayload).toEqual({ title: 'Leer por la noche' });
  await expect(habitRow(page, 'Leer por la noche')).toBeVisible();
});

test('name create rejects invalid names locally and retains values after recoverable API error', async ({ page, mockApi }) => {
  await openCreate(page);
  const submit = page.getByRole('button', { name: 'Crear hábito', exact: true });
  const noPost = () => expect(callsFor(mockApi, '/habits', 'POST')).toHaveLength(0);
  for (const [label, invalid, valid] of [
    ['Título', '  ab  ', 'Leer por la noche'],
    ['Título', 'a'.repeat(201), 'Leer por la noche'],
  ]) {
    await page.getByLabel(label, { exact: true }).fill(invalid);
    await submit.click();
    await expect(page.getByRole('alert')).toBeVisible();
    noPost();
    await page.getByLabel(label, { exact: true }).fill(valid);
  }
  mockApi.createStatus = 500;
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('No se pudo crear');
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Leer por la noche');
  mockApi.createStatus = 201;
  await submit.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(mockApi.createdPayload).toEqual({ title: 'Leer por la noche' });
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

const statusFilter = page => page.getByLabel('Estado de los hábitos', { exact: true });
const deferred = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
async function openFilteredDashboard(page, api) {
  api.byStatus = {
    active: [{ habitId: 'read', title: 'Leer', status: 'active', active: false }],
    paused: [{ habitId: 'read', title: 'Pausa visible', status: 'paused', active: true }],
    archived: [],
    all: [{ habitId: 'archived', title: 'Archivo visible', status: 'archived', active: true }],
  };
  await storeSession(page);
  await page.goto(`${origin}/dashboard`);
  await expect(habitRow(page, 'Leer')).toBeVisible();
}

test('status queries default active, keep today enrichment and explain filtered emptiness', async ({ page, mockApi }) => {
  mockApi.logs = [{ habitId: 'read', date: new Date().toISOString(), completed: true }];
  await openFilteredDashboard(page, mockApi);
  await expect(statusFilter(page)).toHaveValue('active');
  expect(callsFor(mockApi, '/habits').every(c => c.search === '' || c.search === '?status=active')).toBe(true);
  await expect(habitRow(page, 'Leer').getByRole('button', { name: '✓ Hecho' })).toBeEnabled();
  await statusFilter(page).selectOption('paused');
  await expect(habitRow(page, 'Pausa visible').getByRole('button', { name: '✓ Hecho' })).toBeDisabled();
  await statusFilter(page).selectOption('archived');
  await expect(page.getByText('No hay hábitos en este estado.', { exact: true })).toBeVisible();
  await expect(page.getByText(/No tienes hábitos todavía/)).toHaveCount(0);
  await statusFilter(page).selectOption('all');
  await expect(habitRow(page, 'Archivo visible').getByRole('button', { name: 'Completar', exact: true })).toBeDisabled();
  for (const filter of ['paused', 'archived', 'all']) expect(callsFor(mockApi, '/habits').some(c => c.search === `?status=${filter}`)).toBe(true);
  expect(mockApi.calls.filter(c => ['POST', 'PATCH', 'DELETE'].includes(c.method))).toHaveLength(0);
});

for (const lateStatus of [200, 500]) {
  test(`old filter ${lateStatus} response cannot replace list, error or pending spinner`, async ({ page, mockApi }) => {
    await openFilteredDashboard(page, mockApi);
    const old = deferred(), current = deferred();
    mockApi.listStatus = lateStatus;
    mockApi.beforeHabits = filter => filter === 'paused' ? old.promise : current.promise;
    try {
      await statusFilter(page).selectOption('paused');
      await expect.poll(() => callsFor(mockApi, '/habits').some(c => c.search === '?status=paused')).toBe(true);
      mockApi.listStatus = 200;
      await statusFilter(page).selectOption('all');
      await expect.poll(() => callsFor(mockApi, '/habits').some(c => c.search === '?status=all')).toBe(true);
      old.release();
      await expect.poll(() => mockApi.settled.includes('list:paused')).toBe(true);
      await expect(page.locator('.animate-spin')).toBeVisible();
      await expect(habitRow(page, 'Pausa visible')).toHaveCount(0);
      await expect(page.getByText('No se pudieron cargar los hábitos.')).toHaveCount(0);
    } finally { old.release(); current.release(); }
    await expect(habitRow(page, 'Archivo visible')).toBeVisible();
    await expect(page.getByText('No se pudieron cargar los hábitos.')).toHaveCount(0);
  });
}

for (const lateStatus of [200, 500]) {
  test(`completion ${lateStatus} after filter change cannot update inactive list or errors`, async ({ page, mockApi }) => {
    await openFilteredDashboard(page, mockApi);
    const held = deferred();
    mockApi.beforeMutation = () => held.promise;
    mockApi.mutationStatus = lateStatus;
    try {
      await habitRow(page, 'Leer').getByRole('button', { name: 'Completar', exact: true }).click();
      await expect.poll(() => mockApi.calls.filter(c => c.path.endsWith('/complete')).length).toBe(1);
      await statusFilter(page).selectOption('paused');
      await expect(habitRow(page, 'Pausa visible')).toBeVisible();
    } finally { held.release(); }
    await expect.poll(() => mockApi.settled.includes('completion')).toBe(true);
    await expect(habitRow(page, 'Pausa visible').getByRole('button', { name: 'Completar', exact: true })).toBeDisabled();
    await expect(page.getByText('Error al actualizar el hábito.')).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('completedHabits_')).map(k => localStorage.getItem(k)))).not.toContain('["read"]');
  });
}

for (const stage of ['list', 'completion']) {
  test(`late dashboard ${stage} after logout cannot refill cache or display errors`, async ({ page, mockApi }) => {
    await storeSession(page);
    const held = deferred();
    if (stage === 'list') mockApi.beforeLogs = () => held.promise;
    else mockApi.beforeMutation = () => held.promise;
    mockApi.logs = stage === 'list' ? [{ habitId: 'read', date: new Date().toISOString(), completed: true }] : [];
    try {
      await page.goto(`${origin}/dashboard`);
      if (stage === 'completion') await habitRow(page, 'Leer').getByRole('button', { name: 'Completar', exact: true }).click();
      else await expect.poll(() => callsFor(mockApi, '/habits/logs').length).toBeGreaterThan(0);
      await page.getByRole('button', { name: 'Salir', exact: true }).click();
      await expect(page).toHaveURL(`${origin}/login`);
    } finally { held.release(); }
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('completedHabits_')))).toEqual([]);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('account midnight replaces dashboard context and ignores previous-day logs', async ({ page, mockApi }) => {
  await page.clock.install({ time: new Date('2026-04-01T06:59:59Z') });
  mockApi.session = { ...session, timeZone: 'America/Los_Angeles' };
  mockApi.logs = [{ habitId: 'read', date: '2026-03-31T00:00:00Z', completed: true }];
  await openFilteredDashboard(page, mockApi);
  await expect(habitRow(page, 'Leer').getByRole('button', { name: '✓ Hecho' })).toBeVisible();
  const held = deferred();
  mockApi.beforeLogs = () => held.promise;
  try {
    await statusFilter(page).selectOption('paused');
    await expect.poll(() => callsFor(mockApi, '/habits').some(c => c.search === '?status=paused')).toBe(true);
    mockApi.beforeLogs = async () => {};
    mockApi.logs = [];
    await page.clock.runFor(1100);
    await expect(habitRow(page, 'Pausa visible').getByRole('button', { name: 'Completar', exact: true })).toBeDisabled();
  } finally { held.release(); }
  await page.clock.runFor(500);
  expect(await page.evaluate(() => localStorage.getItem('completedHabits_2026-04-01') ?? '')).not.toContain('read');
});

test('no-argument list API remains unfiltered and defaults to active', async ({ page, mockApi }) => {
  await storeSession(page);
  await page.goto(`${origin}/dashboard`);
  await expect(habitRow(page, 'Leer')).toBeVisible();
  await page.evaluate(async () => { const { getHabits } = await import('/src/api/habits.api.ts'); await getHabits(); });
  expect(callsFor(mockApi, '/habits').at(-1).search).toBe('');
});

for (const context of ['session', 'account', 'day', 'route']) {
  test(`dashboard completion rechecks ${context} before and after awaiting`, async ({ page, mockApi }) => {
    await page.clock.install({ time: new Date('2026-04-01T12:00:00Z') });
    await openFilteredDashboard(page, mockApi);
    const held = deferred();
    mockApi.beforeMutation = () => held.promise;
    const complete = habitRow(page, 'Leer').getByRole('button', { name: 'Completar', exact: true });
    const changeContext = async () => {
      if (context === 'session') await page.evaluate(() => localStorage.setItem('token', 'new-session'));
      else if (context === 'account') await page.evaluate(() => localStorage.setItem('email', 'another@example.invalid'));
      else if (context === 'day') await page.clock.setSystemTime(new Date('2026-04-02T12:00:00Z'));
      else await page.evaluate(() => history.pushState(null, '', '/elsewhere'));
    };
    try {
      await complete.click();
      await expect.poll(() => mockApi.calls.filter(c => c.path.endsWith('/complete')).length).toBe(1);
      await changeContext();
    } finally { held.release(); }
    await expect.poll(() => mockApi.settled.includes('completion')).toBe(true);
    await page.clock.runFor(100);
    await expect(complete).toBeVisible();
    await complete.click();
    expect(mockApi.calls.filter(c => c.path.endsWith('/complete'))).toHaveLength(1);
    expect(await page.evaluate(() => localStorage.getItem('completedHabits_2026-04-01') ?? '')).not.toContain('read');
    await expect(page.getByText('Error al actualizar el hábito.')).toHaveCount(0);
  });
}

for (const [context, lateStatus] of ['session', 'account', 'day', 'route'].flatMap(context => [200, 500].map(status => [context, status]))) {
  test(`dashboard list ${lateStatus} rejects stale ${context} response, error and finally`, async ({ page, mockApi }) => {
    await page.clock.install({ time: new Date('2026-04-01T12:00:00Z') });
    await storeSession(page);
    const held = deferred();
    mockApi.beforeHabits = () => held.promise;
    mockApi.listStatus = lateStatus;
    mockApi.logs = [{ habitId: 'read', date: '2026-04-01T00:00:00Z', completed: true }];
    try {
      await page.goto(`${origin}/dashboard`);
      await expect.poll(() => callsFor(mockApi, '/habits').length).toBeGreaterThan(0);
      if (context === 'session') await page.evaluate(() => localStorage.setItem('token', 'new-session'));
      else if (context === 'account') await page.evaluate(() => localStorage.setItem('email', 'another@example.invalid'));
      else if (context === 'day') await page.clock.setSystemTime(new Date('2026-04-02T12:00:00Z'));
      else await page.evaluate(() => history.pushState(null, '', '/elsewhere'));
    } finally { held.release(); }
    await expect.poll(() => mockApi.settled.includes('list:active')).toBe(true);
    await page.clock.runFor(100);
    await expect(page.locator('.animate-spin')).toBeVisible();
    await expect(habitRow(page, 'Leer')).toHaveCount(0);
    await expect(page.getByText('No se pudieron cargar los hábitos.')).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('completedHabits_')))).toEqual([]);
  });
}

test('current list failure is visible and filter change recovers without losing session', async ({ page, mockApi }) => {
  await openFilteredDashboard(page, mockApi);
  mockApi.listStatus = 500;
  await statusFilter(page).selectOption('paused');
  await expect(page.getByText('No se pudieron cargar los hábitos.')).toBeVisible();
  mockApi.listStatus = 200;
  await statusFilter(page).selectOption('all');
  await expect(habitRow(page, 'Archivo visible')).toBeVisible();
  await expect(page.getByText('No se pudieron cargar los hábitos.')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe(session.token);
});

for (const context of ['session', 'account', 'day', 'route']) {
  test(`create rechecks its original ${context} before writing`, async ({ page, mockApi }) => {
    await page.clock.install({ time: new Date('2026-04-01T12:00:00Z') });
    await openCreate(page);
    if (context === 'session') await page.evaluate(() => localStorage.setItem('token', 'replacement'));
    if (context === 'account') await page.evaluate(() => localStorage.setItem('email', 'another@example.invalid'));
    if (context === 'route') await page.evaluate(() => history.pushState(null, '', '/elsewhere'));
    if (context === 'day') await page.clock.setSystemTime(new Date('2026-04-02T12:00:00Z'));
    await page.getByRole('button', { name: 'Crear hábito', exact: true }).click();
    expect(callsFor(mockApi, '/habits', 'POST')).toHaveLength(0);
  });
}

test('archive collision in create never sends lifecycle restore or hides the failure', async ({ page, mockApi }) => {
  await openCreate(page);
  mockApi.createStatus = 409;
  await page.getByRole('button', { name: 'Crear hábito', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('El hábito cambió. Recarga el detalle');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(mockApi.calls.filter(c => c.method === 'PATCH')).toHaveLength(0);
});
