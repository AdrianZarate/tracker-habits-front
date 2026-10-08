const path = require('node:path');
const { test: base, expect } = require(require.resolve('@playwright/test', {
  paths: [process.cwd(), ...process.env.PATH.split(path.delimiter).map(p => path.resolve(p, '..'))],
}));
const origin = 'http://127.0.0.1:4173';
// API log dates are immutable calendar anchors, not instants of completion.
const anchor = day => `${day}T00:00:00.000Z`;
const todayAnchor = () => anchor(new Date().toISOString().slice(0, 10));
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
      beforeMutation: async () => {}, listStatus: 200, logsStatus: 200, mutationStatus: 200, settled: [],
    };
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (['fetch', 'xhr'].includes(request.resourceType())) {
        const endpoint = ['/auth/check-status', '/habits/logs', '/habits']
          .find(suffix => url.pathname.endsWith(suffix));
        const method = request.method();
        api.calls.push({ endpoint, path: url.pathname, search: url.search, method, body: request.postDataJSON(), authorization: request.headers().authorization });
        const headers = { 'access-control-allow-origin': origin };
        if (method === 'GET' && endpoint === '/auth/check-status') {
          await api.beforeStatus();
          return route.fulfill({ status: api.status, json: api.session, headers });
        }
        if (method === 'GET' && endpoint === '/habits/logs') {
          const logs = [...api.logs], status = api.logsStatus;
          await api.beforeLogs();
          return route.fulfill({ json: logs, status, headers });
        }
        if (method === 'GET' && endpoint === '/habits') {
          const filter = url.searchParams.get('status') ?? 'active';
          const habits = [...api.habits], status = api.listStatus;
          await api.beforeHabits(filter);
          api.settled.push(`list:${filter}`);
          return route.fulfill({ json: habits, status, headers });
        }
        if (method === 'POST' && endpoint === '/habits') {
          api.createdPayload = request.postDataJSON();
          if (api.createStatus !== 201) return route.fulfill({ status: api.createStatus, json: { message: 'Synthetic error' }, headers });
          api.habits = [...api.habits, { habitId: 'walk', ...api.createdPayload }];
          api.logs = [{ habitId: 'walk', date: todayAnchor(), completed: true }];
          return route.fulfill({ status: 201, json: {
            _id: 'mock-created', habitId: 'walk', userId: 'mock-user', active: true,
          }, headers });
        }
        if ((method === 'POST' && /\/habits\/[^/]+\/check$/.test(url.pathname))
          || (method === 'DELETE' && /\/habits\/[^/]+\/incomplete$/.test(url.pathname))) {
          const status = api.mutationStatus, id = url.pathname.split('/').at(-2);
          const original = api.logs.find(l => l.habitId === id && l.date.startsWith(api.today ?? new Date().toISOString().slice(0, 10)));
          const entry = { ...original, _id: 'synthetic', habitId: id,
            date: original?.date ?? anchor(api.today ?? new Date().toISOString().slice(0, 10)), completed: true, manualCompletion: true };
          await api.beforeMutation();
          api.settled.push('completion');
          if (request.postData() !== null) return route.fulfill({ status: 400, json: { message: 'Bodyless only' }, headers });
          if (status === 200) api.logs = method === 'POST'
            ? [...api.logs.filter(l => l !== original), entry] : api.logs.filter(l => l !== original);
          return route.fulfill({ status, json: method === 'POST' ? entry : { acknowledged: true, deletedCount: 1 }, headers });
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
    expect(api.calls.filter(c => /\/(complete|week)$/.test(c.path) || (c.method === 'PATCH' && /\/logs\//.test(c.path)))).toEqual([]);
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
  const today = todayAnchor();
  const yesterday = anchor(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  mockApi.habits.push({ habitId: 'sleep', title: 'Dormir' }, { habitId: 'water', title: 'Beber agua' });
  mockApi.logs = [
    { habitId: 'read', date: today, completed: true },
    { habitId: 'sleep', date: yesterday, completed: true },
    { habitId: 'water', date: today, completed: false },
  ];
  await page.goto(`${origin}/dashboard`);
  await expect(todayCheck(page)).toBeChecked();
  for (const title of ['Dormir', 'Beber agua']) {
    await expect(todayCheck(page, title)).not.toBeChecked();
  }
  const initialHabits = callsFor(mockApi, '/habits').length;
  const initialLogs = callsFor(mockApi, '/habits/logs').length;
  expect(initialHabits).toBeGreaterThan(0);
  expect(initialLogs).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Nuevo hábito', exact: true }).click();
  await page.getByPlaceholder('Ej. Meditar 10 minutos').fill('Caminar');
  await page.getByRole('button', { name: 'Crear hábito', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo hábito', exact: true })).toHaveCount(0);
  await expect(todayCheck(page, 'Caminar')).toBeChecked();
  await expect(todayCheck(page)).not.toBeChecked();
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

const deferred = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
const todayCheck = (page, title = 'Leer') => habitRow(page, title).getByRole('checkbox', { name: 'Completado hoy', exact: true });
async function openDashboard(page, api) {
  api.habits = [{ habitId: 'read', title: 'Leer', status: 'active', active: false }];
  await storeSession(page);
  await page.goto(`${origin}/dashboard`);
  await expect(habitRow(page, 'Leer')).toBeVisible();
}

for (const schedule of [{ kind: 'daily' }, { kind: 'weekdays', days: [1] }, { kind: 'weekly', timesPerWeek: 3 }]) {
  test(`dashboard manual quantity ${schedule.kind} checks bodylessly and undoes without changing old history`, async ({ page, mockApi }) => {
    await page.clock.install({ time: new Date('2026-04-01T12:00:00Z') });
    mockApi.today = '2026-04-01';
    const configuration = { schedule, goal: { kind: 'quantity', target: 100, unit: 'páginas' } };
    mockApi.habits = [{ habitId: 'read', title: 'Lectura medida', slug: 'leer', category: 'Libros', color: '#123abc', icon: '__proto__', configuration,
      pendingConfiguration: { effectiveFrom: '2026-04-02', configuration } }];
    mockApi.logs = [{ habitId: 'read', date: anchor('2026-04-01'), completed: false, amount: 200, note: 'Keep note', configurationSnapshot: { configuration } },
      { habitId: 'read', date: anchor('2026-03-31'), completed: true, amount: 1, note: 'Old history', configurationSnapshot: { configuration } }];
    const originals = JSON.parse(JSON.stringify(mockApi.logs));
    await storeSession(page);
    await page.goto(`${origin}/dashboard`);
    const row = habitRow(page, 'Lectura medida'), checkbox = todayCheck(page, 'Lectura medida');
    await expect(checkbox).toBeEnabled();
    await expect(checkbox).not.toBeChecked();
    await expect(row.getByRole('link', { name: 'Lectura medida', exact: true })).toHaveAttribute('href', '/habits/read');
    await expect(row).not.toContainText(/Libros|123abc|páginas|semana|Desde|\/leer|Cantidad/);
    await expect(row.locator('svg')).toHaveCount(0);
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    expect(mockApi.calls.filter(c => c.path.endsWith('/check')).map(c => c.body)).toEqual([null]);
    expect(mockApi.logs.find(l => l.date.startsWith('2026-04-01'))).toEqual({ ...originals[0], _id: 'synthetic', completed: true, manualCompletion: true });
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
    expect(mockApi.calls.filter(c => c.path.endsWith('/incomplete') && c.method === 'DELETE')).toHaveLength(1);
    expect(mockApi.logs).toEqual([originals[1]]);
  });
}

test('all owned habits partition locally with explicit status precedence and compact hidden name links', async ({ page, mockApi }) => {
  mockApi.habits = [
    { habitId: 'read', title: 'Leer', status: 'active', active: false },
    { habitId: 'legacy', title: 'Legacy active' },
    { habitId: 'paused', title: 'Pausa visible', status: 'paused', active: true },
    { habitId: 'archived', title: 'Archivo visible', status: 'archived', active: true },
    { habitId: 'old', title: 'Legacy hidden', active: false },
  ];
  mockApi.logs = mockApi.habits.map(h => ({ habitId: h.habitId, date: todayAnchor(), completed: true, amount: 999 }));
  await storeSession(page);
  await page.goto(`${origin}/dashboard`);
  await expect(todayCheck(page)).toBeChecked();
  await expect(todayCheck(page, 'Legacy active')).toBeChecked();
  await expect(page.getByText('2 de 2 completados hoy', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  const hidden = page.locator('details');
  await expect(hidden).toHaveCount(1);
  await expect(hidden).not.toHaveAttribute('open');
  await expect(hidden.locator('summary')).toHaveText('Hábitos ocultos');
  const reads = callsFor(mockApi, '/habits').length, logReads = callsFor(mockApi, '/habits/logs').length;
  expect(reads).toBe(1);
  expect(logReads).toBe(1);
  expect(callsFor(mockApi, '/habits').map(c => c.search)).toEqual(['?status=all']);
  await hidden.locator('summary').click();
  for (const [id, name] of [['paused', 'Pausa visible'], ['archived', 'Archivo visible'], ['old', 'Legacy hidden']]) {
    await expect(hidden.getByRole('link', { name, exact: true })).toHaveAttribute('href', `/habits/${id}`);
  }
  await expect(hidden.getByRole('checkbox')).toHaveCount(0);
  await expect(hidden.getByRole('button')).toHaveCount(0);
  await expect(hidden).not.toContainText(/Pausado|Archivado|Restaurar/);
  await hidden.locator('summary').click();
  expect(callsFor(mockApi, '/habits')).toHaveLength(reads);
  expect(callsFor(mockApi, '/habits/logs')).toHaveLength(logReads);
  expect(mockApi.calls.filter(c => ['POST', 'PATCH', 'DELETE'].includes(c.method))).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem(`completedHabits_${new Date().toISOString().slice(0, 10)}`))).toBe('["read","legacy"]');
});

for (const hiddenOnly of [false, true]) {
  test(`empty active list with hidden=${hiddenOnly} never claims hidden habits do not exist`, async ({ page, mockApi }) => {
    mockApi.habits = hiddenOnly ? [{ habitId: 'paused', title: 'Oculto', status: 'paused' }] : [];
    await storeSession(page);
    await page.goto(`${origin}/dashboard`);
    await expect(page.getByText(hiddenOnly ? 'No tienes hábitos activos. Puedes restaurar uno desde Hábitos ocultos.' : 'No tienes hábitos todavía. ¡Crea uno con el botón +!', { exact: true })).toBeVisible();
    await expect(page.locator('details')).toHaveCount(hiddenOnly ? 1 : 0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    expect(callsFor(mockApi, '/habits').every(c => c.search === '?status=all')).toBe(true);
    if (hiddenOnly) await expect(page.getByText(/No tienes hábitos todavía/)).toHaveCount(0);
  });
}

test('stored boolean counts active habits only, never amounts or historical checks', async ({ page, mockApi }) => {
  await page.clock.install({ time: new Date('2026-04-01T12:00:00Z') });
  mockApi.habits.push({ habitId: 'water', title: 'Agua' }, { habitId: 'hidden', title: 'Oculto', status: 'archived' });
  mockApi.logs = [
    { habitId: 'read', date: anchor('2026-04-01'), completed: true, amount: 1 },
    { habitId: 'water', date: anchor('2026-04-01'), completed: false, amount: 1000 },
    { habitId: 'water', date: anchor('2026-03-31'), completed: true },
    { habitId: 'hidden', date: anchor('2026-04-01'), completed: true },
  ];
  await storeSession(page);
  await page.goto(`${origin}/dashboard`);
  await expect(page.getByText('1 de 2 completados hoy', { exact: true })).toBeVisible();
  await expect(todayCheck(page)).toBeChecked();
  await expect(todayCheck(page, 'Agua')).not.toBeChecked();
  expect(mockApi.calls.filter(c => c.method !== 'GET')).toHaveLength(0);
});

test('stale dashboard callback cannot check or undo hidden owned records', async ({ page, mockApi }) => {
  mockApi.habits.push({ habitId: 'hidden', title: 'Oculto', status: 'paused', active: true });
  await storeSession(page);
  await page.goto(`${origin}/dashboard`);
  await expect(todayCheck(page)).toBeEnabled();
  // Exercise the callback guard independently of the absent hidden checkbox.
  await habitRow(page, 'Leer').evaluate(async row => {
    let fiber = row[Object.keys(row).find(key => key.startsWith('__reactFiber$'))];
    while (fiber && !fiber.memoizedProps?.onLog) fiber = fiber.return;
    if (!fiber) throw Error('HabitCard callback unavailable');
    await fiber.memoizedProps.onLog('hidden', false);
    await fiber.memoizedProps.onLog('hidden', true);
  });
  expect(mockApi.calls.filter(c => c.method !== 'GET')).toHaveLength(0);
});

test('current check and undo failures preserve boolean, settle pending and recover', async ({ page, mockApi }) => {
  await openDashboard(page, mockApi);
  const checkbox = todayCheck(page);
  mockApi.mutationStatus = 500;
  await checkbox.click();
  await expect(page.getByRole('alert')).toContainText('Error al actualizar el hábito.');
  await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toBeEnabled();
  mockApi.mutationStatus = 200;
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await expect(page.getByRole('alert')).toHaveCount(0);
  mockApi.mutationStatus = 500;
  await checkbox.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(checkbox).toBeChecked();
  mockApi.mutationStatus = 200;
  await checkbox.click();
  await expect(checkbox).not.toBeChecked();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('pending check prevents duplicate mutation and late read retries never repeat check', async ({ page, mockApi }) => {
  await openDashboard(page, mockApi);
  const held = deferred(); mockApi.beforeMutation = () => held.promise;
  try {
    await todayCheck(page).click();
    await expect(todayCheck(page)).toBeDisabled();
    expect(mockApi.calls.filter(c => c.path.endsWith('/check'))).toHaveLength(1);
  } finally { held.release(); }
  await expect(todayCheck(page)).toBeChecked();
  mockApi.logsStatus = 500;
  await page.reload();
  await expect(page.getByText('No se pudieron cargar los hábitos.')).toBeVisible();
  mockApi.logsStatus = 200;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(todayCheck(page)).toBeChecked();
  expect(mockApi.calls.filter(c => c.path.endsWith('/check'))).toHaveLength(1);
});

for (const stage of ['list', 'completion']) {
  test(`late dashboard ${stage} after logout cannot refill cache or display errors`, async ({ page, mockApi }) => {
    await storeSession(page);
    const held = deferred();
    if (stage === 'list') mockApi.beforeLogs = () => held.promise;
    else mockApi.beforeMutation = () => held.promise;
    mockApi.logs = stage === 'list' ? [{ habitId: 'read', date: todayAnchor(), completed: true }] : [];
    try {
      await page.goto(`${origin}/dashboard`);
      if (stage === 'completion') await todayCheck(page).click();
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
  mockApi.logs = [{ habitId: 'read', date: anchor('2026-03-31'), completed: true }];
  await openDashboard(page, mockApi);
  await expect(todayCheck(page)).toBeChecked();
  const before = callsFor(mockApi, '/habits').length;
  // A stale checked checkbox must not delete the new day's record before remount.
  await page.clock.setSystemTime(new Date('2026-04-01T07:00:01Z'));
  await todayCheck(page).click();
  expect(mockApi.calls.filter(c => c.method === 'DELETE')).toHaveLength(0);
  mockApi.logs = [];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(todayCheck(page)).not.toBeChecked();
  expect(callsFor(mockApi, '/habits').length).toBeGreaterThan(before);
  expect(await page.evaluate(() => localStorage.getItem('completedHabits_2026-04-01') ?? '')).not.toContain('read');
});

test('no-argument list API remains unfiltered and defaults to active', async ({ page, mockApi }) => {
  await storeSession(page);
  await page.goto(`${origin}/dashboard`);
  await expect(habitRow(page, 'Leer')).toBeVisible();
  await page.evaluate(async () => { const { getHabits } = await import('/src/api/habits.api.ts'); await getHabits(); });
  expect(callsFor(mockApi, '/habits').at(-1).search).toBe('');
});

for (const [context, lateStatus] of ['session', 'account', 'day', 'route'].flatMap(context => [200, 500].map(status => [context, status]))) {
  test(`dashboard completion ${lateStatus} rechecks ${context} before and after awaiting`, async ({ page, mockApi }) => {
    await page.clock.install({ time: new Date('2026-04-01T12:00:00Z') });
    await openDashboard(page, mockApi);
    const held = deferred();
    mockApi.beforeMutation = () => held.promise;
    mockApi.mutationStatus = lateStatus;
    const complete = todayCheck(page);
    const changeContext = async () => {
      if (context === 'session') await page.evaluate(() => localStorage.setItem('token', 'new-session'));
      else if (context === 'account') await page.evaluate(() => localStorage.setItem('email', 'another@example.invalid'));
      else if (context === 'day') await page.clock.setSystemTime(new Date('2026-04-02T12:00:00Z'));
      else await page.evaluate(() => history.pushState(null, '', '/elsewhere'));
    };
    try {
      await complete.click();
      await expect.poll(() => mockApi.calls.filter(c => c.path.endsWith('/check')).length).toBe(1);
      await changeContext();
    } finally { held.release(); }
    await expect.poll(() => mockApi.settled.includes('completion')).toBe(true);
    await page.clock.runFor(100);
    await expect(complete).not.toBeChecked();
    await expect(complete).toBeDisabled();
    expect(mockApi.calls.filter(c => c.path.endsWith('/check'))).toHaveLength(1);
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
    mockApi.logs = [{ habitId: 'read', date: anchor('2026-04-01'), completed: true }];
    try {
      await page.goto(`${origin}/dashboard`);
      await expect.poll(() => callsFor(mockApi, '/habits').length).toBeGreaterThan(0);
      if (context === 'session') await page.evaluate(() => localStorage.setItem('token', 'new-session'));
      else if (context === 'account') await page.evaluate(() => localStorage.setItem('email', 'another@example.invalid'));
      else if (context === 'day') await page.clock.setSystemTime(new Date('2026-04-02T12:00:00Z'));
      else await page.evaluate(() => history.pushState(null, '', '/elsewhere'));
    } finally { held.release(); }
    await expect.poll(() => mockApi.settled.includes('list:all')).toBe(true);
    await page.clock.runFor(100);
    await expect(page.locator('.animate-spin')).toBeVisible();
    await expect(habitRow(page, 'Leer')).toHaveCount(0);
    await expect(page.getByText('No se pudieron cargar los hábitos.')).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('completedHabits_')))).toEqual([]);
  });
}

test('current list failure retries reads alone without losing session or flashing old error', async ({ page, mockApi }) => {
  await storeSession(page);
  mockApi.listStatus = 500;
  await page.goto(`${origin}/dashboard`);
  await expect(page.getByText('No se pudieron cargar los hábitos.')).toBeVisible();
  mockApi.listStatus = 200;
  const held = deferred(); mockApi.beforeHabits = () => held.promise;
  try {
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect(page.locator('.animate-spin')).toBeVisible();
    await expect(page.getByText('No se pudieron cargar los hábitos.')).toHaveCount(0);
  } finally { held.release(); }
  await expect(habitRow(page, 'Leer')).toBeVisible();
  await expect(page.getByText('No se pudieron cargar los hábitos.')).toHaveCount(0);
  expect(mockApi.calls.filter(c => c.method !== 'GET')).toHaveLength(0);
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
