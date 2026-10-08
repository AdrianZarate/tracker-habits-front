const path = require('node:path');
const { test: base, expect } = require(require.resolve('@playwright/test', {
  paths: [process.cwd(), ...process.env.PATH.split(path.delimiter).map(p => path.resolve(p, '..'))],
}));
const origin = 'http://127.0.0.1:4173';
const profile = { fullName: 'Detail user', email: 'detail@example.invalid', token: 'detail-token', timeZone: 'America/Los_Angeles', roles: ['user'] };
const log = (day, id = day) => ({ _id: id, habitId: 'read', date: `${day}T00:00:00.000Z`, completed: true });
const test = base.extend({
  api: [async ({ page }, use) => {
    const api = {
      calls: [], unexpected: [], detailStatus: 200, historyStatus: 200, mutationStatus: 200,
      habit: { habitId: 'read', title: 'Leer autorizado', slug: 'leer', active: true },
      logs: [], beforeDetail: async () => {}, beforeHistory: async () => {}, beforeMutation: async () => {},
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
        if (method === 'GET' && /\/habits\/[^/]+\/logs$/.test(url.pathname)) {
          const logs = [...api.logs];
          await api.beforeHistory();
          return reply(logs, api.historyStatus);
        }
        if (method === 'GET' && /\/habits\/[^/]+$/.test(url.pathname)) {
          const habit = { ...api.habit };
          await api.beforeDetail();
          if (api.detailStatus === 0) return route.abort();
          return reply(habit, api.detailStatus);
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
          if (method === 'POST') { const entry = log('2026-03-31'); api.logs.push(entry); return reply(entry); }
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
    expect(calls(api, `/habits/${id}/logs`)).toHaveLength(0);
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
  const before = api.calls.length;
  await page.getByRole('button', { name: 'Desactivar', exact: true }).click();
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
  await expect(page.getByText('Inactivo', { exact: true })).toBeVisible();
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

test('mutation failures preserve view and recover; deactivation success returns dashboard', async ({ page, api }) => {
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
  await page.getByRole('button', { name: 'Desactivar', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, desactivar', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(title(page)).toBeVisible();
  api.mutationStatus = 200;
  await page.getByRole('button', { name: 'Desactivar', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, desactivar', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/dashboard`);
  expect(calls(api, '/habits/read', 'PATCH')).toHaveLength(2);
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
  // Today's authoritative goal is still quantitative until the API's effective date.
  await expect(page.getByRole('button', { name: 'Registro de cantidad pendiente', exact: true })).toBeDisabled();
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
  await expect(page.getByRole('button', { name: 'Registro de cantidad pendiente', exact: true })).toBeDisabled();
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
