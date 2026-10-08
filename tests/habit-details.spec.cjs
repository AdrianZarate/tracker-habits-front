const path = require('node:path');
const { test: base, expect } = require(require.resolve('@playwright/test', {
  paths: [process.cwd(), ...process.env.PATH.split(path.delimiter).map(p => path.resolve(p, '..'))],
}));
const origin = 'http://127.0.0.1:4173';
const profile = { fullName: 'Detail user', email: 'detail@example.invalid', token: 'detail-token', timeZone: 'America/Los_Angeles', roles: ['user'] };
const log = (day, id = day) => ({ _id: id, habitId: 'read', date: `${day}T00:00:00.000Z`, completed: true });
const dailyCheckbox = { schedule: { kind: 'daily' }, goal: { kind: 'checkbox' } };
const quantityGoal = (target = 20, unit = 'páginas', schedule = { kind: 'daily' }) => ({ schedule, goal: { kind: 'quantity', target, unit } });
const snapshot = configuration => ({ configuration });
const test = base.extend({
  api: [async ({ page }, use) => {
    const api = {
      calls: [], unexpected: [], settled: [], today: '2026-03-31', detailStatus: 200, historyStatus: 200, mutationStatus: 200,
      habit: { habitId: 'read', title: 'Leer autorizado', slug: 'leer', active: true }, logs: [],
      beforeDetail: async () => {}, beforeHistory: async () => {}, beforeMutation: async () => {},
    };
    await page.clock.install({ time: new Date('2026-04-01T00:30:00Z') });
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', 'yes');
        localStorage.setItem('token', 'stored-detail-token');
        localStorage.setItem('completedHabits_2026-03-31', '["read"]');
      }
    });
    // Only local static GETs are forwarded. All API reads and writes are synthetic.
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url()), method = req.method();
      const headers = { 'access-control-allow-origin': origin };
      const reply = (json, status = 200) => route.fulfill({ json, status, headers });
      if (['fetch', 'xhr'].includes(req.resourceType())) {
        api.calls.push({ path: url.pathname, search: url.search, method, body: req.postDataJSON() });
        if (method === 'GET' && url.pathname.endsWith('/auth/check-status')) return reply(profile);
        if (method === 'GET' && url.pathname.endsWith('/habits')) return reply([]);
        if (method === 'GET' && url.pathname.endsWith('/habits/logs')) return reply([]);
        if (method === 'GET' && /\/habits\/[^/]+\/logs$/.test(url.pathname)) {
          const month = api.today.slice(0, 7), status = api.historyStatus;
          const logs = api.logs.filter(l => l.date.startsWith(month));
          await api.beforeHistory();
          api.settled.push('history');
          return reply(logs, status);
        }
        if (method === 'GET' && /\/habits\/[^/]+$/.test(url.pathname)) {
          const habit = { ...api.habit }, status = api.detailStatus;
          await api.beforeDetail();
          api.settled.push('detail');
          if (status === 0) return route.abort();
          return reply(habit, status);
        }
        if (method === 'PATCH' && url.pathname.endsWith('/habits/read/lifecycle')) {
          const body = req.postDataJSON(), status = api.mutationStatus;
          const response = api.lifecycleResponse ?? { habitId: 'read', status: body.status, active: body.status === 'active' };
          await api.beforeMutation();
          api.settled.push('mutation');
          if (status !== 200) return reply({ message: 'Synthetic failure' }, status);
          Object.assign(api.habit, response);
          return reply(response);
        }
        if (method === 'PATCH' && url.pathname.endsWith('/habits/read/definition')) {
          const body = req.postDataJSON(), status = api.mutationStatus;
          await api.beforeMutation();
          api.settled.push('mutation');
          if (status !== 200) return reply({ message: 'Synthetic failure' }, status);
          Object.assign(api.habit, body);
          return reply({ ...api.habit });
        }
        if (method === 'POST' && url.pathname.endsWith('/habits/read/check')) {
          const status = api.mutationStatus, today = api.today;
          const existing = api.logs.find(l => l.date.slice(0, 10) === today);
          const entry = { ...log(today), ...(existing ?? {}), completed: true, manualCompletion: true,
            configurationSnapshot: existing?.configurationSnapshot ?? snapshot(api.habit.configuration ?? dailyCheckbox) };
          const body = req.postDataJSON();
          await api.beforeMutation();
          api.settled.push('mutation');
          // M1 strictly rejects a nonempty body; no target amount may be invented.
          if (body && Object.keys(body).length) return reply({ message: 'No payload allowed' }, 400);
          if (status !== 200) return reply({ message: 'Synthetic failure' }, status);
          api.logs = [...api.logs.filter(l => l.date.slice(0, 10) !== today), entry];
          return reply(entry);
        }
        if (method === 'DELETE' && url.pathname.endsWith('/habits/read/incomplete')) {
          const status = api.mutationStatus, today = api.today;
          await api.beforeMutation();
          api.settled.push('mutation');
          if (status !== 200) return reply({ message: 'Synthetic failure' }, status);
          api.logs = api.logs.filter(l => l.date.slice(0, 10) !== today);
          return reply({ acknowledged: true, deletedCount: 1 });
        }
        api.unexpected.push(`${method} ${url.pathname}`);
        return route.abort();
      }
      if (url.origin === origin && method === 'GET' && !url.pathname.startsWith('/api')) return route.continue();
      return route.abort();
    });
    await use(api);
    expect(api.unexpected, 'No real API or Google traffic, week reads or dated PATCH').toEqual([]);
    expect(api.calls.filter(c => /\/week$/.test(c.path))).toEqual([]);
    expect(api.calls.filter(c => c.method === 'PATCH' && /\/logs\//.test(c.path))).toEqual([]);
    expect(api.calls.filter(c => /\/complete$/.test(c.path))).toEqual([]);
  }, { auto: true }],
});
test.use({ timezoneId: 'America/Los_Angeles' });
const title = page => page.getByRole('heading', { name: 'Leer autorizado', exact: true });
const check = page => page.getByRole('checkbox', { name: 'Completado hoy', exact: true });
const calls = (api, suffix, method = 'GET') => api.calls.filter(c => c.path.endsWith(suffix) && c.method === method);
const writes = api => api.calls.filter(c => ['POST', 'PATCH', 'DELETE'].includes(c.method));
const deferred = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
async function navigate(page, id, state = null) {
  await page.evaluate(({ id, state }) => {
    history.pushState({ usr: state }, '', `/habits/${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, { id, state });
}
async function openEdit(page) {
  await page.goto(`${origin}/habits/read`);
  await page.getByRole('button', { name: 'Editar hábito', exact: true }).click();
  return page.getByRole('dialog', { name: 'Editar hábito', exact: true });
}
async function confirmHide(page) {
  await page.getByRole('button', { name: 'Ocultar hábito', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, ocultar', exact: true }).click();
}

test('direct URL and refresh load authoritative detail and default account-month history', async ({ page, api }) => {
  api.logs = [log('2026-03-30'), log('2026-02-28')];
  await page.goto(`${origin}/habits/read`);
  await expect(title(page)).toBeVisible();
  await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
  await expect(page.getByText('sábado, 28 de febrero de 2026')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Historial del mes actual de la cuenta', exact: true })).toBeVisible();
  await page.reload();
  await expect(title(page)).toBeVisible();
  expect(calls(api, '/habits/read').length).toBeGreaterThan(1);
  expect(calls(api, '/habits/read/logs').every(c => c.search === '')).toBe(true);
});

test('navigation state cannot override owned detail or bypass missing/nonowner 404', async ({ page, api }) => {
  await page.goto(`${origin}/dashboard`);
  await navigate(page, 'read', { habit: { habitId: 'read', title: 'Forged state', active: true } });
  await expect(title(page)).toBeVisible();
  await expect(page.getByText('Forged state')).toHaveCount(0);
  for (const id of ['missing', 'nonowner']) {
    api.detailStatus = 404;
    await navigate(page, id, { habit: { title: 'Forged state' } });
    await expect(page.getByText('Hábito no encontrado.')).toBeVisible();
    await expect(title(page)).toHaveCount(0);
    await expect(page.getByText('Forged state')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar hábito', exact: true })).toHaveCount(0);
    await expect(check(page)).toHaveCount(0);
    expect(calls(api, `/habits/${id}/logs`)).toHaveLength(0);
  }
  expect(writes(api)).toHaveLength(0);
});

test('loading hides old data and edit form until owned GET; generic failure retries without render refetch', async ({ page, api }) => {
  const pending = deferred();
  api.beforeDetail = () => pending.promise;
  api.detailStatus = 500;
  try {
    await page.goto(`${origin}/habits/read`);
    await expect(page.locator('.animate-spin')).toBeVisible();
    await expect(title(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar hábito', exact: true })).toHaveCount(0);
    expect(calls(api, '/habits/read/logs')).toHaveLength(0);
  } finally { pending.release(); }
  await expect(page.getByText('No se pudo cargar el hábito.')).toBeVisible();
  api.detailStatus = 200;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(check(page)).toBeEnabled();
  const before = api.calls.length;
  await page.getByRole('button', { name: 'Ocultar hábito', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.clock.runFor(1000);
  expect(api.calls).toHaveLength(before);
});

test('history failure retries read only and does not display stale historical data', async ({ page, api }) => {
  api.historyStatus = 500;
  api.logs = [log('2026-03-30')];
  await page.goto(`${origin}/habits/read`);
  await expect(page.getByText('No se pudieron cargar los registros.')).toBeVisible();
  await expect(page.getByText('lunes, 30 de marzo de 2026')).toHaveCount(0);
  await expect(check(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Editar hábito', exact: true })).toBeDisabled();
  api.historyStatus = 200;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
  expect(writes(api)).toHaveLength(0);
});

for (const initial of ['legacy', 'paused', 'archived']) {
  test(`${initial} inactive owner reads history, edits name and can explicitly restore without losing data`, async ({ page, api }) => {
    Object.assign(api.habit, initial === 'legacy' ? { active: false } : { status: initial, active: true });
    api.logs = [log('2026-03-30'), log('2026-03-31')];
    const originals = JSON.parse(JSON.stringify(api.logs));
    const dialog = await openEdit(page);
    await dialog.getByLabel('Título', { exact: true }).fill('Nombre restaurable');
    await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Nombre restaurable', exact: true })).toBeVisible();
    await expect(check(page)).toBeDisabled();
    await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
    await expect(page.getByRole('button', { name: /Pausar|Archivar|Reanudar/, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Restaurar hábito', exact: true }).click();
    await page.getByRole('button', { name: 'Sí, restaurar', exact: true }).click();
    await expect(check(page)).toBeEnabled();
    expect(calls(api, '/habits/read/lifecycle', 'PATCH').map(c => c.body)).toEqual([{ status: 'active' }]);
    expect(calls(api, '/habits/read/definition', 'PATCH')[0].body).toEqual({ title: 'Nombre restaurable' });
    expect(api.logs).toEqual(originals);
  });
}

test('only account today checkbox undoes and checks; history and daily cache use account labels', async ({ page, api }) => {
  api.logs = [log('2026-03-30'), log('2026-03-31'), log('2026-04-01')];
  await page.goto(`${origin}/habits/read`);
  await expect(check(page)).toBeChecked();
  await expect(page.getByRole('listitem').getByRole('button')).toHaveCount(0);
  await check(page).click();
  await expect(page.getByText('martes, 31 de marzo de 2026')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('completedHabits_2026-03-31')))).not.toContain('read');
  await check(page).click();
  await expect(page.getByText('martes, 31 de marzo de 2026')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('completedHabits_2026-03-31')))).toContain('read');
  expect(calls(api, '/habits/read/incomplete', 'DELETE')).toHaveLength(1);
  expect(calls(api, '/habits/read/check', 'POST').map(c => c.body)).toEqual([null]);
});

test('check and undo failures preserve view and recover; expired check cleans session', async ({ page, api }) => {
  api.logs = [log('2026-03-31')];
  api.mutationStatus = 500;
  await page.goto(`${origin}/habits/read`);
  await check(page).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo actualizar el hábito.');
  await expect(check(page)).toBeChecked();
  api.mutationStatus = 200;
  await check(page).click();
  await expect(check(page)).not.toBeChecked();
  api.mutationStatus = 500;
  await check(page).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(check(page)).not.toBeChecked();
  api.mutationStatus = 401;
  await check(page).click();
  await expect(page).toHaveURL(`${origin}/login`);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});

for (const stage of ['detail', 'history']) {
  test(`route change ignores late ${stage} response and hides previous habit/logs`, async ({ page, api }) => {
    const pending = deferred();
    api.logs = [log('2026-03-30')];
    api[stage === 'detail' ? 'beforeDetail' : 'beforeHistory'] = () => pending.promise;
    try {
      await page.goto(`${origin}/habits/read`);
      await expect.poll(() => calls(api, stage === 'detail' ? '/habits/read' : '/habits/read/logs').length).toBeGreaterThan(0);
      api.beforeDetail = api.beforeHistory = async () => {};
      api.habit = { habitId: 'walk', title: 'Caminar autorizado', slug: 'caminar', active: true };
      api.logs = [];
      await navigate(page, 'walk');
      await expect(page.getByRole('heading', { name: 'Caminar autorizado' })).toBeVisible();
    } finally { pending.release(); }
    await page.clock.runFor(1000);
    await expect(title(page)).toHaveCount(0);
    await expect(page.getByText('lunes, 30 de marzo de 2026')).toHaveCount(0);
  });
}

test('account midnight refreshes month history and removes previous-day record', async ({ page, api }) => {
  await page.clock.setSystemTime(new Date('2026-04-01T06:59:59Z'));
  api.logs = [log('2026-03-31')];
  await page.goto(`${origin}/habits/read`);
  await expect(check(page)).toBeChecked();
  const before = calls(api, '/habits/read/logs').length;
  api.today = '2026-04-01';
  await page.clock.runFor(1100);
  await expect.poll(() => calls(api, '/habits/read/logs').length).toBeGreaterThan(before);
  await expect(page.getByText('martes, 31 de marzo de 2026')).toHaveCount(0);
  await expect(check(page)).not.toBeChecked();
});

test('transport failure is generic and retry recovers', async ({ page, api }) => {
  api.detailStatus = 0;
  await page.goto(`${origin}/habits/read`);
  await expect(page.getByText('No se pudo cargar el hábito.')).toBeVisible();
  api.detailStatus = 200;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(title(page)).toBeVisible();
});

test('loaded route data disappears while the next owned route is pending', async ({ page, api }) => {
  api.logs = [log('2026-03-30')];
  await page.goto(`${origin}/habits/read`);
  await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
  const pending = deferred(); api.beforeDetail = () => pending.promise;
  try {
    await navigate(page, 'walk');
    await expect(page.locator('.animate-spin')).toBeVisible();
    await expect(title(page)).toHaveCount(0);
    await expect(page.getByText('lunes, 30 de marzo de 2026')).toHaveCount(0);
  } finally { pending.release(); }
});

test('late unmounted check cannot refill cache after logout', async ({ page, api }) => {
  await page.goto(`${origin}/habits/read`);
  await expect(check(page)).toBeEnabled();
  const pending = deferred(); api.beforeMutation = () => pending.promise;
  try {
    await check(page).click();
    await expect.poll(() => calls(api, '/habits/read/check', 'POST').length).toBe(1);
    await page.getByRole('button', { name: 'Salir', exact: true }).click();
    await expect(page).toHaveURL(`${origin}/login`);
  } finally { pending.release(); }
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => localStorage.getItem('completedHabits_2026-03-31'))).toBeNull();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('minimal name edit sends title only and preserves metadata, pending goals and snapshots', async ({ page, api }) => {
  Object.assign(api.habit, { category: 'Lectura', color: '#123abc', icon: 'book', configuration: quantityGoal(),
    pendingConfiguration: { revisionId: 'existing', effectiveFrom: '2026-04-01', configuration: dailyCheckbox } });
  api.logs = [{ ...log('2026-03-30'), amount: 2, note: 'Legacy note', configurationSnapshot: snapshot(quantityGoal(10, 'km')) }];
  const originals = JSON.parse(JSON.stringify({ habit: api.habit, logs: api.logs }));
  const dialog = await openEdit(page);
  await expect(dialog.locator('input')).toHaveCount(1);
  await expect(dialog.locator('select')).toHaveCount(0);
  await dialog.getByLabel('Título', { exact: true }).fill('  Lectura personal  ');
  await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Lectura personal', exact: true })).toBeVisible();
  expect(calls(api, '/habits/read/definition', 'PATCH').map(c => c.body)).toEqual([{ title: 'Lectura personal' }]);
  expect(api.habit).toEqual({ ...originals.habit, title: 'Lectura personal' });
  expect(api.logs).toEqual(originals.logs);
});

test('minimal detail has only today and stored month history without advanced sections or metadata', async ({ page, api }) => {
  Object.assign(api.habit, { configuration: quantityGoal(), category: 'Legacy category', icon: 'constructor', color: 'url(unsafe)',
    pendingConfiguration: { revisionId: 'pending', effectiveFrom: '2026-04-01', configuration: dailyCheckbox } });
  api.logs = [{ ...log('2026-03-30'), amount: 2, note: 'Private legacy note', configurationSnapshot: snapshot(quantityGoal(10, 'km')) }];
  await page.goto(`${origin}/habits/read`);
  await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Semana', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Corregir un registro', exact: true })).toHaveCount(0);
  await expect(page.getByText(/Objetivo original|Configuración actual|Private legacy note|Legacy category/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Historial del mes actual de la cuenta', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pausar|Archivar|Reanudar/, exact: true })).toHaveCount(0);
});

for (const schedule of [{ kind: 'daily' }, { kind: 'weekdays', days: [1] }, { kind: 'weekly', timesPerWeek: 7 }]) {
  test(`manual today check works for old quantity ${schedule.kind} without fabricated amounts or lost originals`, async ({ page, api }) => {
    api.habit.configuration = quantityGoal(100, 'km', schedule);
    api.logs = [{ ...log('2026-03-31'), completed: false, amount: 2, note: 'Keep this', configurationSnapshot: snapshot(quantityGoal(10, 'km')) }];
    const original = JSON.parse(JSON.stringify(api.logs[0]));
    await page.goto(`${origin}/habits/read`);
    await expect(check(page)).toBeEnabled();
    await check(page).click();
    await expect(check(page)).toBeChecked();
    expect(calls(api, '/habits/read/check', 'POST').map(c => c.body)).toEqual([null]);
    expect(api.logs[0]).toEqual({ ...original, completed: true, manualCompletion: true });
  });
}

test('new manual check bypasses old quantity weekday gates without an existing log or amount', async ({ page, api }) => {
  api.habit.configuration = quantityGoal(100, 'km', { kind: 'weekdays', days: [1] });
  await page.goto(`${origin}/habits/read`);
  await expect(check(page)).toBeEnabled();
  await check(page).click();
  await expect(check(page)).toBeChecked();
  expect(calls(api, '/habits/read/check', 'POST').map(c => c.body)).toEqual([null]);
  expect(api.logs[0]).not.toHaveProperty('amount');
});

test('late definition response after route unmount cannot overwrite the next owned detail', async ({ page, api }) => {
  const dialog = await openEdit(page);
  await dialog.getByLabel('Título', { exact: true }).fill('Título tardío');
  const held = deferred(); api.beforeMutation = () => held.promise;
  try {
    await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect.poll(() => writes(api).length).toBe(1);
    api.habit = { habitId: 'walk', title: 'Caminar autorizado', active: true };
    await navigate(page, 'walk');
    await expect(page.getByRole('heading', { name: 'Caminar autorizado', exact: true })).toBeVisible();
  } finally { held.release(); }
  await page.clock.runFor(100);
  await expect(page.getByRole('heading', { name: 'Título tardío', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a stale day cannot open an edit form with a newer day than its owned GET', async ({ page, api }) => {
  await page.goto(`${origin}/habits/read`);
  await expect(check(page)).toBeEnabled();
  await page.clock.setSystemTime(new Date('2026-04-01T07:00:01Z'));
  await page.getByRole('button', { name: 'Editar hábito', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(writes(api)).toHaveLength(0);
});

test('stored completion booleans outrank old targets, amounts and missing snapshots', async ({ page, api }) => {
  api.habit.configuration = quantityGoal(100);
  api.logs = [{ ...log('2026-03-31'), amount: 1, configurationSnapshot: snapshot(quantityGoal(10)) },
    { ...log('2026-03-30'), completed: false, amount: 1000, configurationSnapshot: snapshot(quantityGoal(10)) }, log('2026-03-29')];
  const originals = JSON.parse(JSON.stringify(api.logs));
  await page.goto(`${origin}/habits/read`);
  await expect(check(page)).toBeChecked();
  await expect(page.getByRole('listitem').filter({ hasText: 'martes, 31 de marzo de 2026' })).toContainText('Completado');
  await expect(page.getByRole('listitem').filter({ hasText: 'lunes, 30 de marzo de 2026' })).toContainText('Sin completar');
  await expect(page.getByRole('listitem').filter({ hasText: 'domingo, 29 de marzo de 2026' })).toContainText('Completado');
  expect(api.logs).toEqual(originals);
  expect(writes(api)).toHaveLength(0);
});

test('edit validates name and API errors retain the new draft, not the stale title', async ({ page, api }) => {
  api.logs = [log('2026-03-30')];
  const dialog = await openEdit(page);
  for (const invalid of ['', '  ab  ', 'x'.repeat(201)]) {
    await dialog.getByLabel('Título', { exact: true }).fill(invalid);
    await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('entre 3 y 200');
    expect(writes(api)).toHaveLength(0);
  }
  await dialog.getByLabel('Título', { exact: true }).fill('Título nuevo');
  for (const status of [400, 404, 409, 500]) {
    api.mutationStatus = status;
    await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText(status === 404 ? 'Hábito no encontrado' : status === 400 ? 'Revisa los datos' : status === 409 ? 'El hábito cambió' : 'No se pudo guardar');
    await expect(dialog.getByLabel('Título', { exact: true })).toHaveValue('Título nuevo');
    await expect(title(page)).toBeVisible();
    await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
  }
  api.mutationStatus = 200;
  await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Título nuevo', exact: true })).toBeVisible();
});

test('saved definition refresh failure retains history and retries GET without another PATCH', async ({ page, api }) => {
  api.logs = [log('2026-03-30')];
  const dialog = await openEdit(page);
  await dialog.getByLabel('Título', { exact: true }).fill('Guardado pendiente de recarga');
  api.detailStatus = 500;
  await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('Los cambios se guardaron');
  await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
  api.detailStatus = 200;
  await page.getByRole('button', { name: 'Reintentar actualización', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Guardado pendiente de recarga', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(calls(api, '/habits/read/definition', 'PATCH')).toHaveLength(1);
});

test('unchanged edit and Escape cancel send no PATCH and restore focus; keyboard trap stays bounded', async ({ page, api }) => {
  const dialog = await openEdit(page);
  await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const edit = page.getByRole('button', { name: 'Editar hábito', exact: true });
  await expect(edit).toBeFocused();
  await edit.click();
  await dialog.getByLabel('Título', { exact: true }).fill('No guardar');
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Cerrar formulario', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Guardar cambios', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Cerrar formulario', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(edit).toBeFocused();
  expect(writes(api)).toHaveLength(0);
});

for (const operation of ['detail', 'edit']) {
  test(`expired ${operation} uses existing full session cleanup`, async ({ page, api }) => {
    if (operation === 'detail') {
      api.detailStatus = 401;
      await page.goto(`${origin}/habits/read`);
    } else {
      const dialog = await openEdit(page);
      await dialog.getByLabel('Título', { exact: true }).fill('Cambio expirado');
      api.mutationStatus = 401;
      await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    }
    await expect(page).toHaveURL(`${origin}/login`);
    expect(await page.evaluate(() => ['token', 'fullName', 'email', 'picture', 'timeZone', 'completedHabits_2026-03-31'].map(k => localStorage.getItem(k)))).toEqual(Array(6).fill(null));
  });
}

test('confirmed hide archives once and preserves name and history; cancel and Escape send nothing', async ({ page, api }) => {
  api.habit.configuration = quantityGoal();
  api.logs = [log('2026-03-30')];
  const originals = JSON.parse(JSON.stringify(api.logs));
  await page.goto(`${origin}/habits/read`);
  await expect(check(page)).toBeEnabled();
  const hide = page.getByRole('button', { name: 'Ocultar hábito', exact: true });
  await hide.click();
  const dialog = page.getByRole('dialog', { name: 'Ocultar hábito', exact: true });
  await expect(dialog).toContainText('El historial se conserva.');
  await expect(check(page)).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await hide.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(writes(api)).toHaveLength(0);
  const reads = calls(api, '/habits/read').length;
  const held = deferred(); api.beforeMutation = () => held.promise;
  try {
    await hide.click();
    await dialog.getByRole('button', { name: 'Sí, ocultar', exact: true }).click();
    await expect.poll(() => calls(api, '/habits/read/lifecycle', 'PATCH').length).toBe(1);
    await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
  } finally { held.release(); }
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restaurar hábito', exact: true })).toBeVisible();
  await expect(check(page)).toBeDisabled();
  await expect(title(page)).toBeVisible();
  await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
  expect(calls(api, '/habits/read/lifecycle', 'PATCH').map(c => c.body)).toEqual([{ status: 'archived' }]);
  expect(calls(api, '/habits/read')).toHaveLength(reads);
  expect(api.logs).toEqual(originals);
});

for (const status of [404, 500, 401]) {
  test(`hide ${status} preserves history or performs session cleanup`, async ({ page, api }) => {
    api.logs = [log('2026-03-30')]; api.mutationStatus = status;
    await page.goto(`${origin}/habits/read`);
    await confirmHide(page);
    if (status === 401) {
      await expect(page).toHaveURL(`${origin}/login`);
      expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
    } else {
      await expect(page.getByRole('alert')).toContainText(status === 404 ? 'Hábito no encontrado' : 'No se pudo cambiar el estado');
      await expect(check(page)).toBeEnabled();
      await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
    }
    expect(calls(api, '/habits/read/lifecycle', 'PATCH')).toHaveLength(1);
  });
}

async function changeContext(page, context) {
  if (context === 'token') await page.evaluate(() => localStorage.setItem('token', 'replacement'));
  if (context === 'account') await page.evaluate(() => localStorage.setItem('email', 'other@example.invalid'));
  if (context === 'route') await page.evaluate(() => history.pushState(null, '', '/elsewhere'));
  if (context === 'day') await page.clock.setSystemTime(new Date('2026-04-01T07:00:01Z'));
}

for (const operation of ['detail', 'check', 'edit', 'hide']) {
  for (const context of ['token', 'account', 'route', 'day']) {
    for (const lateStatus of [200, 500]) {
      test(`${operation} ${lateStatus} ignores stale ${context} success/error/finally and prevents another write`, async ({ page, api }) => {
        const held = deferred();
        let dialog;
        if (operation === 'detail') {
          api.detailStatus = lateStatus; api.beforeDetail = () => held.promise;
          await page.goto(`${origin}/habits/read`);
          await expect.poll(() => calls(api, '/habits/read').length).toBeGreaterThan(0);
        } else {
          if (operation === 'edit') {
            dialog = await openEdit(page);
            await dialog.getByLabel('Título', { exact: true }).fill('Título tardío');
          } else {
            await page.goto(`${origin}/habits/read`);
            await expect(check(page)).toBeEnabled();
          }
          api.mutationStatus = lateStatus; api.beforeMutation = () => held.promise;
          if (operation === 'check') await check(page).click();
          if (operation === 'edit') await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
          if (operation === 'hide') await confirmHide(page);
          await expect.poll(() => writes(api).length).toBe(1);
        }
        try { await changeContext(page, context); } finally { held.release(); }
        await expect.poll(() => api.settled.includes(operation === 'detail' ? 'detail' : 'mutation')).toBe(true);
        await page.clock.runFor(100);
        await expect(page.getByRole('alert')).toHaveCount(0);
        if (operation === 'detail') {
          await expect(page.locator('.animate-spin')).toBeVisible();
          await expect(title(page)).toHaveCount(0);
          expect(calls(api, '/habits/read/logs')).toHaveLength(0);
        } else if (operation === 'edit') {
          await expect(dialog).toBeVisible();
          await expect(dialog.getByRole('button', { name: 'Cargando...', exact: true })).toBeDisabled();
          await expect(title(page)).toBeVisible();
        } else {
          await expect(check(page)).not.toBeChecked();
          await expect(check(page)).toBeDisabled();
        }
        expect(await page.evaluate(() => localStorage.getItem('completedHabits_2026-03-31'))).toBe('["read"]');
        expect(writes(api)).toHaveLength(operation === 'detail' ? 0 : 1);
      });
    }
  }
}

for (const context of ['token', 'account', 'route', 'day']) {
  test(`changed ${context} rejects edit, check and hide submissions before API writes`, async ({ page, api }) => {
    const dialog = await openEdit(page);
    await dialog.getByLabel('Título', { exact: true }).fill('No guardar');
    await changeContext(page, context);
    await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    expect(writes(api)).toHaveLength(0);
    await page.keyboard.press('Escape');
    await check(page).click();
    expect(writes(api)).toHaveLength(0);
    await confirmHide(page);
    expect(writes(api)).toHaveLength(0);
  });
}

test('read retry after successful check or hide never repeats the mutation', async ({ page, api }) => {
  await page.goto(`${origin}/habits/read`);
  await check(page).click();
  await expect(check(page)).toBeChecked();
  api.beforeHistory = async () => {}; api.historyStatus = 500;
  await page.reload();
  await expect(page.getByText('No se pudieron cargar los registros.')).toBeVisible();
  api.historyStatus = 200;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(check(page)).toBeChecked();
  await confirmHide(page);
  await expect(check(page)).toBeDisabled();
  api.historyStatus = 500;
  await page.reload();
  await expect(page.getByText('No se pudieron cargar los registros.')).toBeVisible();
  api.historyStatus = 200;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Restaurar hábito', exact: true })).toBeEnabled();
  expect(calls(api, '/habits/read/check', 'POST')).toHaveLength(1);
  expect(calls(api, '/habits/read/lifecycle', 'PATCH')).toHaveLength(1);
});

test('returned inactive lifecycle status wins over stale active boolean', async ({ page, api }) => {
  await page.goto(`${origin}/habits/read`);
  api.lifecycleResponse = { habitId: 'read', status: 'archived', active: true };
  await confirmHide(page);
  await expect(page.getByRole('button', { name: 'Restaurar hábito', exact: true })).toBeVisible();
  await expect(check(page)).toBeDisabled();
});

for (const width of [375, 320]) {
  test(`presentation detail ${width}px wraps title and history without losing today or lifecycle controls`, async ({ page, api }, testInfo) => {
    await page.setViewportSize({ width, height: 740 });
    api.habit.title = 'Lectura'.repeat(28);
    api.logs = [log('2026-03-30'), { ...log('2026-03-29'), completed: false }];
    await page.goto(`${origin}/habits/read`);
    await expect(check(page)).toBeEnabled();
    await expect(page.getByRole('heading', { name: api.habit.title, exact: true })).toBeVisible();
    for (const locator of [check(page).locator('..'), page.getByRole('button', { name: 'Volver', exact: true }),
      page.getByRole('button', { name: 'Editar hábito', exact: true }), page.getByRole('button', { name: 'Ocultar hábito', exact: true })]) {
      const box = await locator.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const history = page.getByRole('listitem');
    await expect(history).toHaveCount(2);
    expect(await history.first().evaluate(el => parseFloat(getComputedStyle(el).borderTopWidth))).toBeGreaterThanOrEqual(1);
    await expect(history.getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Historial del mes actual de la cuenta', exact: true })).toBeVisible();
    if (width === 375) {
      api.habit.title = 'Leer por la noche';
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Leer por la noche', exact: true })).toBeVisible();
      await expect(check(page)).toBeEnabled();
      await page.screenshot({ path: testInfo.outputPath('habit-detail-mobile.png'), fullPage: true });
    }
    await page.getByRole('button', { name: 'Ocultar hábito', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('El historial se conserva.');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    expect(writes(api)).toHaveLength(0);
  });
}

test.describe('account date differs from browser date', () => {
  test.use({ timezoneId: 'Asia/Tokyo' });
  test('manual check uses account day; focus after midnight discards old data without schedule gates', async ({ page, api }) => {
    api.habit.configuration = quantityGoal(20, 'páginas', { kind: 'weekdays', days: [2] });
    await page.goto(`${origin}/habits/read`);
    await expect(page.getByText('Fecha de la cuenta: 2026-03-31')).toBeVisible();
    await expect(check(page)).toBeEnabled();
    await page.clock.setSystemTime(new Date('2026-04-01T07:00:01Z'));
    await check(page).click();
    expect(writes(api)).toHaveLength(0);
    api.today = '2026-04-01';
    const reads = calls(api, '/habits/read/logs').length;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByText('Fecha de la cuenta: 2026-04-01')).toBeVisible();
    await expect(check(page)).toBeEnabled();
    expect(calls(api, '/habits/read/logs').length).toBeGreaterThan(reads);
  });
});
