const path = require('node:path');
const { test: base, expect } = require(require.resolve('@playwright/test', {
  paths: [process.cwd(), ...process.env.PATH.split(path.delimiter).map(p => path.resolve(p, '..'))],
}));
const origin = 'http://127.0.0.1:4173';
const profile = { fullName: 'Detail user', email: 'detail@example.invalid', token: 'detail-token', timeZone: 'America/Los_Angeles', roles: ['user'] };
const log = (day, id = day) => ({ _id: id, habitId: 'read', date: `${day}T00:00:00.000Z`, completed: true });
const quantityGoal = (target = 20, unit = 'páginas', schedule = { kind: 'daily' }) => ({ schedule, goal: { kind: 'quantity', target, unit } });
const snapshot = configuration => ({ configuration });
function syntheticWeek(api, selected = '2026-03-31') {
  const configurationFor = date => api.dateConfigurations[date] ?? api.habit.configuration ?? dailyCheckbox;
  const selectedLog = api.logs.find(l => l.date.slice(0, 10) === selected);
  const configuration = selectedLog?.configurationSnapshot?.configuration ?? configurationFor(selected);
  const monday = new Date(`${selected}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() || 7) - 1));
  const days = Array.from({ length: 7 }, (_, i) => {
    const anchor = new Date(monday);
    anchor.setUTCDate(anchor.getUTCDate() + i);
    const date = anchor.toISOString().slice(0, 10);
    const entry = api.logs.find(l => l.date.slice(0, 10) === date);
    return { date, scheduled: true, completed: entry?.completed ?? false,
      ...(entry?.amount !== undefined ? { amount: entry.amount } : {}),
      configurationSnapshot: entry?.configurationSnapshot ?? snapshot(configurationFor(date)) };
  });
  const selectedDay = days.find(d => d.date === selected);
  const schedule = configuration.schedule;
  const scheduledOnDate = schedule.kind !== 'weekdays' || schedule.days.includes(new Date(`${selected}T00:00:00Z`).getUTCDay() || 7);
  selectedDay.scheduled = scheduledOnDate;
  return { habitId: api.habit.habitId, date: selected, weekStart: days[0].date, weekEnd: days[6].date,
    configuration, scheduledOnDate, completedDays: days.filter(d => d.completed).length,
    ...(configuration.schedule.kind === 'weekly' ? { weeklyTarget: configuration.schedule.timesPerWeek,
      weeklyCompleted: days.filter(d => d.completed).length >= configuration.schedule.timesPerWeek } : {}), days };
}
const test = base.extend({
  api: [async ({ page }, use) => {
    const api = {
      calls: [], unexpected: [], detailStatus: 200, historyStatus: 200, mutationStatus: 200, weekStatus: 200, week: null, dateConfigurations: {}, lifecycleSettled: 0,
      habit: { habitId: 'read', title: 'Leer autorizado', slug: 'leer', active: true },
      logs: [], beforeDetail: async () => {}, beforeHistory: async () => {}, beforeMutation: async () => {}, beforeWeek: async () => {},
    };
    await page.clock.install({ time: new Date('2026-04-01T00:30:00Z') });
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', 'yes');
        localStorage.setItem('token', 'stored-detail-token');
        localStorage.setItem('completedHabits_2026-03-31', '["read"]');
      }
    });
    // Only local static GETs are forwarded. Every API write is fulfilled here or blocked.
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url()), method = req.method();
      const headers = { 'access-control-allow-origin': origin };
      const reply = (json, status = 200) => route.fulfill({ json, status, headers });
      if (['fetch', 'xhr'].includes(req.resourceType())) {
        api.calls.push({ path: url.pathname, search: url.search, method, body: req.postDataJSON() });
        if (method === 'GET' && url.pathname.endsWith('/auth/check-status')) return reply(profile);
        if (method === 'GET' && url.pathname.endsWith('/habits')) return reply([]);
        if (method === 'GET' && url.pathname.endsWith('/habits/logs')) return reply([]);
        if (method === 'GET' && /\/habits\/[^/]+\/week$/.test(url.pathname)) {
          const week = api.week ?? syntheticWeek(api, url.searchParams.get('date') ?? '2026-03-31');
          await api.beforeWeek();
          return reply(week, api.weekStatus);
        }
        if (method === 'GET' && /\/habits\/[^/]+\/logs$/.test(url.pathname)) {
          const start = url.searchParams.get('startDate') ?? '2026-03-01';
          const end = url.searchParams.get('endDate') ?? '2026-03-31';
          const logs = api.logs.filter(l => l.date.slice(0, 10) >= start && l.date.slice(0, 10) <= end);
          await api.beforeHistory(url.searchParams);
          return reply(logs, api.historyStatus);
        }
        if (method === 'GET' && /\/habits\/[^/]+$/.test(url.pathname)) {
          const habit = { ...api.habit };
          await api.beforeDetail();
          if (api.detailStatus === 0) return route.abort();
          return reply(habit, api.detailStatus);
        }
        if (method === 'PATCH' && /\/habits\/read\/logs\/[^/]+$/.test(url.pathname)) {
          const date = url.pathname.split('/').pop(), body = req.postDataJSON();
          await api.beforeMutation();
          if (api.mutationStatus !== 200) return reply({ message: 'Synthetic failure' }, api.mutationStatus);
          const existing = api.logs.find(l => l.date.slice(0, 10) === date);
          const configuration = existing?.configurationSnapshot?.configuration ?? api.dateConfigurations[date] ?? api.habit.configuration ?? dailyCheckbox;
          const entry = { ...log(date), ...(existing ?? {}),
            ...(!existing ? { configurationSnapshot: snapshot(configuration) } : {}) };
          if ('amount' in body) { entry.amount = body.amount; entry.completed = body.amount >= configuration.goal.target; }
          if ('completed' in body) entry.completed = body.completed;
          if ('note' in body) { if (body.note) entry.note = body.note; else delete entry.note; }
          api.logs = [...api.logs.filter(l => l.date.slice(0, 10) !== date), entry];
          return reply(entry);
        }
        if (method === 'PATCH' && url.pathname.endsWith('/habits/read/lifecycle')) {
          const body = req.postDataJSON(), status = api.mutationStatus;
          const response = api.lifecycleResponse ?? { habitId: 'read', status: body.status, active: body.status === 'active' };
          await api.beforeMutation();
          api.lifecycleSettled++;
          if (status !== 200) return reply({ message: 'Synthetic failure' }, status);
          Object.assign(api.habit, response);
          return reply(response);
        }
        if (method === 'PATCH' && url.pathname.endsWith('/habits/read/definition')) {
          const body = req.postDataJSON();
          await api.beforeMutation();
          if (api.mutationStatus !== 200) return reply({ message: 'Synthetic failure' }, api.mutationStatus);
          for (const field of ['title', 'category', 'color', 'icon']) {
            if (field in body) {
              if (body[field] === '') delete api.habit[field];
              else api.habit[field] = body[field];
            }
          }
          if (body.configuration) api.habit.pendingConfiguration = {
            revisionId: 'pending-revision', effectiveFrom: '2026-04-01', configuration: body.configuration,
          };
          return reply({ ...api.habit });
        }
        if (['POST', 'DELETE', 'PATCH'].includes(method) && /\/habits\/read(?:\/(?:complete|incomplete))?$/.test(url.pathname)) {
          await api.beforeMutation();
          if (api.mutationStatus !== 200) return reply({ message: 'Synthetic failure' }, api.mutationStatus);
          if (method === 'POST') {
            const existing = api.logs.find(l => l.date.slice(0, 10) === '2026-03-31');
            const configuration = existing?.configurationSnapshot?.configuration ?? api.habit.configuration ?? dailyCheckbox;
            const body = req.postDataJSON();
            const entry = { ...log('2026-03-31'), ...(existing ?? {}),
              configurationSnapshot: existing?.configurationSnapshot ?? snapshot(configuration),
              completed: configuration.goal.kind === 'checkbox' ? true : body.amount >= configuration.goal.target,
              ...(body?.amount !== undefined ? { amount: body.amount } : {}) };
            api.logs = [...api.logs.filter(l => l.date.slice(0, 10) !== '2026-03-31'), entry];
            return reply(entry);
          }
          if (method === 'DELETE') { api.logs = api.logs.filter(l => l.date !== log('2026-03-31').date); return reply({ acknowledged: true, deletedCount: 1 }); }
          api.habit.active = false;
          return reply({ ...api.habit, _id: 'association', userId: 'synthetic-user' });
        }
        api.unexpected.push(`${method} ${url.pathname}`);
        return route.abort();
      }
      if (url.origin === origin && method === 'GET' && !url.pathname.startsWith('/api')) return route.continue();
      return route.abort();
    });
    await use(api);
    expect(api.unexpected, 'No real API or Google traffic').toEqual([]);
  }, { auto: true }],
});
test.use({ timezoneId: 'America/Los_Angeles' });
const title = page => page.getByRole('heading', { name: 'Leer autorizado', exact: true });
const calls = (api, suffix, method = 'GET') => api.calls.filter(c => c.path.endsWith(suffix) && c.method === method);
const deferred = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
async function navigate(page, id, state = null) {
  await page.evaluate(({ id, state }) => {
    history.pushState({ usr: state }, '', `/habits/${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, { id, state });
}

test('direct URL and refresh load authoritative detail and default account-month history', async ({ page, api }) => {
  api.logs = [log('2026-03-30')];
  await page.goto(`${origin}/habits/read`);
  await expect(title(page)).toBeVisible();
  await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
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
    await expect(page.getByRole('region', { name: 'Corregir un registro', exact: true })).toHaveCount(0);
    expect(calls(api, `/habits/${id}/logs`)).toHaveLength(0);
    expect(calls(api, `/habits/${id}/week`)).toHaveLength(0);
  }
});

test('loading hides old data; generic detail failure can retry without ordinary render refetches', async ({ page, api }) => {
  const pending = deferred();
  api.beforeDetail = () => pending.promise;
  api.detailStatus = 500;
  try {
    await page.goto(`${origin}/habits/read`);
    await expect(page.locator('.animate-spin')).toBeVisible();
    await expect(title(page)).toHaveCount(0);
  } finally { pending.release(); }
  await expect(page.getByText('No se pudo cargar el hábito.')).toBeVisible();
  api.detailStatus = 200;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(title(page)).toBeVisible();
  // Wait for all initial owned reads, including the independent new week request.
  await expect(page.getByRole('region', { name: 'Semana', exact: true }).getByRole('row')).toHaveCount(8);
  const before = api.calls.length;
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.clock.runFor(1000);
  expect(api.calls).toHaveLength(before);
});

test('history failure retries and does not display stale historical data', async ({ page, api }) => {
  api.historyStatus = 500;
  api.logs = [log('2026-03-30')];
  await page.goto(`${origin}/habits/read`);
  await expect(page.getByText('No se pudieron cargar los registros.')).toBeVisible();
  await expect(page.getByText('lunes, 30 de marzo de 2026')).toHaveCount(0);
  api.historyStatus = 200;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
});

test('inactive owner retains label-safe history but no active mutation controls', async ({ page, api }) => {
  api.habit.active = false;
  api.logs = [log('2026-03-30'), log('2026-03-31')];
  await page.goto(`${origin}/habits/read`);
  await expect(title(page)).toBeVisible();
  await expect(page.getByText('Pausado', { exact: true })).toBeVisible();
  await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
  await expect(page.getByRole('button', { name: /Completar|Eliminar registro|Desactivar/ })).toHaveCount(0);
});

test('only account today is editable, undo and completion update synthetic history and cache', async ({ page, api }) => {
  api.logs = [log('2026-03-30'), log('2026-03-31'), log('2026-04-01')];
  await page.goto(`${origin}/habits/read`);
  const todayRow = page.getByRole('listitem').filter({ hasText: 'martes, 31 de marzo de 2026' });
  await expect(todayRow.getByRole('button', { name: 'Eliminar registro' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Eliminar registro' })).toHaveCount(1);
  await todayRow.getByRole('button', { name: 'Eliminar registro' }).click();
  await expect(todayRow).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('completedHabits_2026-03-31')))).not.toContain('read');
  await page.getByRole('button', { name: 'Completar hoy', exact: true }).click();
  await expect(todayRow).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('completedHabits_2026-03-31')))).toContain('read');
  expect(calls(api, '/habits/read/incomplete', 'DELETE')).toHaveLength(1);
  expect(calls(api, '/habits/read/complete', 'POST')).toHaveLength(1);
});

test('mutation failures preserve view and recover; confirmed pause retains detail', async ({ page, api }) => {
  api.logs = [log('2026-03-31')];
  api.mutationStatus = 500;
  await page.goto(`${origin}/habits/read`);
  await page.getByRole('button', { name: 'Eliminar registro' }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo actualizar el hábito.');
  await expect(page.getByText('martes, 31 de marzo de 2026')).toBeVisible();
  api.mutationStatus = 200;
  await page.getByRole('button', { name: 'Eliminar registro' }).click();
  api.mutationStatus = 500;
  await page.getByRole('button', { name: 'Completar hoy', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(title(page)).toBeVisible();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, pausar', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(title(page)).toBeVisible();
  api.mutationStatus = 200;
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, pausar', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/habits/read`);
  await expect(page.getByText('Pausado', { exact: true })).toBeVisible();
  expect(calls(api, '/habits/read/lifecycle', 'PATCH').map(c => c.body)).toEqual([{ status: 'paused' }, { status: 'paused' }]);
  expect(calls(api, '/habits/read', 'PATCH')).toHaveLength(0);
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

test('account midnight refreshes month history and removes previous-day edit control', async ({ page, api }) => {
  await page.clock.setSystemTime(new Date('2026-04-01T06:59:59Z'));
  api.logs = [log('2026-03-31')];
  await page.goto(`${origin}/habits/read`);
  await expect(page.getByRole('button', { name: 'Eliminar registro' })).toBeVisible();
  const before = calls(api, '/habits/read/logs').length;
  api.logs = [];
  await page.clock.runFor(1100);
  await expect.poll(() => calls(api, '/habits/read/logs').length).toBeGreaterThan(before);
  await expect(page.getByText('martes, 31 de marzo de 2026')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Completar hoy', exact: true })).toBeVisible();
});

test('transport failure is generic and retry recovers', async ({ page, api }) => {
  api.detailStatus = 0;
  await page.goto(`${origin}/habits/read`);
  await expect(page.getByText('No se pudo cargar el hábito.')).toBeVisible();
  api.detailStatus = 200;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(title(page)).toBeVisible();
});

test('loaded route data disappears while the next route is still pending', async ({ page, api }) => {
  api.logs = [log('2026-03-30')];
  await page.goto(`${origin}/habits/read`);
  await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
  const pending = deferred();
  api.beforeDetail = () => pending.promise;
  try {
    await navigate(page, 'walk');
    await expect(page.locator('.animate-spin')).toBeVisible();
    await expect(title(page)).toHaveCount(0);
    await expect(page.getByText('lunes, 30 de marzo de 2026')).toHaveCount(0);
  } finally { pending.release(); }
});

test('late unmounted completion cannot refill cache after logout', async ({ page, api }) => {
  await page.goto(`${origin}/habits/read`);
  await expect(page.getByRole('button', { name: 'Completar hoy', exact: true })).toBeVisible();
  const pending = deferred();
  api.beforeMutation = () => pending.promise;
  try {
    await page.getByRole('button', { name: 'Completar hoy', exact: true }).click();
    await expect.poll(() => calls(api, '/habits/read/complete', 'POST').length).toBe(1);
    await page.getByRole('button', { name: 'Salir', exact: true }).click();
    await expect(page).toHaveURL(`${origin}/login`);
  } finally { pending.release(); }
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => localStorage.getItem('completedHabits_2026-03-31'))).toBeNull();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

const dailyCheckbox = { schedule: { kind: 'daily' }, goal: { kind: 'checkbox' } };
// JSON property order and ISO-day ordering are not configuration changes.
const pendingGoal = { schedule: { days: [7, 1], kind: 'weekdays' }, goal: { unit: 'páginas', target: 20, kind: 'quantity' } };
async function openEdit(page) {
  await page.goto(`${origin}/habits/read`);
  await page.getByRole('button', { name: 'Editar hábito', exact: true }).click();
  return page.getByRole('dialog', { name: 'Editar hábito', exact: true });
}

test('metadata-only edit initializes pending goal, clears only changed metadata and refreshes detail', async ({ page, api }) => {
  Object.assign(api.habit, { category: 'Lectura', color: '#123abc', icon: 'unknown-icon', configuration: dailyCheckbox,
    pendingConfiguration: { revisionId: 'existing', effectiveFrom: '2026-04-01', configuration: pendingGoal } });
  api.logs = [log('2026-03-30')];
  const dialog = await openEdit(page);
  await expect(dialog.getByLabel('Frecuencia', { exact: true })).toHaveValue('weekdays');
  await expect(dialog.getByLabel('Lunes', { exact: true })).toBeChecked();
  await expect(dialog.getByLabel('Domingo', { exact: true })).toBeChecked();
  await expect(dialog.getByLabel('Cantidad objetivo', { exact: true })).toHaveValue('20');
  await expect(dialog.getByLabel('Icono', { exact: true })).toHaveValue('unknown-icon');
  await dialog.getByLabel('Título', { exact: true }).fill('  Lectura personal  ');
  for (const label of ['Categoría', 'Color', 'Icono']) await dialog.getByLabel(label, { exact: true }).fill('   ');
  const before = calls(api, '/habits/read').length;
  await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Lectura personal', exact: true })).toBeVisible();
  expect(calls(api, '/habits/read/definition', 'PATCH').map(c => c.body)).toEqual([
    { title: 'Lectura personal', category: '', color: '', icon: '' },
  ]);
  expect(calls(api, '/habits/read').length).toBeGreaterThan(before);
  await expect(page.getByText('Configuración actual: Diario · Marcar completado', { exact: true })).toBeVisible();
  await expect(page.getByText(/Desde el 2026-04-01: Lunes, Domingo · 20 páginas por día/)).toBeVisible();
  await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
});

test('configuration edit sends full bundle, keeps current goal and displays authoritative pending date', async ({ page, api }) => {
  api.habit.configuration = dailyCheckbox;
  const dialog = await openEdit(page);
  await dialog.getByLabel('Frecuencia', { exact: true }).selectOption('weekly');
  await dialog.getByLabel('Días por semana', { exact: true }).fill('3');
  await dialog.getByLabel('Tipo de objetivo', { exact: true }).selectOption('quantity');
  await dialog.getByLabel('Cantidad objetivo', { exact: true }).fill('15.5');
  await dialog.getByLabel('Unidad', { exact: true }).fill(' minutos ');
  await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(calls(api, '/habits/read/definition', 'PATCH')[0].body).toEqual({ configuration: {
    schedule: { kind: 'weekly', timesPerWeek: 3 }, goal: { kind: 'quantity', target: 15.5, unit: 'minutos' },
  } });
  await expect(page.getByText('Configuración actual: Diario · Marcar completado', { exact: true })).toBeVisible();
  await expect(page.getByText(/Desde el 2026-04-01: 3 días por semana · 15.5 minutos por día/)).toBeVisible();
  // Pending quantity must not disable today's current checkbox goal.
  await expect(page.getByRole('button', { name: 'Completar hoy', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Completar hoy', exact: true }).click();
  expect(calls(api, '/habits/read/complete', 'POST')[0].body).toBeNull();
});

test('quantity to checkbox edit omits irrelevant goal fields and sends the complete schedule', async ({ page, api }) => {
  api.habit.configuration = pendingGoal;
  const dialog = await openEdit(page);
  await dialog.getByLabel('Tipo de objetivo', { exact: true }).selectOption('checkbox');
  await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(calls(api, '/habits/read/definition', 'PATCH')[0].body).toEqual({ configuration: {
    schedule: { kind: 'weekdays', days: [1, 7] }, goal: { kind: 'checkbox' },
  } });
  // Today's authoritative goal remains quantitative, and Tuesday is not selected.
  await expect(page.getByRole('button', { name: 'Guardar cantidad', exact: true })).toBeDisabled();
});

test('legacy inactive owner can edit metadata without configuration or lifecycle mutation', async ({ page, api }) => {
  api.habit.active = false;
  const dialog = await openEdit(page);
  await expect(dialog.getByLabel('Frecuencia', { exact: true })).toHaveValue('daily');
  await expect(dialog.getByLabel('Tipo de objetivo', { exact: true })).toHaveValue('checkbox');
  await dialog.getByLabel('Categoría', { exact: true }).fill(' Personal ');
  await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(calls(api, '/habits/read/definition', 'PATCH')[0].body).toEqual({ category: 'Personal' });
  expect(api.habit.active).toBe(false);
  expect(calls(api, '/habits/read', 'PATCH')).toHaveLength(0);
});

test('edit rejection preserves form and history then supports retry; 404 is localized', async ({ page, api }) => {
  api.logs = [log('2026-03-30')];
  const dialog = await openEdit(page);
  await dialog.getByLabel('Título', { exact: true }).fill('Título nuevo');
  for (const status of [400, 404, 500]) {
    api.mutationStatus = status;
    await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText(status === 404 ? 'Hábito no encontrado' : status === 400 ? 'Revisa los datos' : 'No se pudo guardar');
    await expect(dialog.getByLabel('Título', { exact: true })).toHaveValue('Título nuevo');
    await expect(title(page)).toBeVisible();
    await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
  }
  api.mutationStatus = 200;
  await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Título nuevo', exact: true })).toBeVisible();
});

test('current quantity definition disables binary completion and unknown metadata remains render-safe', async ({ page, api }) => {
  Object.assign(api.habit, { icon: 'constructor', color: 'url(unsafe)', configuration: pendingGoal });
  await page.goto(`${origin}/habits/read`);
  await expect(page.getByRole('button', { name: 'Guardar cantidad', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Completar hoy', exact: true })).toHaveCount(0);
  expect(calls(api, '/habits/read/complete', 'POST')).toHaveLength(0);
});

test('late definition response after route change cannot overwrite the new owned detail', async ({ page, api }) => {
  const dialog = await openEdit(page);
  await dialog.getByLabel('Título', { exact: true }).fill('Título tardío');
  const pending = deferred();
  api.beforeMutation = () => pending.promise;
  try {
    await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect.poll(() => calls(api, '/habits/read/definition', 'PATCH').length).toBe(1);
    api.habit = { habitId: 'walk', title: 'Caminar autorizado', active: true };
    await navigate(page, 'walk');
    await expect(page.getByRole('heading', { name: 'Caminar autorizado', exact: true })).toBeVisible();
  } finally { pending.release(); }
  await page.clock.runFor(1000);
  await expect(page.getByRole('heading', { name: 'Título tardío', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('saved definition refresh failure retains history and offers retry without another PATCH', async ({ page, api }) => {
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

test('unchanged edit and Escape cancel send no PATCH and restore focus to edit control', async ({ page, api }) => {
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
  expect(calls(api, '/habits/read/definition', 'PATCH')).toHaveLength(0);
});

test('explicit inactive status wins over stale active boolean in detail', async ({ page, api }) => {
  Object.assign(api.habit, { status: 'archived', active: true });
  await page.goto(`${origin}/habits/read`);
  await expect(title(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar hábito', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Completar hoy|Desactivar/ })).toHaveCount(0);
});

test('expired definition mutation performs full session cleanup', async ({ page, api }) => {
  const dialog = await openEdit(page);
  await dialog.getByLabel('Título', { exact: true }).fill('Cambio expirado');
  api.mutationStatus = 401;
  await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/login`);
  expect(await page.evaluate(() => ['token', 'fullName', 'email', 'picture', 'timeZone', 'completedHabits_2026-03-31'].map(k => localStorage.getItem(k)))).toEqual(Array(6).fill(null));
});

test('expired detail uses existing full session cleanup', async ({ page, api }) => {
  api.detailStatus = 401;
  await page.goto(`${origin}/habits/read`);
  await expect(page).toHaveURL(`${origin}/login`);
  expect(await page.evaluate(() => ['token', 'fullName', 'email', 'picture', 'timeZone', 'completedHabits_2026-03-31'].map(k => localStorage.getItem(k)))).toEqual(Array(6).fill(null));
});

const progress = page => page.getByRole('region', { name: 'Progreso de hoy', exact: true });
const weekPanel = page => page.getByRole('region', { name: 'Semana', exact: true });
async function saveAmount(page, value) {
  await progress(page).getByLabel('Cantidad de hoy', { exact: true }).fill(value);
  await progress(page).getByRole('button', { name: 'Guardar cantidad', exact: true }).click();
}

test('quantity zero, decimals and replacement totals use original target and stored completion', async ({ page, api }) => {
  api.habit.configuration = quantityGoal();
  api.habit.pendingConfiguration = { effectiveFrom: '2026-04-01', revisionId: 'pending', configuration: dailyCheckbox };
  await page.goto(`${origin}/habits/read`);
  await expect(progress(page)).toContainText('Objetivo original: 20 páginas');
  await saveAmount(page, '0');
  await expect(progress(page)).toContainText('Cantidad registrada: 0 páginas');
  await expect(progress(page)).toContainText('Sin completar');
  await expect(weekPanel(page)).toContainText('0 días completados');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('completedHabits_2026-03-31')))).not.toContain('read');
  await saveAmount(page, '20.5');
  await expect(progress(page)).toContainText('Completado');
  await expect(weekPanel(page)).toContainText('1 días completados');
  await saveAmount(page, '3');
  await expect(progress(page)).toContainText('Cantidad registrada: 3 páginas');
  await expect(progress(page)).toContainText('Sin completar');
  expect(calls(api, '/habits/read/complete', 'POST').map(c => c.body)).toEqual([{ amount: 0 }, { amount: 20.5 }, { amount: 3 }]);
  expect(calls(api, '/habits/read/logs').length).toBeGreaterThanOrEqual(4);
  expect(calls(api, '/habits/read/week').length).toBeGreaterThanOrEqual(4);
});

test('amount validation rejects empty, negative, nonfinite and over-limit values without POST', async ({ page, api }) => {
  api.habit.configuration = quantityGoal();
  await page.goto(`${origin}/habits/read`);
  for (const value of ['', '-1', 'NaN', 'Infinity', '1e309', '1000000001', 'texto']) {
    await saveAmount(page, value);
    await expect(progress(page).getByRole('alert')).toContainText('Introduce una cantidad finita entre 0 y 1000000000.');
    expect(calls(api, '/habits/read/complete', 'POST')).toHaveLength(0);
  }
  await saveAmount(page, '1000000000');
  await expect(progress(page)).toContainText('Cantidad registrada: 1000000000 páginas');
});

test('today snapshot wins over current and pending definitions and does not recalculate completed', async ({ page, api }) => {
  api.habit.configuration = dailyCheckbox;
  api.habit.pendingConfiguration = { effectiveFrom: '2026-04-01', revisionId: 'pending', configuration: quantityGoal(100, 'minutos') };
  api.logs = [{ ...log('2026-03-31'), amount: 2, configurationSnapshot: snapshot(quantityGoal(10, 'km')) }];
  await page.goto(`${origin}/habits/read`);
  await expect(progress(page)).toContainText('Objetivo original: 10 km');
  await expect(progress(page)).toContainText('Cantidad registrada: 2 km');
  await expect(progress(page)).toContainText('Completado');
  await expect(page.getByRole('button', { name: 'Completar hoy', exact: true })).toHaveCount(0);
  await saveAmount(page, '5');
  await expect(progress(page)).toContainText('Sin completar');
  await expect(progress(page)).toContainText('Objetivo original: 10 km');
});

test('legacy missing amount stays unknown rather than inferred from target or completion', async ({ page, api }) => {
  api.habit.configuration = quantityGoal(40, 'minutos');
  api.logs = [log('2026-03-31')];
  await page.goto(`${origin}/habits/read`);
  await expect(progress(page)).toContainText('Cantidad no registrada (registro antiguo).');
  await expect(progress(page).getByLabel('Cantidad de hoy', { exact: true })).toHaveValue('');
  await expect(progress(page)).toContainText('Completado');
  await expect(weekPanel(page)).toContainText('Cantidad no registrada');
  expect(calls(api, '/habits/read/complete', 'POST')).toHaveLength(0);
});

for (const status of ['paused', 'archived']) {
  test(`${status} status blocks measured progress even with stale active true`, async ({ page, api }) => {
    Object.assign(api.habit, { active: true, status, configuration: quantityGoal() });
    api.logs = [{ ...log('2026-03-31'), amount: 4 }];
    await page.goto(`${origin}/habits/read`);
    await expect(progress(page)).toContainText('Cantidad registrada: 4 páginas');
    await expect(progress(page).getByRole('button', { name: 'Guardar cantidad' })).toHaveCount(0);
    await expect(weekPanel(page).getByRole('row')).toHaveCount(8);
    expect(calls(api, '/habits/read/complete', 'POST')).toHaveLength(0);
  });
}

for (const kind of ['quantity', 'checkbox']) {
  test(`selected weekdays gate new ${kind} records but existing snapshot schedule remains authoritative`, async ({ page, api }) => {
    api.habit.configuration = { schedule: { kind: 'weekdays', days: [1] }, goal: kind === 'quantity' ? quantityGoal().goal : dailyCheckbox.goal };
    await page.goto(`${origin}/habits/read`);
    await expect(progress(page)).toContainText('Hoy no está programado.');
    const button = page.getByRole('button', { name: kind === 'quantity' ? 'Guardar cantidad' : 'Completar hoy', exact: true });
    await expect(button).toBeDisabled();
    api.logs = [{ ...log('2026-03-31'), completed: false,
      ...(kind === 'quantity' ? { amount: 1 } : {}),
      configurationSnapshot: snapshot({ schedule: { kind: 'weekdays', days: [7] }, goal: api.habit.configuration.goal }) }];
    await page.reload();
    await expect(button).toBeEnabled();
    if (kind === 'quantity') await saveAmount(page, '20');
    else await button.click();
    await expect.poll(() => calls(api, '/habits/read/complete', 'POST').length).toBe(1);
  });
}

test('seven-day week uses synthetic midweek originals and selected-date quota, never quantity sums', async ({ page, api }) => {
  api.habit.configuration = quantityGoal(100, 'minutos', { kind: 'weekly', timesPerWeek: 5 });
  api.logs = [{ ...log('2026-03-30'), amount: 2, configurationSnapshot: snapshot(quantityGoal(2, 'km')) },
    { ...log('2026-03-31'), amount: 0, completed: false, configurationSnapshot: snapshot(quantityGoal(10, 'páginas', { kind: 'weekly', timesPerWeek: 3 })) }];
  api.week = { ...syntheticWeek(api), configuration: api.logs[1].configurationSnapshot.configuration,
    weeklyTarget: 3, weeklyCompleted: false };
  await page.goto(`${origin}/habits/read`);
  const panel = weekPanel(page);
  await expect(panel.getByRole('row')).toHaveCount(8);
  await expect(panel).toContainText('Fecha seleccionada: 2026-03-31');
  await expect(panel).toContainText('Cuota de la fecha seleccionada: 3 días');
  await expect(panel).toContainText('1 días completados');
  await expect(panel.getByRole('row').filter({ hasText: '2026-03-30' })).toContainText('2 km');
  await expect(panel.getByRole('row').filter({ hasText: '2026-03-31' })).toContainText('10 páginas');
  await expect(panel.getByRole('row').filter({ hasText: '2026-04-01' })).toContainText('100 minutos');
  expect(calls(api, '/habits/read/week').every(c => c.search === '')).toBe(true);
});

test('week failure retries independently without losing loaded history or definition', async ({ page, api }) => {
  api.weekStatus = 500;
  api.logs = [log('2026-03-30')];
  await page.goto(`${origin}/habits/read`);
  await expect(weekPanel(page).getByRole('alert')).toContainText('No se pudo cargar la semana.');
  await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Completar hoy', exact: true })).toBeEnabled();
  const detailReads = calls(api, '/habits/read').length;
  const historyReads = calls(api, '/habits/read/logs').length;
  api.weekStatus = 200;
  await weekPanel(page).getByRole('button', { name: 'Reintentar semana' }).click();
  await expect(weekPanel(page).getByRole('row')).toHaveCount(8);
  expect(calls(api, '/habits/read')).toHaveLength(detailReads);
  expect(calls(api, '/habits/read/logs')).toHaveLength(historyReads);
});

for (const failed of ['history', 'week']) {
  test(`saved amount with ${failed} refresh failure retries reads without repeating mutation`, async ({ page, api }) => {
    api.habit.configuration = quantityGoal();
    await page.goto(`${origin}/habits/read`);
    await expect(weekPanel(page).getByRole('row')).toHaveCount(8);
    api[failed === 'history' ? 'historyStatus' : 'weekStatus'] = 500;
    await saveAmount(page, '25');
    await expect(page.getByText(failed === 'history' ? 'La cantidad se guardó, pero no se pudieron recargar los registros.' : 'No se pudo cargar la semana.', { exact: true })).toBeVisible();
    await expect(progress(page)).toContainText('Cantidad registrada: 25 páginas');
    api.historyStatus = api.weekStatus = 200;
    await page.getByRole('button', { name: failed === 'history' ? 'Reintentar registros' : 'Reintentar semana', exact: true }).click();
    await expect(weekPanel(page)).toContainText('1 días completados');
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(calls(api, '/habits/read/complete', 'POST')).toHaveLength(1);
  });
}

test('empty week shows seven dates; owned detail must finish before week request', async ({ page, api }) => {
  const held = deferred();
  api.beforeDetail = () => held.promise;
  try {
    await page.goto(`${origin}/habits/read`);
    await expect(page.locator('.animate-spin')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Corregir un registro', exact: true })).toHaveCount(0);
    expect(calls(api, '/habits/read/week')).toHaveLength(0);
  } finally { held.release(); }
  await expect(weekPanel(page).getByRole('row')).toHaveCount(8);
  await expect(weekPanel(page)).toContainText('0 días completados');
  await expect(weekPanel(page)).toContainText('2026-04-05');
});

test('late week route response cannot flash another habit', async ({ page, api }) => {
  const held = deferred();
  api.beforeWeek = () => held.promise;
  try {
    await page.goto(`${origin}/habits/read`);
    await expect.poll(() => calls(api, '/habits/read/week').length).toBe(1);
    api.beforeWeek = async () => {};
    api.habit = { habitId: 'walk', title: 'Caminar autorizado', active: true };
    await navigate(page, 'walk');
    await expect(page.getByRole('heading', { name: 'Caminar autorizado' })).toBeVisible();
    await expect(weekPanel(page).getByRole('row')).toHaveCount(8);
  } finally { held.release(); }
  await page.clock.runFor(500);
  await expect(title(page)).toHaveCount(0);
});

test('late measured mutation after logout cannot refresh or refill account cache', async ({ page, api }) => {
  api.habit.configuration = quantityGoal();
  await page.goto(`${origin}/habits/read`);
  await expect(weekPanel(page).getByRole('row')).toHaveCount(8);
  const held = deferred();
  api.beforeMutation = () => held.promise;
  const reads = calls(api, '/habits/read/week').length;
  try {
    await saveAmount(page, '25');
    await expect(progress(page).getByRole('button', { name: 'Guardando cantidad...' })).toBeDisabled();
    await page.getByRole('button', { name: 'Salir', exact: true }).click();
    await expect(page).toHaveURL(`${origin}/login`);
  } finally { held.release(); }
  await page.clock.runFor(500);
  expect(calls(api, '/habits/read/week')).toHaveLength(reads);
  expect(await page.evaluate(() => localStorage.getItem('completedHabits_2026-03-31'))).toBeNull();
});

test('401 measured progress clears session; ordinary failure retains editable amount', async ({ page, api }) => {
  api.habit.configuration = quantityGoal();
  await page.goto(`${origin}/habits/read`);
  api.mutationStatus = 500;
  await saveAmount(page, '5');
  await expect(page.getByRole('alert')).toContainText('No se pudo actualizar el hábito.');
  await expect(progress(page).getByLabel('Cantidad de hoy')).toHaveValue('5');
  api.mutationStatus = 401;
  await saveAmount(page, '5');
  await expect(page).toHaveURL(`${origin}/login`);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});

test('original checkbox snapshot keeps bodyless completion despite current quantity definition', async ({ page, api }) => {
  api.habit.configuration = quantityGoal();
  api.logs = [{ ...log('2026-03-31'), completed: false, configurationSnapshot: snapshot(dailyCheckbox) }];
  await page.goto(`${origin}/habits/read`);
  await expect(progress(page)).toContainText('Objetivo original: Marcar completado');
  await expect(progress(page).getByLabel('Cantidad de hoy')).toHaveCount(0);
  await page.getByRole('button', { name: 'Completar hoy', exact: true }).click();
  await expect(progress(page)).toContainText('Completado');
  expect(calls(api, '/habits/read/complete', 'POST').map(c => c.body)).toEqual([null]);
});

test('new amount on selected account weekday is allowed and week loading does not block history', async ({ page, api }) => {
  api.habit.configuration = quantityGoal(20, 'páginas', { kind: 'weekdays', days: [2] });
  const held = deferred();
  api.beforeWeek = () => held.promise;
  try {
    await page.goto(`${origin}/habits/read`);
    await expect(weekPanel(page).getByRole('status')).toContainText('Cargando semana');
    await expect(page.getByText('Aún no hay registros para este hábito.')).toBeVisible();
    await expect(progress(page).getByRole('button', { name: 'Guardar cantidad' })).toBeEnabled();
  } finally { held.release(); }
  await saveAmount(page, '20');
  await expect(progress(page)).toContainText('Completado');
  await expect(weekPanel(page)).toContainText('1 días completados');
});

test('week remains readable when history fails; definition refresh retry cannot dismiss week failure', async ({ page, api }) => {
  api.historyStatus = 500;
  await page.goto(`${origin}/habits/read`);
  await expect(page.getByText('No se pudieron cargar los registros.')).toBeVisible();
  await expect(weekPanel(page).getByRole('row')).toHaveCount(8);
  api.historyStatus = 200;
  api.weekStatus = 500;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(weekPanel(page).getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Editar hábito', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Título', { exact: true }).fill('Nueva definición');
  api.detailStatus = 500;
  await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByText('Los cambios se guardaron, pero no se pudo recargar la definición.')).toBeVisible();
  api.detailStatus = 200;
  await page.getByRole('button', { name: 'Reintentar actualización', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nueva definición' })).toBeVisible();
  await expect(weekPanel(page).getByRole('alert')).toBeVisible();
});

test('expired week read clears session without disclosing history', async ({ page, api }) => {
  api.weekStatus = 401;
  await page.goto(`${origin}/habits/read`);
  await expect(page).toHaveURL(`${origin}/login`);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  await expect(weekPanel(page)).toHaveCount(0);
});

const historyEditor = page => page.getByRole('region', { name: 'Corregir un registro', exact: true });
const corrections = api => api.calls.filter(c => c.method === 'PATCH' && /\/logs\/[^/]+$/.test(c.path));
async function selectRecord(page, date = '2026-03-30') {
  await historyEditor(page).getByLabel('Fecha del registro', { exact: true }).fill(date);
}
async function openRecord(page, date = '2026-03-30') {
  await page.goto(`${origin}/habits/read`);
  await selectRecord(page, date);
  await expect(historyEditor(page).getByLabel('Nota', { exact: true })).toBeVisible();
  return historyEditor(page);
}
const saveRecord = editor => editor.getByRole('button', { name: 'Guardar registro', exact: true }).click();

test('dated notes-only legacy quantity preserves unknown amount and stored completion', async ({ page, api }) => {
  api.habit.configuration = quantityGoal(100, 'minutos');
  api.dateConfigurations['2026-03-30'] = quantityGoal(10, 'km');
  api.logs = [log('2026-03-30')];
  const editor = await openRecord(page);
  await expect(editor).toContainText('Objetivo original: 10 km');
  await expect(editor).toContainText('Cantidad no registrada (registro antiguo).');
  await expect(editor).toContainText('Finalización guardada: Completado');
  await editor.getByLabel('Nota', { exact: true }).fill('  Sólo nota  ');
  await saveRecord(editor);
  await expect(editor).toContainText('Registro actualizado.');
  expect(corrections(api).map(c => c.body)).toEqual([{ note: 'Sólo nota' }]);
  expect(api.logs[0]).not.toHaveProperty('amount');
  expect(api.logs[0]).not.toHaveProperty('configurationSnapshot');
  expect(api.logs[0].completed).toBe(true);
});

test('dated snapshot original amount wins over today/pending; unchanged opt-in amount omitted', async ({ page, api }) => {
  api.habit.configuration = quantityGoal(100, 'minutos');
  api.habit.pendingConfiguration = { revisionId: 'next', effectiveFrom: '2026-04-01', configuration: dailyCheckbox };
  api.logs = [{ ...log('2026-03-30'), amount: 2, configurationSnapshot: snapshot(quantityGoal(10, 'km')) }];
  const editor = await openRecord(page);
  await expect(editor).toContainText('Cantidad registrada: 2 km');
  await editor.getByLabel('Corregir progreso', { exact: true }).check();
  await expect(editor.getByLabel('Cantidad corregida', { exact: true })).toHaveValue('2');
  await expect(editor.getByRole('button', { name: 'Guardar registro', exact: true })).toBeDisabled();
  await editor.getByLabel('Cantidad corregida', { exact: true }).fill('5');
  await saveRecord(editor);
  await expect(editor).toContainText('Finalización guardada: Sin completar');
  await expect(editor).toContainText('Objetivo original: 10 km');
  expect(corrections(api).map(c => c.body)).toEqual([{ amount: 5 }]);
});

test('dated checkbox false, clear note and unchanged trimmed note never send unrelated fields', async ({ page, api }) => {
  api.habit.configuration = quantityGoal();
  api.logs = [{ ...log('2026-03-30'), note: 'Anterior', configurationSnapshot: snapshot(dailyCheckbox) }];
  const editor = await openRecord(page);
  await editor.getByLabel('Nota', { exact: true }).fill(' Anterior ');
  await expect(editor).toContainText('No hay cambios para guardar.');
  await expect(editor.getByRole('button', { name: 'Guardar registro', exact: true })).toBeDisabled();
  await editor.getByLabel('Corregir progreso', { exact: true }).check();
  await editor.getByLabel('Completado', { exact: true }).uncheck();
  await saveRecord(editor);
  await expect(editor).toContainText('Registro actualizado.');
  await editor.getByLabel('Nota', { exact: true }).fill('   ');
  await saveRecord(editor);
  await expect(editor.getByLabel('Nota', { exact: true })).toHaveValue('');
  expect(corrections(api).map(c => c.body)).toEqual([{ completed: false }, { note: '' }]);
});

test('dated quantity opt-in requires finite bounded amount and validates trimmed note length', async ({ page, api }) => {
  api.habit.configuration = quantityGoal();
  api.logs = [log('2026-03-30')];
  const editor = await openRecord(page);
  await editor.getByLabel('Corregir progreso', { exact: true }).check();
  for (const value of ['', '-1', 'NaN', 'Infinity', '1e309', '1000000001', 'null']) {
    await editor.getByLabel('Cantidad corregida', { exact: true }).fill(value);
    await saveRecord(editor);
    await expect(editor.getByRole('alert')).toContainText('Introduce una cantidad finita');
  }
  await editor.getByLabel('Cantidad corregida', { exact: true }).fill('0');
  await editor.getByLabel('Nota', { exact: true }).fill('x'.repeat(2001));
  await saveRecord(editor);
  await expect(editor.getByRole('alert')).toContainText('2000');
  expect(corrections(api)).toHaveLength(0);
  await editor.getByLabel('Nota', { exact: true }).fill(' ' + 'x'.repeat(2000) + ' ');
  await saveRecord(editor);
  await expect(editor).toContainText('Cantidad registrada: 0 páginas');
  expect(corrections(api)[0].body).toEqual({ amount: 0, note: 'x'.repeat(2000) });
});

test('date before current month uses actual single-date range and effective goal; invalid dates never load or mutate', async ({ page, api }) => {
  api.habit.configuration = quantityGoal(100);
  api.dateConfigurations['2026-02-12'] = dailyCheckbox;
  api.logs = [log('2026-02-12')];
  const editor = await openRecord(page, '2026-02-12');
  await expect(editor).toContainText('Objetivo original: Marcar completado');
  expect(calls(api, '/habits/read/logs').some(c => c.search === '?startDate=2026-02-12&endDate=2026-02-12')).toBe(true);
  await editor.getByLabel('Nota', { exact: true }).fill('Febrero');
  await saveRecord(editor);
  await expect(editor).toContainText('Registro actualizado.');
  const reads = api.calls.filter(c => c.method === 'GET').length;
  for (const date of ['', 'null', '2026-02-30', '2026-04-01', '2026-03-30T00:00:00.000Z', '0000-01-01']) {
    await selectRecord(page, date);
    await expect(editor.getByLabel('Nota', { exact: true })).toHaveCount(0);
    await expect(editor).toContainText('Selecciona una fecha válida YYYY-MM-DD no posterior a hoy.');
  }
  expect(api.calls.filter(c => c.method === 'GET')).toHaveLength(reads);
  expect(corrections(api)).toHaveLength(1);
});

for (const status of ['paused', 'archived']) {
  test(`dated ${status} existing record corrects but empty week day is not a record`, async ({ page, api }) => {
    Object.assign(api.habit, { status, active: true, configuration: dailyCheckbox });
    api.logs = [log('2026-03-30')];
    const editor = await openRecord(page);
    await editor.getByLabel('Corregir progreso', { exact: true }).check();
    await editor.getByLabel('Completado', { exact: true }).uncheck();
    await saveRecord(editor);
    await expect(editor).toContainText('Finalización guardada: Sin completar');
    await selectRecord(page, '2026-03-29');
    await expect(editor).toContainText('No hay registro en esta fecha.');
    await expect(editor).toContainText('Un hábito inactivo no permite crear registros.');
    await expect(editor.getByRole('button', { name: 'Guardar registro', exact: true })).toBeDisabled();
    expect(corrections(api).map(c => c.body)).toEqual([{ completed: false }]);
  });
}

test('missing dated record requires explicit progress and selected effective weekday; notes alone denied', async ({ page, api }) => {
  api.habit.configuration = dailyCheckbox;
  api.dateConfigurations['2026-03-30'] = { ...dailyCheckbox, schedule: { kind: 'weekdays', days: [2] } };
  const editor = await openRecord(page);
  await expect(editor).toContainText('La fecha no está programada.');
  await editor.getByLabel('Nota', { exact: true }).fill('No crear');
  await expect(editor.getByRole('button', { name: 'Guardar registro', exact: true })).toBeDisabled();
  await selectRecord(page, '2026-03-31');
  await expect(editor.getByLabel('Nota', { exact: true })).toBeVisible();
  await editor.getByLabel('Nota', { exact: true }).fill('Sólo nota');
  await expect(editor.getByRole('button', { name: 'Guardar registro', exact: true })).toBeDisabled();
  await editor.getByLabel('Corregir progreso', { exact: true }).check();
  await saveRecord(editor);
  await expect(editor).toContainText('Registro actualizado.');
  expect(corrections(api).map(c => c.body)).toEqual([{ completed: false, note: 'Sólo nota' }]);
});

test('dated rejected PATCH retains fields and 400/404/409 stay visible for retry', async ({ page, api }) => {
  api.logs = [log('2026-03-30')];
  const editor = await openRecord(page);
  await editor.getByLabel('Nota', { exact: true }).fill('Retener');
  for (const [status, message] of [[400, 'Revisa los datos'], [404, 'Registro o hábito no encontrado'], [409, 'El registro cambió']]) {
    api.mutationStatus = status;
    await saveRecord(editor);
    await expect(editor.getByRole('alert')).toContainText(message);
    await expect(editor.getByLabel('Nota', { exact: true })).toHaveValue('Retener');
  }
  api.mutationStatus = 200;
  await saveRecord(editor);
  await expect(editor).toContainText('Registro actualizado.');
  expect(corrections(api)).toHaveLength(4);
});

for (const failed of ['selected', 'month', 'week']) {
  test(`dated successful write with ${failed} read failure retries without duplicate PATCH`, async ({ page, api }) => {
    api.logs = [log('2026-03-30')];
    const editor = await openRecord(page);
    await editor.getByLabel('Nota', { exact: true }).fill('Guardada');
    api.beforeHistory = async params => {
      api.historyStatus = failed === 'week' ? 200 : (failed === 'selected' ? params.has('startDate') : !params.has('startDate')) ? 500 : 200;
    };
    if (failed === 'week') api.weekStatus = 500;
    await saveRecord(editor);
    await expect(editor.getByRole('alert')).toContainText('El registro se guardó, pero no se pudo recargar');
    await expect(editor.getByRole('button', { name: 'Guardar registro', exact: true })).toBeDisabled();
    api.beforeHistory = async () => {}; api.historyStatus = api.weekStatus = 200;
    await editor.getByRole('button', { name: 'Reintentar lecturas', exact: true }).click();
    await expect(editor.getByRole('alert')).toHaveCount(0);
    await expect(editor.getByLabel('Nota', { exact: true })).toHaveValue('Guardada');
    expect(corrections(api)).toHaveLength(1);
  });
}

test('selected date read race never flashes previous form and initial failure retries read only', async ({ page, api }) => {
  api.logs = [{ ...log('2026-03-30'), note: 'Anterior' }, { ...log('2026-03-29'), note: 'Nueva' }];
  const editor = await openRecord(page);
  const held = deferred();
  api.beforeHistory = params => params.get('startDate') === '2026-03-28' ? held.promise : Promise.resolve();
  try {
    await selectRecord(page, '2026-03-28');
    await expect(editor.getByLabel('Nota', { exact: true })).toHaveCount(0);
    await selectRecord(page, '2026-03-29');
    await expect(editor.getByLabel('Nota', { exact: true })).toHaveValue('Nueva');
  } finally { held.release(); }
  await page.clock.runFor(500);
  await expect(editor.getByLabel('Nota', { exact: true })).toHaveValue('Nueva');
  api.historyStatus = 500;
  await selectRecord(page, '2026-03-27');
  await expect(editor.getByRole('alert')).toContainText('No se pudo cargar el registro');
  api.historyStatus = 200;
  await editor.getByRole('button', { name: 'Reintentar lecturas', exact: true }).click();
  await expect(editor.getByLabel('Nota', { exact: true })).toBeVisible();
  expect(corrections(api)).toHaveLength(0);
});

for (const stale of ['selection', 'route', 'logout', 'day', 'token']) {
  test(`dated pending correction ignores stale ${stale} and does not refresh old context`, async ({ page, api }) => {
    api.logs = [log('2026-03-30')];
    const editor = await openRecord(page);
    await editor.getByLabel('Nota', { exact: true }).fill('Tardía');
    const held = deferred(); api.beforeMutation = () => held.promise;
    try {
      await saveRecord(editor);
      await expect.poll(() => corrections(api).length).toBe(1);
      if (stale === 'selection') { await selectRecord(page, '2026-03-29'); await expect(editor.getByLabel('Nota', { exact: true })).toHaveValue(''); }
      if (stale === 'route') {
        api.habit = { habitId: 'walk', title: 'Caminar autorizado', active: true };
        await navigate(page, 'walk');
        await expect(page.getByRole('heading', { name: 'Caminar autorizado', exact: true })).toBeVisible();
        await expect(weekPanel(page).getByRole('row')).toHaveCount(8);
      }
      if (stale === 'logout') { await page.getByRole('button', { name: 'Salir', exact: true }).click(); await expect(page).toHaveURL(`${origin}/login`); }
      if (stale === 'day') await page.clock.setSystemTime(new Date('2026-04-01T07:00:01Z'));
      if (stale === 'token') await page.evaluate(() => localStorage.setItem('token', 'replacement'));
      const reads = api.calls.filter(c => c.method === 'GET').length;
      held.release();
      await page.clock.runFor(500);
      expect(api.calls.filter(c => c.method === 'GET')).toHaveLength(reads);
      await expect(page.getByText('Registro actualizado.', { exact: true })).toHaveCount(0);
    } finally { held.release(); }
  });
}

test('selected date form waits for both real logs and date-effective week definition', async ({ page, api }) => {
  api.logs = [log('2026-03-30')];
  await page.goto(`${origin}/habits/read`);
  await expect(weekPanel(page).getByRole('row')).toHaveCount(8);
  const held = deferred(); api.beforeWeek = () => held.promise;
  try {
    await selectRecord(page);
    await expect.poll(() => calls(api, '/habits/read/week').some(c => c.search === '?date=2026-03-30')).toBe(true);
    await expect(historyEditor(page).getByLabel('Nota', { exact: true })).toHaveCount(0);
  } finally { held.release(); }
  await expect(historyEditor(page).getByLabel('Nota', { exact: true })).toBeVisible();
});

for (const kind of ['quantity', 'checkbox']) {
  test(`unchanged opted-in ${kind} progress and opted-out draft only send changed note`, async ({ page, api }) => {
    api.habit.configuration = kind === 'quantity' ? quantityGoal() : dailyCheckbox;
    api.logs = [{ ...log('2026-03-30'), ...(kind === 'quantity' ? { amount: 7 } : {}) }];
    const editor = await openRecord(page);
    await editor.getByLabel('Corregir progreso', { exact: true }).check();
    await editor.getByLabel('Nota', { exact: true }).fill('Nota nueva');
    await saveRecord(editor);
    await expect(editor).toContainText('Registro actualizado.');
    await editor.getByLabel('Corregir progreso', { exact: true }).check();
    if (kind === 'quantity') await editor.getByLabel('Cantidad corregida', { exact: true }).fill('50');
    else await editor.getByLabel('Completado', { exact: true }).uncheck();
    await editor.getByLabel('Corregir progreso', { exact: true }).uncheck();
    await editor.getByLabel('Nota', { exact: true }).fill('Otra nota');
    await saveRecord(editor);
    await expect(editor.getByLabel('Nota', { exact: true })).toHaveValue('Otra nota');
    expect(corrections(api).map(c => c.body)).toEqual([{ note: 'Nota nueva' }, { note: 'Otra nota' }]);
    expect(api.logs[0].completed).toBe(true);
  });
}

test('new past quantity uses date-effective goal; existing nonselected record remains correctable', async ({ page, api }) => {
  api.habit.configuration = dailyCheckbox;
  api.dateConfigurations['2026-02-12'] = quantityGoal(10, 'km', { kind: 'weekdays', days: [4] });
  const editor = await openRecord(page, '2026-02-12');
  await editor.getByLabel('Corregir progreso', { exact: true }).check();
  await editor.getByLabel('Cantidad corregida', { exact: true }).fill('10.5');
  await saveRecord(editor);
  await expect(editor).toContainText('Finalización guardada: Completado');
  expect(corrections(api)[0].body).toEqual({ amount: 10.5 });
  expect(api.logs[0].configurationSnapshot.configuration.goal).toEqual({ kind: 'quantity', target: 10, unit: 'km' });
  api.logs = [{ ...log('2026-03-30'), completed: false, configurationSnapshot: snapshot({ ...dailyCheckbox, schedule: { kind: 'weekdays', days: [7] } }) }];
  await selectRecord(page, '2026-03-30');
  await editor.getByLabel('Corregir progreso', { exact: true }).check();
  await editor.getByLabel('Completado', { exact: true }).check();
  await saveRecord(editor);
  await expect(editor).toContainText('Finalización guardada: Completado');
  expect(corrections(api)[1].body).toEqual({ completed: true });
});

test('changed local session rejects a dated submit before PATCH', async ({ page, api }) => {
  api.logs = [log('2026-03-30')];
  const editor = await openRecord(page);
  await editor.getByLabel('Nota', { exact: true }).fill('No guardar');
  await page.evaluate(() => localStorage.setItem('token', 'another-session'));
  await saveRecord(editor);
  expect(corrections(api)).toHaveLength(0);
});

test('dated stale account day rejects submit before PATCH; 401 uses session cleanup', async ({ page, api }) => {
  api.logs = [log('2026-03-30')];
  const editor = await openRecord(page);
  await editor.getByLabel('Nota', { exact: true }).fill('Cambio');
  await page.clock.setSystemTime(new Date('2026-04-01T07:00:01Z'));
  await saveRecord(editor);
  expect(corrections(api)).toHaveLength(0);
  await page.clock.setSystemTime(new Date('2026-04-01T00:30:00Z'));
  api.mutationStatus = 401;
  await saveRecord(editor);
  await expect(page).toHaveURL(`${origin}/login`);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});

const lifecycleCalls = api => calls(api, '/habits/read/lifecycle', 'PATCH');
const lifecycleCases = [
  ['active', 'Pausar', 'pausar', 'paused', 'Pausado'],
  ['active', 'Archivar', 'archivar', 'archived', 'Archivado'],
  ['paused', 'Archivar', 'archivar', 'archived', 'Archivado'],
  ['paused', 'Reanudar', 'reanudar', 'active', 'Activo'],
  ['archived', 'Restaurar', 'restaurar', 'active', 'Activo'],
];
for (const [initial, action, confirm, target, badge] of lifecycleCases) {
  test(`${initial}: confirmed ${action} preserves originals, history and editors; cancel sends nothing`, async ({ page, api }) => {
    Object.assign(api.habit, { status: initial, active: initial !== 'active', category: 'Lectura', configuration: quantityGoal(),
      pendingConfiguration: { revisionId: 'pending', effectiveFrom: '2026-04-01', configuration: dailyCheckbox } });
    api.logs = [{ ...log('2026-03-30'), amount: 4, configurationSnapshot: snapshot(quantityGoal(10, 'km')) }];
    await page.goto(`${origin}/habits/read`);
    await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
    await page.getByRole('button', { name: action, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `${action} hábito`, exact: true });
    await expect(dialog).toContainText('El historial y los objetivos originales se conservan.');
    await expect(page.getByRole('button', { name: 'Editar hábito', exact: true })).toBeDisabled();
    if (initial === 'active') await expect(progress(page).getByRole('button', { name: 'Guardar cantidad', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: action, exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(lifecycleCalls(api)).toHaveLength(0);
    const reads = calls(api, '/habits/read').length;
    const held = deferred();
    api.beforeMutation = () => held.promise;
    try {
      await page.getByRole('button', { name: action, exact: true }).click();
      await dialog.getByRole('button', { name: `Sí, ${confirm}`, exact: true }).click();
      await expect.poll(() => lifecycleCalls(api).length).toBe(1);
      await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Editar hábito', exact: true })).toBeDisabled();
    } finally { held.release(); }
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(badge, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${origin}/habits/read`);
    await expect(title(page)).toBeVisible();
    await expect(page.getByText(/Configuración actual: Diario · 20 páginas por día/)).toBeVisible();
    await expect(page.getByText(/Desde el 2026-04-01: Diario · Marcar completado/)).toBeVisible();
    await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar hábito', exact: true })).toBeEnabled();
    await selectRecord(page);
    await historyEditor(page).getByLabel('Nota', { exact: true }).fill('Tras cambiar estado');
    await saveRecord(historyEditor(page));
    await expect(historyEditor(page)).toContainText('Registro actualizado.');
    expect(corrections(api).map(c => c.body)).toEqual([{ note: 'Tras cambiar estado' }]);
    expect(lifecycleCalls(api).map(c => c.body)).toEqual([{ status: target }]);
    expect(calls(api, '/habits/read')).toHaveLength(reads);
    expect(api.calls.filter(c => c.method === 'DELETE')).toHaveLength(0);
    await expect(progress(page).getByRole('button', { name: 'Guardar cantidad', exact: true })).toHaveCount(target === 'active' ? 1 : 0);
  });
}

for (const status of [404, 500, 401]) {
  test(`lifecycle ${status} preserves history or performs session cleanup`, async ({ page, api }) => {
    api.logs = [log('2026-03-30')];
    api.mutationStatus = status;
    await page.goto(`${origin}/habits/read`);
    await page.getByRole('button', { name: 'Archivar', exact: true }).click();
    await page.getByRole('button', { name: 'Sí, archivar', exact: true }).click();
    if (status === 401) {
      await expect(page).toHaveURL(`${origin}/login`);
      expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
    } else {
      await expect(page.getByRole('alert')).toContainText(status === 404 ? 'Hábito no encontrado' : 'No se pudo cambiar el estado');
      await expect(page.getByText('Activo', { exact: true })).toBeVisible();
      await expect(page.getByText('lunes, 30 de marzo de 2026')).toBeVisible();
    }
    expect(lifecycleCalls(api)).toHaveLength(1);
    expect(api.calls.filter(c => c.method === 'DELETE')).toHaveLength(0);
  });
}

for (const [context, lateStatus] of ['route', 'logout', 'day', 'session'].flatMap(context => [200, 500].map(status => [context, status]))) {
  test(`late lifecycle ${lateStatus} after ${context} cannot alter current detail or cache`, async ({ page, api }) => {
    api.mutationStatus = lateStatus;
    await page.goto(`${origin}/habits/read`);
    const held = deferred();
    api.beforeMutation = () => held.promise;
    try {
      await page.getByRole('button', { name: 'Pausar', exact: true }).click();
      await page.getByRole('button', { name: 'Sí, pausar', exact: true }).click();
      await expect.poll(() => lifecycleCalls(api).length).toBe(1);
      if (context === 'logout') {
        await page.getByRole('button', { name: 'Salir', exact: true }).click();
        await expect(page).toHaveURL(`${origin}/login`);
      } else if (context === 'session') await page.evaluate(() => localStorage.setItem('token', 'new-session'));
      else {
        api.habit = { habitId: context === 'route' ? 'walk' : 'read', title: 'Contexto nuevo', active: true, status: 'active' };
        if (context === 'route') await navigate(page, 'walk');
        else {
          await page.clock.setSystemTime(new Date('2026-04-01T07:00:01Z'));
          await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        }
        await expect(page.getByRole('heading', { name: 'Contexto nuevo', exact: true })).toBeVisible();
      }
    } finally { held.release(); }
    await expect.poll(() => api.lifecycleSettled).toBe(1);
    await page.clock.runFor(500);
    await expect(page.getByText('Pausado', { exact: true })).toHaveCount(0);
    await expect(page.getByText('No se pudo cambiar el estado. Inténtalo de nuevo.')).toHaveCount(0);
    if (context === 'route' || context === 'day') await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  });
}

test('lifecycle submit rechecks changed session/day and uses returned status, not requested state', async ({ page, api }) => {
  await page.goto(`${origin}/habits/read`);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.evaluate(() => localStorage.setItem('token', 'new-session'));
  await page.getByRole('button', { name: 'Sí, pausar', exact: true }).click();
  expect(lifecycleCalls(api)).toHaveLength(0);
  await page.evaluate(() => localStorage.setItem('token', 'detail-token'));
  await page.clock.setSystemTime(new Date('2026-04-01T07:00:01Z'));
  await page.getByRole('button', { name: 'Sí, pausar', exact: true }).click();
  expect(lifecycleCalls(api)).toHaveLength(0);
  await page.clock.setSystemTime(new Date('2026-04-01T00:30:00Z'));
  api.lifecycleResponse = { habitId: 'read', status: 'archived', active: true };
  await page.getByRole('button', { name: 'Sí, pausar', exact: true }).click();
  await expect(page.getByText('Archivado', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restaurar', exact: true })).toBeVisible();
  await expect(progress(page).getByRole('button')).toHaveCount(0);
});

test.describe('account date differs from browser date', () => {
  test.use({ timezoneId: 'Asia/Tokyo' });
  test('measured weekday and week default use account date; focus after midnight discards old route data', async ({ page, api }) => {
    api.habit.configuration = quantityGoal(20, 'páginas', { kind: 'weekdays', days: [2] });
    await page.goto(`${origin}/habits/read`);
    await expect(progress(page)).toContainText('Fecha de la cuenta: 2026-03-31');
    await expect(progress(page).getByRole('button', { name: 'Guardar cantidad' })).toBeEnabled();
    await expect(weekPanel(page)).toContainText('Fecha seleccionada: 2026-03-31');
    await page.clock.setSystemTime(new Date('2026-04-01T07:00:01Z'));
    // Before focus/remount, the mutation guard must already reject the stale day.
    await saveAmount(page, '25');
    expect(calls(api, '/habits/read/complete', 'POST')).toHaveLength(0);
    api.week = { ...syntheticWeek(api), date: '2026-04-01' };
    const reads = calls(api, '/habits/read/week').length;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(progress(page)).toContainText('Fecha de la cuenta: 2026-04-01');
    await expect(progress(page)).toContainText('Hoy no está programado.');
    await expect(progress(page).getByLabel('Cantidad de hoy')).toHaveValue('');
    await expect(weekPanel(page)).toContainText('Fecha seleccionada: 2026-04-01');
    expect(calls(api, '/habits/read/week').length).toBeGreaterThan(reads);
  });
});
