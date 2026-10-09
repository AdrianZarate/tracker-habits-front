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
      googleStatus: 200, googleMessage: 'Acceso rechazado por el servidor.', beforeGoogle: async () => {}, googleNetworkError: false,
    };
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.hostname === 'accounts.google.com' && url.pathname === '/gsi/client') {
        return route.fulfill({ contentType: 'application/javascript', body: `window.google = { accounts: { id: {
          initialize: o => window.mockGoogle = o.callback,
          renderButton: (el, options) => {
            // Simulate GSI's 20px wider iframe, not real provider pixels or branding.
            window.mockGoogleOptions = options;
            const wrapper = document.createElement('div'); wrapper.style.width = options.width + 'px';
            const frame = document.createElement('iframe'); frame.title = 'Iniciar sesión con Google';
            frame.width = Number(options.width) + 20; frame.height = 44;
            frame.style.cssText = 'border:0;display:block;margin:-2px -10px';
            const outline = options.theme === 'outline', pill = options.shape === 'pill';
            frame.srcdoc = '<style>html{color-scheme:light}html,body{background:transparent}body{margin:2px 10px}button{box-sizing:border-box;width:100%;height:40px;border:1px solid #dadce0;font:500 14px Arial;background:'
              + (outline ? '#fff;color:#3c4043' : '#202124;color:#fff') + ';border-radius:'
              + (pill ? '20px' : '4px') + '}button:focus-visible{outline:2px solid #4f46e5;outline-offset:0}</style>'
              + '<button onclick="parent.mockGoogle({credential: \\'synthetic-token\\'})">Google sintético</button>';
            wrapper.append(frame); el.replaceChildren(wrapper);
          }, cancel: () => {}
        } } };` });
      }
      if (['fetch', 'xhr'].includes(request.resourceType())) {
        const endpoint = ['/auth/google', '/auth/check-status', '/habits/logs', '/habits']
          .find(suffix => url.pathname.endsWith(suffix));
        const method = request.method();
        api.calls.push({ endpoint, path: url.pathname, search: url.search, method, body: request.postDataJSON(), authorization: request.headers().authorization });
        const headers = { 'access-control-allow-origin': origin };
        if (method === 'POST' && endpoint === '/auth/google') {
          const status = api.googleStatus;
          await api.beforeGoogle();
          if (api.googleNetworkError) return route.abort('failed');
          api.settled.push('google');
          return route.fulfill({ status, json: status === 200 ? api.session : { message: api.googleMessage }, headers });
        }
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

const googleButton = page => page.frameLocator('iframe[title="Iniciar sesión con Google"]').getByRole('button');

for (const width of [1440, 375, 320]) {
  test(`landing login ${width}px traps iframe focus, cancels safely and fits`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto(origin);
    const cta = page.getByRole('button', { name: 'Empezar con Google' });
    await cta.click();
    const dialog = page.getByRole('dialog', { name: 'Iniciar sesión' });
    const close = dialog.getByRole('button', { name: 'Cerrar inicio de sesión' });
    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();
    await expectTapTarget(close);
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(740);
    await expectNoOverflow(page);
    await expect(googleButton(page)).toBeVisible();
    const frameBox = await dialog.locator('iframe').boundingBox();
    expect(frameBox.x + frameBox.width).toBeLessThanOrEqual(box.x + box.width);
    const originalScroll = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 500);
    expect(await page.evaluate(() => scrollY)).toBe(originalScroll);
    await page.locator('#hero-title').evaluate(el => el.focus());
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(googleButton(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`login-modal-${width}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(cta).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
    await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`), fullPage: true });
    await cta.click();
    await dialog.getByRole('heading').click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(3, 3);
    await expect(dialog).toHaveCount(0);
    await expect(cta).toBeFocused();
  });
}

for (const width of [1440, 375, 320]) {
  test(`login polish ${width}px balances header, official props, errors and pending geometry`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize({ width, height: 740 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const warnings = [];
    page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
    await page.goto(origin);
    await page.getByRole('button', { name: 'Empezar con Google' }).click();
    const dialog = page.getByRole('dialog', { name: 'Iniciar sesión' });
    const close = dialog.getByRole('button', { name: 'Cerrar inicio de sesión' });
    await expect(close).toBeFocused();
    await expectTapTarget(close);
    const padding = await dialog.evaluate(el => parseFloat(getComputedStyle(el).paddingTop));
    expect(padding, 'Productive header replaces the old 72px blank top').toBeLessThanOrEqual(32);
    const box = await dialog.boundingBox(), mark = await dialog.locator('.login-mark').boundingBox();
    expect(box.width).toBeLessThanOrEqual(400);
    expect(Math.abs(mark.x + mark.width / 2 - box.x - box.width / 2)).toBeLessThanOrEqual(1);
    expect(mark.y - box.y).toBeLessThanOrEqual(33);
    expect(await close.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2);
    for (const selector of ['h2', '.login-subtitle', '.login-footer', '.login-close']) {
      await expectContrast(dialog.locator(selector), dialog);
    }
    await expect(dialog.locator('.login-subtitle')).toHaveText('Inicia sesión o crea tu cuenta con Google.');
    await expect(googleButton(page)).toBeVisible();
    expect(await page.evaluate(() => window.mockGoogleOptions)).toMatchObject({
      theme: 'outline', shape: 'pill', text: 'continue_with', width: '240', size: 'large',
    });
    const frame = await dialog.locator('iframe').boundingBox();
    // Match the light provider document so Chromium can keep its canvas transparent.
    expect(await dialog.locator('iframe').evaluate(el => getComputedStyle(el).colorScheme)).toBe('light');
    expect(frame.width).toBe(260);
    expect(frame.height).toBeGreaterThanOrEqual(44);
    expect(frame.x).toBeGreaterThanOrEqual(box.x + 16);
    expect(frame.x + frame.width).toBeLessThanOrEqual(box.x + box.width - 16);
    await testInfo.attach('login-geometry', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
      viewport: width, dialog: box, iframe: frame, padding, options: await page.evaluate(() => window.mockGoogleOptions),
    })) });
    const noOverflow = async () => {
      await expectNoOverflow(page);
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    };
    await noOverflow();
    await page.keyboard.press('Tab');
    await expect(googleButton(page)).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`polish-modal-${width}.png`) });
    const held = deferred(); mockApi.beforeGoogle = () => held.promise;
    mockApi.googleStatus = 500;
    mockApi.googleMessage = 'No se pudo completar el acceso. '.repeat(12) + 'Detalle'.repeat(32);
    try {
      await googleButton(page).click();
      await expect(dialog.getByRole('status')).toHaveText('Ingresando...');
      await expect(close).toBeDisabled();
      expect(Math.abs((await dialog.boundingBox()).height - box.height)).toBeLessThanOrEqual(2);
      await expectContrast(dialog.getByRole('status'), dialog);
      expect(await dialog.getByRole('status').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
      await noOverflow();
      await page.screenshot({ path: testInfo.outputPath(`polish-pending-${width}.png`) });
    } finally { held.release(); }
    await expect(dialog.getByRole('alert')).toHaveText(mockApi.googleMessage);
    await expectContrast(dialog.getByRole('alert'), dialog);
    await noOverflow();
    const errorBox = await dialog.boundingBox();
    expect(errorBox.y).toBeGreaterThanOrEqual(0);
    expect(errorBox.y + errorBox.height).toBeLessThanOrEqual(740);
    await expect(googleButton(page)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
    await page.screenshot({ path: testInfo.outputPath(`polish-error-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(warnings).toEqual([]);
  });
}

test('Google pending blocks close, Escape, backdrop and synchronous duplicate callbacks; success enters dashboard', async ({ page, mockApi }) => {
  await page.goto(origin);
  await page.getByRole('button', { name: 'Empezar con Google' }).click();
  await expect(googleButton(page)).toBeVisible();
  const held = deferred(); mockApi.beforeGoogle = () => held.promise;
  try {
    await page.evaluate(() => {
      window.mockGoogle({ credential: 'synthetic-token' });
      window.mockGoogle({ credential: 'synthetic-token' });
    });
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-busy', 'true');
    await expect(dialog.getByRole('button', { name: 'Cerrar inicio de sesión' })).toBeDisabled();
    await expect(dialog.getByRole('status')).toHaveText('Ingresando...');
    await page.keyboard.press('Escape');
    await page.mouse.click(3, 3);
    await expect(dialog).toBeVisible();
    await expect.poll(() => callsFor(mockApi, '/auth/google', 'POST').length).toBe(1);
  } finally { held.release(); }
  await expect(page).toHaveURL(`${origin}/dashboard`);
  await expect(habitRow(page, 'Leer')).toBeVisible();
  expect(callsFor(mockApi, '/auth/google', 'POST')[0].body).toEqual({
    idToken: 'synthetic-token', timeZone: await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
  });
});

for (const status of [401, 500]) {
  test(`Google ${status} preserves readable server error in modal without storing a failed session`, async ({ page, mockApi }) => {
    mockApi.googleStatus = status;
    await page.goto(`${origin}/login?redirect=https://example.invalid`);
    await googleButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Iniciar sesión' });
    await expect(dialog.getByRole('alert')).toHaveText(mockApi.googleMessage);
    await expectContrast(dialog.getByRole('alert'), dialog);
    await expect(dialog).toHaveAttribute('aria-busy', 'false');
    await expect(page).toHaveURL(`${origin}/login?redirect=https://example.invalid`);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`${origin}/`);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

test('Google callbacks retained after close cannot authenticate, update errors or affect a reopened modal', async ({ page, mockApi }) => {
  await page.goto(origin);
  const cta = page.getByRole('button', { name: 'Empezar con Google' });
  await cta.click();
  await expect(googleButton(page)).toBeVisible();
  await page.evaluate(() => window.oldGoogle = window.mockGoogle);
  await page.keyboard.press('Escape');
  await cta.click();
  await expect(googleButton(page)).toBeVisible();
  await page.evaluate(() => {
    window.oldGoogle({ credential: 'synthetic-token' });
    window.oldGoogle({});
  });
  expect(callsFor(mockApi, '/auth/google', 'POST')).toHaveLength(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-busy', 'false');
});

for (const [context, status] of ['account', 'session', 'route', 'unmount'].flatMap(context => [200, 500].map(status => [context, status]))) {
  test(`Google late ${status} cannot commit or navigate after ${context} changes`, async ({ page, mockApi }) => {
    mockApi.googleStatus = status;
    await page.goto(origin);
    await page.getByRole('button', { name: 'Empezar con Google' }).click();
    await expect(googleButton(page)).toBeVisible();
    const held = deferred(); mockApi.beforeGoogle = () => held.promise;
    try {
      await googleButton(page).click();
      await expect.poll(() => callsFor(mockApi, '/auth/google', 'POST').length).toBe(1);
      if (context === 'account') await page.evaluate(() => localStorage.setItem('email', 'another@example.invalid'));
      if (context === 'session') await page.evaluate(() => localStorage.setItem('token', 'replacement'));
      if (context === 'route') await page.evaluate(() => history.pushState(null, '', '/elsewhere'));
      if (context === 'unmount') {
        await page.evaluate(() => { history.pushState(null, '', '/elsewhere'); dispatchEvent(new PopStateEvent('popstate')); });
        await expect(page).toHaveURL(`${origin}/login`);
      }
    } finally { held.release(); }
    await expect.poll(() => mockApi.settled.includes('google')).toBe(true);
    await expect(page).not.toHaveURL(`${origin}/dashboard`);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe(context === 'session' ? 'replacement' : null);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

for (const context of ['route', 'account']) {
  test(`same-tick unrelated GET stays independent of stale Google login after ${context} change`, async ({ page, mockApi }) => {
    await page.goto(origin);
    await page.getByRole('button', { name: 'Empezar con Google' }).click();
    await expect(googleButton(page)).toBeVisible();
    const googleHeld = deferred(), readHeld = deferred();
    mockApi.beforeGoogle = () => googleHeld.promise;
    mockApi.beforeHabits = () => readHeld.promise;
    try {
      await page.evaluate(async () => {
        const { default: client } = await import('/src/api/axios.ts');
        const hook = window.mockGoogle;
        const googleSettled = new Promise(resolve => {
          const observer = client.interceptors.response.use(response => {
            if (response.config.url === '/auth/google') {
              client.interceptors.response.eject(observer);
              // Drain the guard/provider continuations before checking session storage.
              setTimeout(resolve, 0);
            }
            return response;
          });
        });
        hook({ credential: 'synthetic-token' });
        // No await here: both requests snapshot the capture before Axios microtasks run.
        const read = client.get('/habits').then(() => 'fulfilled', error => error.message);
        hook.interleaving = { read, googleSettled };
      });
      await expect.poll(() => callsFor(mockApi, '/auth/google', 'POST').length).toBe(1);
      await expect.poll(() => callsFor(mockApi, '/habits').length).toBe(1);
      if (context === 'route') await page.evaluate(() => history.pushState(null, '', '/elsewhere'));
      else await page.evaluate(() => localStorage.setItem('email', 'replacement@example.invalid'));
    } finally {
      readHeld.release();
      googleHeld.release();
    }
    const result = await page.evaluate(async () => {
      const hook = window.mockGoogle;
      await hook.interleaving.googleSettled;
      const read = await hook.interleaving.read;
      delete hook.interleaving;
      return {
        read,
        profile: ['token', 'fullName', 'email', 'picture', 'timeZone'].map(key => localStorage.getItem(key)),
        path: location.pathname,
      };
    });
    expect.soft(result.read, 'Unrelated GET must not be rejected by the login guard').toBe('fulfilled');
    expect.soft(result.profile, 'Stale Google must not commit token or profile').toEqual([
      null, null, context === 'account' ? 'replacement@example.invalid' : null, null, null,
    ]);
    expect(result.path).toBe(context === 'route' ? '/elsewhere' : '/');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('missing Google credential and network failure are recoverable and never store failed login', async ({ page, mockApi }) => {
  await page.goto(origin);
  await page.getByRole('button', { name: 'Empezar con Google' }).click();
  await expect(googleButton(page)).toBeVisible();
  await page.evaluate(() => window.mockGoogle({}));
  await expect(page.getByRole('alert')).toHaveText('Error al autenticar con Google.');
  expect(callsFor(mockApi, '/auth/google', 'POST')).toHaveLength(0);
  mockApi.googleNetworkError = true;
  await googleButton(page).click();
  await expect(page.getByRole('alert')).toHaveText('El servidor está iniciando, espera unos segundos e intenta de nuevo.');
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  mockApi.googleNetworkError = false;
  await googleButton(page).click();
  await expect(page).toHaveURL(`${origin}/dashboard`);
  expect(callsFor(mockApi, '/auth/google', 'POST')).toHaveLength(2);
});

test('stale Google response guard does not poison a new login attempt after route unmount', async ({ page, mockApi }) => {
  await page.goto(origin);
  await page.getByRole('button', { name: 'Empezar con Google' }).click();
  const held = deferred(); mockApi.beforeGoogle = () => held.promise;
  try {
    await googleButton(page).click();
    await expect.poll(() => callsFor(mockApi, '/auth/google', 'POST').length).toBe(1);
    await page.evaluate(() => { history.pushState(null, '', '/elsewhere'); dispatchEvent(new PopStateEvent('popstate')); });
    await expect(page).toHaveURL(`${origin}/login`);
    mockApi.beforeGoogle = async () => {};
    await googleButton(page).click();
    await expect(page).toHaveURL(`${origin}/dashboard`);
  } finally { held.release(); }
  await expect.poll(() => mockApi.settled.filter(s => s === 'google').length).toBe(2);
  await expect(page).toHaveURL(`${origin}/dashboard`);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe(session.token);
});

test('authenticated landing example stays local and never becomes an account habit', async ({ page, mockApi }) => {
  await storeSession(page);
  await page.goto(origin);
  const cta = page.getByRole('link', { name: 'Empezar con Google' });
  await expect(cta).toBeVisible();
  const calls = [...mockApi.calls];
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
  const example = page.getByRole('figure').getByRole('checkbox', { name: 'Estirar al despertar', exact: true });
  await example.focus();
  await page.keyboard.press('Space');
  await expect(example).toBeChecked();
  await page.keyboard.press('Space');
  await expect(example).not.toBeChecked();
  expect(mockApi.calls).toEqual(calls);
  expect(await page.evaluate(() => window.demoStorageWrites)).toEqual([]);
  expect(await page.evaluate(() => [Object.entries(localStorage), Object.entries(sessionStorage)])).toEqual(storage);
  await cta.click();
  await expect(habitRow(page, 'Leer')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await expect(page.getByText(/Vista ilustrativa|Datos de ejemplo|12 y 13 de mayo|Estirar al despertar/)).toHaveCount(0);
  expect(mockApi.calls.filter(c => c.method !== 'GET')).toEqual([]);
});

test('authenticated landing CTAs enter dashboard without requesting Google again, logout replaces route and clears session', async ({ page, mockApi }) => {
  await storeSession(page);
  await page.goto(origin);
  await expect(page.getByRole('link', { name: 'Empezar con Google' })).toBeVisible();
  await page.getByRole('link', { name: 'Empezar con Google' }).click();
  await expect(page).toHaveURL(`${origin}/dashboard`);
  await expect(habitRow(page, 'Leer')).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem('completedHabits_2026-03-31', '["read"]');
    localStorage.setItem('unrelated', 'keep');
  });
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/`);
  expect(await page.evaluate(() => ['token', 'fullName', 'email', 'picture', 'timeZone', 'completedHabits_2026-03-31'].map(k => localStorage.getItem(k)))).toEqual(Array(6).fill(null));
  expect(await page.evaluate(() => localStorage.getItem('unrelated'))).toBe('keep');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goBack();
  await expect(page.getByText('Estos son tus hábitos diarios')).toHaveCount(0);
  expect(callsFor(mockApi, '/auth/google', 'POST')).toHaveLength(0);
});

async function storeSession(page) {
  await page.addInitScript(() => {
    // Google frames must not reseed the application's origin in this synthetic fixture.
    if (window !== window.top) return;
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
  await expect(page).toHaveURL(`${origin}/`);
  await expect(page.getByRole('dialog')).toHaveCount(0);
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
      await expect(page).toHaveURL(`${origin}/`);
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

async function expectTapTarget(locator) {
  const box = await locator.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
}
async function expectNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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

test('presentation desktop has bordered cards, inline CTA, readable colors and keyboard focus', async ({ page, mockApi }, testInfo) => {
  mockApi.habits.push({ habitId: 'walk', title: 'Caminar al aire libre' }, { habitId: 'sleep', title: 'Dormir a una hora regular' });
  mockApi.logs = [{ habitId: 'walk', date: todayAnchor(), completed: true }];
  await storeSession(page);
  await page.goto(`${origin}/dashboard`);
  await expect(todayCheck(page)).toBeEnabled();
  const row = habitRow(page, 'Leer'), link = row.getByRole('link'), cta = page.getByRole('button', { name: 'Nuevo hábito', exact: true });
  await expectTapTarget(row.locator('label'));
  await expectTapTarget(cta);
  expect(await row.evaluate(el => parseFloat(getComputedStyle(el).borderTopWidth))).toBeGreaterThanOrEqual(1);
  expect(await row.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  expect(await cta.evaluate(el => getComputedStyle(el).position)).not.toBe('fixed');
  await expectContrast(cta);
  await expectContrast(link, row);
  await expectContrast(row.locator('.habit-status'), row);
  const doneRow = habitRow(page, 'Caminar al aire libre');
  await expect(row.locator('.habit-status')).toHaveText('Sin completar hoy');
  await expect(doneRow.locator('.habit-status')).toHaveText('Completado hoy');
  await expect(doneRow.locator('.habit-circle svg')).toHaveCount(1);
  await expect(row.locator('.habit-circle svg')).toHaveCount(0);
  const circleBox = await row.locator('.habit-circle').boundingBox(), titleBox = await link.boundingBox();
  expect(circleBox.width).toBe(28);
  expect(circleBox.x + circleBox.width).toBeLessThanOrEqual(titleBox.x);
  await expectContrast(doneRow.locator('.habit-status'), doneRow);
  await expectContrast(doneRow.locator('.habit-circle'));
  await expect(page.getByRole('region', { name: 'Tus hábitos de hoy', exact: true })).toBeVisible();
  await expect(page.getByText(/Vista ilustrativa|Datos de ejemplo|12 y 13 de mayo/)).toHaveCount(0);
  await expectContrast(page.getByText('1 de 3 completados hoy'), page.locator('body'));
  await cta.hover();
  await expectContrast(cta);
  await todayCheck(page).focus();
  expect(await row.locator('.habit-circle').evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Space');
  await expect(todayCheck(page)).toBeChecked();
  await expect(row.locator('.habit-status')).toHaveText('Completado hoy');
  // Pending disables the native input and may release focus; reacquire it for undo.
  await expect(todayCheck(page)).toBeEnabled();
  await todayCheck(page).focus();
  await page.keyboard.press('Space');
  await expect(todayCheck(page)).not.toBeChecked();
  await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  expect(mockApi.calls.filter(c => c.path.endsWith('/check')).map(c => c.body)).toEqual([null]);
  expect(mockApi.calls.filter(c => c.path.endsWith('/incomplete')).map(c => c.body)).toEqual([null]);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('dashboard-desktop.png'), fullPage: true });
  await expect(row.locator('label a')).toHaveCount(0);
  const writes = mockApi.calls.filter(c => c.method !== 'GET');
  const headers = { 'access-control-allow-origin': origin };
  await page.route('**/habits/read', route => route.fulfill({ json: mockApi.habits[0], headers }));
  await page.route('**/habits/read/logs', route => route.fulfill({ json: [], headers }));
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${origin}/habits/read`);
  await expect(page.getByRole('heading', { name: 'Historial del mes actual de la cuenta', exact: true })).toBeVisible();
  expect(mockApi.calls.filter(c => c.method !== 'GET')).toEqual(writes);
});

for (const width of [375, 320]) {
  test(`presentation dashboard ${width}px wraps long names and keeps hidden links and navbar reachable`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize({ width, height: 740 });
    mockApi.habits = [{ habitId: 'read', title: 'Lectura'.repeat(28) }, { habitId: 'hidden', title: 'Descanso'.repeat(25), status: 'archived' }];
    mockApi.session = { ...session, fullName: 'Nombre de usuario muy largo '.repeat(12) };
    await storeSession(page);
    await page.goto(`${origin}/dashboard`);
    await expect(todayCheck(page, mockApi.habits[0].title)).toBeEnabled();
    await expectTapTarget(habitRow(page, mockApi.habits[0].title).locator('label'));
    await expectTapTarget(page.getByRole('button', { name: 'Salir', exact: true }));
    const hidden = page.locator('details');
    await expectTapTarget(hidden.locator('summary'));
    await hidden.locator('summary').click();
    await expectTapTarget(hidden.getByRole('link'));
    await expectNoOverflow(page);
    await expect(hidden.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nuevo hábito', exact: true })).toBeVisible();
    if (width === 375) {
      mockApi.habits = [{ habitId: 'read', title: 'Leer por la noche' }, { habitId: 'walk', title: 'Caminar al aire libre' }, { habitId: 'hidden', title: 'Practicar guitarra', status: 'archived' }];
      mockApi.logs = [{ habitId: 'walk', date: todayAnchor(), completed: true }];
      await page.reload();
      await expect(todayCheck(page, 'Caminar al aire libre')).toBeChecked();
      await page.screenshot({ path: testInfo.outputPath('dashboard-mobile.png'), fullPage: true });
    }
  });
}

for (const width of [375, 320]) {
  test(`presentation name form ${width}px stays scrollable with readable errors and 44px controls`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize({ width, height: 480 });
    await openCreate(page);
    const dialog = page.getByRole('dialog'), input = dialog.getByLabel('Título', { exact: true });
    await expect(input).toBeFocused();
    await expectTapTarget(input);
    for (const button of await dialog.getByRole('button').all()) await expectTapTarget(button);
    await input.fill('ab');
    await dialog.getByRole('button', { name: 'Crear hábito', exact: true }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expectContrast(dialog.getByRole('alert'), dialog);
    await expectContrast(dialog.getByRole('button', { name: 'Crear hábito', exact: true }));
    await expect(dialog.locator('input')).toHaveCount(1);
    await expect(dialog.locator('select')).toHaveCount(0);
    const box = await dialog.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(480);
    expect(await dialog.evaluate(el => getComputedStyle(el).overflowY)).toBe('auto');
    await expectNoOverflow(page);
    expect(callsFor(mockApi, '/habits', 'POST')).toHaveLength(0);
    if (width === 320) await page.screenshot({ path: testInfo.outputPath('habit-form-mobile.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
}

test('presentation pending and completed states preserve native checkbox and distinguish the card', async ({ page, mockApi }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openDashboard(page, mockApi);
  const row = habitRow(page, 'Leer'), checkbox = todayCheck(page);
  const originalBorder = await row.evaluate(el => getComputedStyle(el).borderTopColor);
  await expect(row.locator('.habit-status')).toHaveText('Sin completar hoy');
  const held = deferred(); mockApi.beforeMutation = () => held.promise;
  try {
    await checkbox.click();
    await expect(checkbox).toBeDisabled();
    await expect(row).toHaveAttribute('aria-busy', 'true');
    expect(await row.locator('label').evaluate(el => getComputedStyle(el).cursor)).toBe('wait');
    await expect(row.locator('.habit-status')).toHaveText('Guardando...');
  } finally { held.release(); }
  await expect(checkbox).toBeChecked();
  await expect(row).toHaveAttribute('aria-busy', 'false');
  expect(await row.evaluate(el => getComputedStyle(el).borderTopColor)).not.toBe(originalBorder);
  await expect(row.locator('.habit-status')).toHaveText('Completado hoy');
  await expectContrast(row.locator('.habit-status'), row);
  await expectContrast(row.locator('.habit-circle'));
  expect(await checkbox.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  expect(mockApi.calls.filter(c => c.path.endsWith('/check'))).toHaveLength(1);
});

test('archive collision in create never sends lifecycle restore or hides the failure', async ({ page, mockApi }) => {
  await openCreate(page);
  mockApi.createStatus = 409;
  await page.getByRole('button', { name: 'Crear hábito', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('El hábito cambió. Recarga el detalle');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(mockApi.calls.filter(c => c.method === 'PATCH')).toHaveLength(0);
});
