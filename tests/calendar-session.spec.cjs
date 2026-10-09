const path = require('node:path');
const { test: base, expect } = require(require.resolve('@playwright/test', {
  paths: [process.cwd(), ...process.env.PATH.split(path.delimiter).map(p => path.resolve(p, '..'))],
}));
const origin = 'http://127.0.0.1:4173';
const profile = { fullName: 'Calendar user', email: 'calendar@example.invalid', token: 'new-token', timeZone: 'America/Los_Angeles', roles: ['user'] };
const keys = ['token', 'fullName', 'email', 'picture', 'timeZone', 'completedHabits_2026-03-08', 'completedHabits_2026-03-09'];
const test = base.extend({
  api: [async ({ page }, use) => {
    const api = { status: 200, habitsStatus: 200, googleStatus: 200, profile: { ...profile }, calls: [], unexpected: [], logs: [] };
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.hostname === 'accounts.google.com' && url.pathname === '/gsi/client') {
        return route.fulfill({ contentType: 'application/javascript', body: `window.google = { accounts: { id: {
          initialize: o => window.mockGoogle = o.callback,
          renderButton: el => { const b = document.createElement('button'); b.textContent = 'Mock Google'; b.onclick = () => window.mockGoogle({credential:'synthetic-token'}); el.appendChild(b); },
          cancel: () => {}
        } } };` });
      }
      if (['fetch', 'xhr'].includes(req.resourceType())) {
        api.calls.push({ path: url.pathname, method: req.method(), body: req.postDataJSON() });
        const headers = { 'access-control-allow-origin': origin };
        if (req.method() === 'GET' && url.pathname.endsWith('/auth/check-status')) return route.fulfill({ status: api.status, json: api.profile, headers });
        if (req.method() === 'POST' && url.pathname.endsWith('/auth/google')) return route.fulfill({ status: api.googleStatus, json: api.profile, headers });
        if (req.method() === 'GET' && url.pathname.endsWith('/habits/logs')) return route.fulfill({ json: api.logs, headers });
        if (req.method() === 'GET' && url.pathname.endsWith('/habits')) return route.fulfill({ status: api.habitsStatus, json: [{ habitId: 'read', title: 'Leer' }], headers });
        api.unexpected.push(`${req.method()} ${url.pathname}`);
        return route.abort();
      }
      if (url.origin === origin && req.method() === 'GET' && !url.pathname.startsWith('/api')) return route.continue();
      return route.abort();
    });
    await use(api);
    expect(api.unexpected).toEqual([]);
  }, { auto: true }],
});
async function seed(page, token = true) {
  await page.addInitScript(({ keys, token }) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', 'yes');
    for (const key of keys) localStorage.setItem(key, key.startsWith('completedHabits_') ? '["previous-account"]' : 'old');
    if (!token) localStorage.removeItem('token');
    localStorage.setItem('unrelated', 'keep');
    localStorage.setItem('completedHabits_notes', 'keep');
  }, { keys, token });
}
async function clean(page) {
  expect(await page.evaluate(keys => keys.map(k => localStorage.getItem(k)), keys)).toEqual(keys.map(() => null));
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => /^completedHabits_\d{4}-\d{2}-\d{2}$/.test(k)))).toEqual([]);
  expect(await page.evaluate(() => [localStorage.getItem('unrelated'), localStorage.getItem('completedHabits_notes')])).toEqual(['keep', 'keep']);
}
const done = page => page.getByRole('listitem').filter({ has: page.getByText('Leer', { exact: true }) }).getByRole('checkbox', { name: 'Completado hoy', exact: true });
const count = api => api.calls.filter(c => c.path.endsWith('/habits')).length;

test('Google posts detected browser zone but persists stable account zone and clears old cache', async ({ page, api }) => {
  await seed(page, false);
  await page.goto(`${origin}/login`);
  const detected = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  await page.getByRole('button', { name: 'Mock Google', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/dashboard`);
  expect(api.calls.find(c => c.path.endsWith('/auth/google')).body).toEqual({ idToken: 'synthetic-token', timeZone: detected });
  expect(await page.evaluate(() => localStorage.getItem('timeZone'))).toBe(profile.timeZone);
  expect(await page.evaluate(() => localStorage.getItem('completedHabits_2026-03-09'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('picture'))).toBeNull();
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await clean(page);
});

test('account day controls dashboard despite browser zone; midnight and focus refetch without reload', async ({ page, api }) => {
  await seed(page);
  await page.clock.install({ time: new Date('2026-03-09T06:59:59Z') });
  api.logs = [{ habitId: 'read', date: '2026-03-08T00:00:00.000Z', completed: true }];
  await page.goto(`${origin}/dashboard`);
  await expect(done(page)).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('timeZone'))).toBe(profile.timeZone);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('completedHabits_2026-03-08')))).toContain('read');
  const before = count(api);
  const statusCalls = api.calls.filter(c => c.path.endsWith('/auth/check-status')).length;
  await page.clock.runFor(1100);
  await expect.poll(() => count(api)).toBeGreaterThan(before);
  await expect(done(page)).not.toBeChecked();
  const after = count(api);
  await page.getByRole('button', { name: 'Nuevo hábito', exact: true }).click();
  await page.clock.runFor(1000);
  expect(count(api)).toBe(after);
  await page.clock.setSystemTime(new Date('2026-03-10T08:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => count(api)).toBeGreaterThan(after);
  expect(api.calls.filter(c => c.path.endsWith('/auth/check-status'))).toHaveLength(statusCalls);
});

for (const [name, status, habitsStatus] of [['failed check-status', 403, 200], ['expired check-status', 401, 200], ['expired data request', 200, 401]]) {
  test(`${name} clears full session and only application daily cache`, async ({ page, api }) => {
    await seed(page); api.status = status; api.habitsStatus = habitsStatus;
    await page.goto(`${origin}/dashboard`);
    await expect(page).toHaveURL(`${origin}/login`);
    await expect(page.getByRole('dialog', { name: 'Iniciar sesión' })).toBeVisible();
    await clean(page);
  });
}
test('403 data request preserves session', async ({ page, api }) => {
  await seed(page); api.habitsStatus = 403;
  await page.goto(`${origin}/dashboard`);
  await expect(page.getByText('No se pudieron cargar los hábitos.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe(profile.token);
  expect(await page.evaluate(() => localStorage.getItem('timeZone'))).toBe(profile.timeZone);
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await clean(page);
});

test('Google endpoint 401 remains exempt from hard redirect and session cleanup', async ({ page, api }) => {
  await seed(page);
  await page.goto(`${origin}/dashboard`);
  await expect(page.getByText(profile.fullName, { exact: true })).toBeVisible();
  api.googleStatus = 401;
  await page.evaluate(async () => {
    try { await (await import('/src/api/auth.api.ts')).googleLogin('synthetic-token'); } catch { /* Expected synthetic rejection. */ }
  });
  await expect(page).toHaveURL(`${origin}/dashboard`);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe(profile.token);
  expect(await page.evaluate(() => localStorage.getItem('timeZone'))).toBe(profile.timeZone);
});

test('calendar helpers preserve anchors, validate labels, handle east/west and 23/25-hour DST days', async ({ page }) => {
  await page.goto(`${origin}/login`);
  await page.clock.install({ time: new Date('2026-01-01T01:00:00Z') });
  const result = await page.evaluate(async () => {
    const cache = await import('/src/utils/dailyCompletions.ts');
    localStorage.setItem('timeZone', 'America/Los_Angeles');
    cache.markCompleted('west'); // Legacy signature uses stored account zone.
    cache.markCompleted('east', 'Asia/Tokyo');
    cache.markIncomplete('east', 'Asia/Tokyo');
    const cached = [Array.from(cache.getCompletedToday()), Array.from(cache.getCompletedToday('Asia/Tokyo'))];
    localStorage.setItem('completedHabits_2026-01-01', '{invalid');
    const corrupt = Array.from(cache.getCompletedToday('Asia/Tokyo'));
    const c = await import('/src/utils/calendar.ts');
    const instant = new Date('2026-01-01T01:00:00Z');
    const rejects = ['2026-02-30', '0000-01-01', '2026-01-01T01:00:00.000Z'].map(value => {
      try { c.calendarLabel(value); return false; } catch { return true; }
    });
    return {
      cached, corrupt,
      days: [c.calendarDay(instant, 'Asia/Tokyo'), c.calendarDay(instant, 'America/Los_Angeles')],
      label: c.calendarLabel('2026-01-01T00:00:00.000Z'),
      display: c.formatCalendarLabel('2026-01-01T00:00:00.000Z', 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      delays: [c.nextCalendarDayDelay(new Date('2026-03-08T08:00:00Z'), 'America/Los_Angeles'), c.nextCalendarDayDelay(new Date('2026-11-01T07:00:00Z'), 'America/Los_Angeles')], rejects,
    };
  });
  expect(result).toEqual({ cached: [['west'], []], corrupt: [], days: ['2026-01-01', '2025-12-31'], label: '2026-01-01', display: '01/01/2026', delays: [23 * 3600000, 25 * 3600000], rejects: [true, true, true] });
});

test('legacy missing zone is UTC and detection failure posts UTC', async ({ page, api }) => {
  delete api.profile.timeZone;
  await seed(page);
  await page.goto(`${origin}/dashboard`);
  await expect(page.getByText(profile.fullName, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('timeZone'))).toBe('UTC');
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await page.evaluate(async () => {
    const original = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function () { throw new Error('Unavailable'); };
    try { await (await import('/src/api/auth.api.ts')).googleLogin('synthetic-token'); }
    finally { Intl.DateTimeFormat = original; }
  });
  expect(api.calls.find(c => c.path.endsWith('/auth/google')).body.timeZone).toBe('UTC');
});
