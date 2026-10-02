const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global.window = global;
require('../journey-data.js');
const M = global.JourneyModel;
const stop = (key, id) => M.build(key).stages.find(s => s.id === id);

test('campaign cleanup preserves business parameters, duplicates, and fragments', () => {
  assert.equal(M.stripMarketing(M.RAW_URL), '/products.html?color=green&size=32');
  assert.equal(M.stripMarketing('/p?UTM_SOURCE=mail'), '/p');
  assert.equal(M.stripMarketing('/p?utm_source=&size=32'), '/p?size=32');
  assert.equal(M.stripMarketing('/p?utm_source=mail&&size=32'), '/p?size=32');
  assert.equal(M.stripMarketing('/p?utm_source=a/b&size=32'), '/p?size=32');
  assert.equal(M.stripMarketing('/p?color=red&utm_source=mail&color=green#sizes'), '/p?color=red&color=green#sizes');
  assert.equal(M.stripMarketing('/p#utm_source=kept'), '/p#utm_source=kept');
  const sample = M.marketingAnalysis('/p?utm_source=mail&custom_utm_medium=cpc&size=32');
  assert.equal(sample.output, '/p?custom_utm_medium=cpc&size=32');
  assert.deepEqual(sample.parameters.map(p => p.removed), [true, false, false]);
});

test('first matching request decision controls the remaining route', () => {
  assert.equal(M.classify({ cookie: M.COOKIE }).action, 'HASH');
  assert.equal(M.classify({ cookie: 'wordpress_logged_in_demo=sample' }).at, 'cookies');
  assert.equal(M.classify({ method: 'POST', cookie: 'wordpress_logged_in_demo=sample' }).at, 'method');
  assert.equal(M.classify({ method: 'PATCH' }).action, 'PASS');
  assert.equal(M.classify({ method: 'CUSTOM' }).action, 'PIPE');
  for (const authorization of ['Bearer example', 'Basic example', 'bearer example']) {
    assert.equal(M.classify({ authorization }).action, 'PASS');
  }
  assert.equal(M.classify({ url: '/checkout/cart/', authorization: 'Bearer example' }).at, 'paths');
  assert.equal(M.classify({ method: 'POST', url: '/health' }).action, 'SYNTH');
});

test('collection preserves cookie fields and the example application context', () => {
  assert.equal(M.collectCookies(['_ga=demo', 'PHPSESSID=demo']), '_ga=demo, PHPSESSID=demo');
  assert.equal(M.varyValue(M.COOKIE), 'demo-store');
  assert.equal(M.varyValue('PHPSESSID=demo'), '');
  assert.equal(stop('miss', 'cookies').after.headers.Cookie, M.COOKIE);
});

test('encoding examples honor rejected encodings and media URLs with queries', () => {
  assert.equal(M.encoding('/p.jpg', 'gzip, br').value, '');
  assert.equal(M.encoding('/p.jpg?v=2', 'gzip, br').value, '');
  assert.equal(M.encoding('/p', 'br').value, '');
  assert.equal(M.encoding('/p', 'gzip;q=0, deflate').value, 'deflate');
  assert.equal(M.encoding('/p', 'gzip;q=0, br;q=1').value, '');
  assert.equal(M.encoding('/p', 'deflate', 'MSIE example').value, '');
  assert.equal(M.encoding('/p', 'deflate', 'ExampleBrowser').value, 'deflate');
});

test('key dimensions vary only with relevant context and routing inputs', () => {
  const input = { url: '/graphql', headers: { Host: 'shop.example', Cookie: M.COOKIE, Store: 'demo', 'Content-Currency': 'EUR' } };
  assert.deepEqual(M.hashParts(input).map(p => p.value), ['demo-store', 'demo', 'EUR', '/graphql', 'shop.example']);
  input.url = '/products';
  input.headers['X-Forwarded-Proto'] = 'https';
  assert.deepEqual(M.hashParts(input).map(p => p.value), ['demo-store', 'https', '/products', 'shop.example']);
  delete input.headers.Host;
  assert.equal(M.hashParts(input).at(-1).value, '192.0.2.10');
});

test('response ordering preserves early-return cookies and prevents PASS storage', () => {
  assert.equal(M.responseDecision({ status: 500, ttl: 3600 }).cookieRemoved, false);
  assert.equal(M.responseDecision({ status: 500, ttl: 3600 }).ttl, 0);
  assert.equal(M.responseDecision({ control: 'private', ttl: 3600 }).ttl, 120);
  assert.equal(M.responseDecision({ control: 'private', ttl: 3600 }).cookieRemoved, false);
  assert.equal(M.responseDecision({ control: 'no-store', ttl: 3600 }).cookieRemoved, true);
  assert.equal(M.responseDecision({ control: 'no-store', ttl: 3600 }).cacheable, false);
  assert.equal(M.responseDecision({ control: 'no-store', ttl: 0 }).cookieRemoved, false);
  assert.equal(M.responseDecision({ control: 'no-store', surrogate: 'max-age=3600', ttl: 3600 }).cacheable, true);
  assert.equal(M.responseDecision({ vary: '*' }).cacheable, false);
  assert.equal(M.responseDecision({ passed: true }).cacheable, false);
  assert.equal(M.responseDecision({ status: 404 }).cacheable, true);
});

test('early bypass skips later request steps but retains response processing', () => {
  for (const key of ['checkout', 'wordpress', 'post']) {
    const trip = M.build(key);
    assert.equal(trip.stages.some(s => s.id === 'marketing'), false, key);
    assert.equal(trip.stages.some(s => s.id === 'hash'), false, key);
    assert.equal(trip.stages.some(s => s.id === 'debug'), true, key);
    assert.ok(stop(key, 'backend').after.url.includes('utm_source'), key);
    assert.match(trip.stages.at(-1).after.cache, /PASS/);
    assert.equal(trip.stages.at(-1).after.headers['X-Magento-Cache-Debug'], 'PASS');
  }
  assert.equal(stop('bearer', 'backend').after.url, '/products.html?color=green&size=32');
  assert.equal(M.build('bearer').stages.some(s => s.id === 'hash'), false);
});

test('hit, restart, synthetic response, and pipe take distinct paths', () => {
  assert.equal(M.build('hit').stages.some(s => s.id === 'origin-response'), false);
  assert.equal(M.build('hit').stages.at(-1).after.headers['X-Magento-Cache-Debug'], 'HIT');
  assert.equal(stop('restart', 'entry-retry').after.attrs['req.hash_always_miss'], true);
  assert.equal(stop('restart', 'entry-retry').after.attrs['req.restarts'], 1);
  assert.equal(stop('restart', 'entry-retry').after.url, '/products.html?color=green&size=32');
  for (const key of ['health', 'purge', 'pipe']) {
    assert.equal(M.build(key).stages.some(s => s.station === 'deliver'), false, key);
  }
  assert.equal(M.build('pipe').stages.at(-1).after.status, null);
});

test('delivery cleanup leaves stored metadata and browser security fields intact', () => {
  const stored = stop('miss', 'storage');
  assert.equal(stored.after.headers['Cache-Control'], 'public, max-age=3600');
  assert.equal(stored.after.headers['X-Magento-Tags'], 'demo_product_42');
  assert.equal(stored.after.headers['Set-Cookie'], undefined);
  const final = M.build('miss').stages.at(-1).after;
  assert.equal(final.headers['Cache-Control'], 'no-store');
  assert.equal(final.headers['X-Magento-Cache-Control'], 'public, max-age=3600');
  assert.equal(final.headers['X-Magento-Tags'], undefined);
  assert.equal(final.headers.Vary, 'Accept-Encoding');
  assert.equal(final.headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(final.headers['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(final.headers['X-Cache-Age'], '0');
  assert.equal(stop('private', 'storage').after.cache, 'Hit-for-miss · 120s');
  assert.equal(stop('error', 'storage').after.cache, 'Uncacheable · TTL 0');
});

test('every journey has valid unique stops and independent fictional snapshots', () => {
  for (const key of Object.keys(M.scenarios)) {
    const trip = M.build(key);
    assert.equal(new Set(trip.stages.map(s => s.id)).size, trip.stages.length);
    assert.equal(trip.stages.at(-1).id, 'arrive');
    for (const s of trip.stages) {
      assert.ok(M.stations[s.station]);
      assert.ok(s.title && s.description);
      assert.equal(s.code, undefined);
      for (const snapshot of [s.before, s.after]) {
        if (snapshot.headers.Host) assert.equal(snapshot.headers.Host, 'shop.example');
        if (snapshot.headers['X-Forwarded-For']) assert.equal(snapshot.headers['X-Forwarded-For'], '203.0.113.42');
      }
    }
    trip.stages[0].after.headers.Cookie = 'modified';
    assert.notEqual(trip.stages[0].before.headers.Cookie, 'modified');
    assert.notEqual(trip.stages[1].before.headers.Cookie, 'modified');
    assert.notEqual(M.build(key).stages[0].after.headers.Cookie, 'modified');
  }
});

test('public assets contain no configuration payload or source-viewer dependency', () => {
  const root = path.join(__dirname, '..');
  const assets = ['index.html', 'app.js', 'journey-data.js', 'workbench.js', 'README.md'];
  for (const file of assets) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(content, /vcl-source\.js|data-open-source|id="(?:source-dialog|tab-code)"/, file);
    assert.doesNotMatch(content, /\bsub\s+vcl_\w+\s*\{|\bvcl\s+4\.\d\s*;|\bbackend\s+default\s*\{/, file);
  }
  assert.equal(fs.existsSync(path.join(root, 'vcl-source.js')), false);
  assert.equal(M.source, undefined);
  assert.equal(M.rule, undefined);
});
