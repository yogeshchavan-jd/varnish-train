(() => {
  'use strict';
  const M = window.JourneyModel;
  const { escape: esc, keyHTML, parameterHTML, stop } = window.RailUI;
  const $ = id => document.getElementById(id);
  let selected = 'tracking';
  const field = (name, label, value, help = '', multiline = false) => `<label class="lab-field"><span>${label}</span>${multiline ? `<textarea name="${name}" spellcheck="false">${esc(value)}</textarea>` : `<input name="${name}" value="${esc(value)}" spellcheck="false">`}${help ? `<small>${help}</small>` : ''}</label>`;
  const select = (name, label, options, chosen) => `<label class="lab-field"><span>${label}</span><select name="${name}">${options.map(([value, text]) => `<option value="${esc(value)}" ${String(value) === String(chosen) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
  const header = (title, intro) => `<h3>${title}</h3><p class="lab-intro">${intro}</p>`;
  const box = (label, value, orange = false) => `<div class="result-box ${orange ? 'orange' : ''}"><small>${label}</small><code>${esc(value || '(header absent)')}</code></div>`;
  const check = (label, value) => `<div class="result-check"><span>${label}</span><b>${esc(value)}</b></div>`;
  const presets = buttons => `<div class="preset-buttons">${buttons.map(([key, label]) => `<button data-preset="${key}">${label}</button>`).join('')}</div>`;
  const value = name => { const input = $('lab-inputs').querySelector(`[name="${name}"]`); return input.type === 'checkbox' ? input.checked : input.value; };
  function update() {
    let html = '<p class="result-eyebrow">ILLUSTRATIVE POLICY RESULT</p>';
    if (selected === 'tracking') {
      const { output, parameters } = M.marketingAnalysis(value('url'));
      html += box('EXAMPLE CLEANED URL', output) + parameterHTML(parameters);
      html += '<p class="result-note">This demo parses query parameters and removes selected campaign names case-insensitively. It also removes empty tracking values. Business parameters and fragments are retained; URL encoding may be normalized. It does not reproduce a production replacement expression.</p>';
    } else if (selected === 'cookies') {
      const lines = value('cookies').split('\n').map(s => s.trim()).filter(Boolean);
      const collected = M.collectCookies(lines);
      const route = M.classify({ method: value('method'), url: value('url'), cookie: collected, authorization: value('auth') });
      html += `<span class="result-badge">${esc(route.action)}</span>` + box('COLLECTION EXAMPLE · IF REACHED', collected);
      html += check('Cookie fields', `${lines.length} → ${lines.length ? 1 : 0}`) + check('Public std module’s default separator', 'Comma + space') + check('Application context', M.varyValue(collected) || 'No example context found');
      html += `<p class="result-note"><strong>${esc(route.reason)}</strong> ${['method', 'control'].includes(route.at) ? 'An earlier decision skips collection. This merge is hypothetical.' : 'Collection preserves values; it does not decide whether personalized content is cacheable.'}</p><p class="result-note">Stock Varnish generally bypasses requests carrying cookies. This educational storefront example illustrates a custom policy instead.</p>`;
    } else if (selected === 'encoding') {
      const result = M.encoding(value('url'), value('accept'), value('agent'));
      html += box('EXAMPLE ACCEPT-ENCODING', result.value, !result.value) + `<p class="result-note"><strong>${esc(result.reason)}</strong></p>`;
      html += check('Legacy MSIE client', /MSIE/i.test(value('agent')) ? 'YES' : 'NO');
      html += '<p class="result-note">The example skips selected compressed formats, honors q=0, prefers acceptable gzip, and avoids deflate for the legacy-client example. This small compatibility model is not a complete HTTP negotiation implementation.</p>';
    } else if (selected === 'key') {
      const url = M.stripMarketing(value('url'));
      const headers = { Host: value('host'), Cookie: value('cookies'), 'X-Forwarded-Proto': value('proto'), Store: value('store'), 'Content-Currency': value('currency') };
      html += keyHTML(M.hashParts({ url, headers }));
      html += '<p class="result-note">This recipe uses illustrative application dimensions plus URL and host. A blank host uses a documentation-range example address. Store and currency contribute only for the GraphQL example. It is not an exported production key definition.</p>';
    } else {
      const ttl = Number(value('ttl'));
      const input = { status: Number(value('status')), ttl: Number.isFinite(ttl) ? ttl : 0, control: value('control'), surrogate: value('surrogate'), vary: value('vary'), method: value('method'), passed: value('passed'), setCookie: true };
      const result = M.responseDecision(input);
      html += `<span class="result-badge">${result.cacheable ? 'REUSABLE OBJECT' : 'UNCACHEABLE'}</span>`;
      html += check('Set-Cookie', result.cookieRemoved ? 'REMOVED' : 'PRESERVED') + check('Example resulting TTL', `${result.ttl}s`) + check('Early decision', result.early ? 'YES' : 'NO') + check('Storage result', result.cacheable ? 'Reusable response' : input.passed ? 'No reusable object (PASS)' : result.ttl > 0 ? 'Hit-for-miss metadata' : 'No positive-lived marker');
      html += `<p class="result-note"><strong>${esc(result.reason)}</strong> ${result.early ? 'Later cookie processing is skipped.' : 'The example cookie step precedes the final cacheability decision.'}</p><p class="result-note">TTL is an explicit input, not derived here. These sample policies demonstrate ordering; actual server behavior depends on its configuration.</p>`;
    }
    $('lab-results').innerHTML = html;
  }
  function render(tab) {
    selected = tab;
    document.querySelectorAll('[data-lab]').forEach(button => { const active = button.dataset.lab === tab; button.setAttribute('aria-selected', active); button.tabIndex = active ? 0 : -1; });
    $('lab-panel').setAttribute('aria-labelledby', `lab-tab-${tab}`);
    let html;
    if (tab === 'tracking') html = header('Which baggage gets removed?', 'Try a parser-based campaign-cleanup example.') + field('url', 'EXAMPLE REQUEST URL', M.RAW_URL, 'Example families: utm_*, gclid, fbclid, and mc_*.', true) + presets([['campaign', 'Campaign link'], ['empty', 'Empty value'], ['uppercase', 'Uppercase name'], ['leading', 'Extra separator'], ['substring', 'Business parameter']]);
    if (tab === 'cookies') html = header('Collection and routing are different decisions.', 'Enter one sample Cookie field per line, then try different request attributes.') + field('cookies', 'EXAMPLE COOKIE FIELD(S)', M.COOKIE, 'Use fictional values only.', true) + '<div class="lab-pair">' + select('method', 'METHOD', ['GET', 'HEAD', 'POST', 'PATCH', 'CUSTOM', 'PURGE'].map(x => [x, x]), 'GET') + field('url', 'URL', '/products.html') + '</div>' + field('auth', 'EXAMPLE AUTHORIZATION', '', 'Any nonempty credentials select PASS in this example.') + presets([['wp', 'Login cookie'], ['session', 'Session example'], ['two', 'Two fields'], ['checkout', 'Checkout']]);
    if (tab === 'encoding') html = header('Try an encoding preference.', 'A small compatibility policy demonstrates format checks and accepted encodings.') + field('url', 'EXAMPLE URL', '/products.html') + field('accept', 'ACCEPT-ENCODING', 'gzip, deflate, br') + field('agent', 'EXAMPLE USER-AGENT', 'ExampleBrowser/1.0') + presets([['image', 'Image'], ['image-query', 'Image + query'], ['brotli', 'Brotli only'], ['msie', 'Legacy client'], ['zero', 'gzip;q=0']]);
    if (tab === 'key') html = header('Assemble an example cache key.', 'Application context can supplement the built-in URL and host dimensions.') + field('url', 'URL', '/graphql?query=%7Bproducts%7D&utm_source=app') + field('cookies', 'COOKIE', 'X-Magento-Vary=demo-store; PHPSESSID=demo') + '<div class="lab-pair">' + field('host', 'EXAMPLE HOST', 'shop.example') + field('proto', 'FORWARDED PROTOCOL', '') + field('store', 'STORE', 'demo') + field('currency', 'CURRENCY', 'USD') + '</div>';
    if (tab === 'response') html = header('Explore response-policy ordering.', 'Change the example origin values and see the effect of early decisions.') + '<div class="lab-pair">' + select('status', 'STATUS', [200, 404, 302, 500].map(x => [x, x]), 200) + field('ttl', 'INITIAL TTL (SECONDS)', '3600') + '</div>' + field('control', 'CACHE-CONTROL', 'public, max-age=3600') + '<div class="lab-pair">' + field('surrogate', 'SURROGATE-CONTROL', '') + field('vary', 'VARY', 'Accept-Encoding') + '</div><div class="lab-pair">' + select('method', 'BACKEND METHOD', ['GET', 'HEAD', 'POST'].map(x => [x, x]), 'GET') + '<label class="lab-checkbox"><input name="passed" type="checkbox"> Already a PASS request</label></div>' + presets([['private', 'Private'], ['nostore', 'No-store / TTL 0'], ['late', 'Positive TTL'], ['vary', 'Vary: *'], ['surrogate', 'Surrogate policy']]);
    $('lab-inputs').innerHTML = html;
    update();
  }
  function apply(values) { for (const [name, v] of Object.entries(values)) { const input = $('lab-inputs').querySelector(`[name="${name}"]`); if (input) input.value = v; } update(); }
  $('lab-inputs').addEventListener('input', update);
  $('lab-inputs').addEventListener('change', update);
  $('lab-inputs').addEventListener('click', event => {
    const p = event.target.closest('[data-preset]')?.dataset.preset;
    if (!p) return;
    const examples = {
      tracking: { campaign: { url: M.RAW_URL }, empty: { url: '/products.html?utm_source=&color=green' }, uppercase: { url: '/products.html?UTM_SOURCE=google&color=green' }, leading: { url: '/products.html?utm_source=mail&&color=green' }, substring: { url: '/products.html?utm_source=mail&custom_utm_medium=cpc&size=32' } },
      cookies: { wp: { cookies: `${M.COOKIE}; wordpress_logged_in_demo=sample`, method: 'GET', url: '/products.html', auth: '' }, session: { cookies: 'PHPSESSID=demo-session', method: 'GET', url: '/products.html', auth: '' }, two: { cookies: '_ga=demo-analytics\nPHPSESSID=demo; X-Magento-Vary=demo-store', method: 'GET', url: '/products.html', auth: '' }, checkout: { cookies: M.COOKIE, method: 'GET', url: '/checkout/cart/?utm_source=mail', auth: '' } },
      encoding: { image: { url: '/photo.jpg', accept: 'gzip, br', agent: 'ExampleBrowser/1.0' }, 'image-query': { url: '/photo.jpg?v=2', accept: 'gzip, br', agent: 'ExampleBrowser/1.0' }, brotli: { url: '/products.html', accept: 'br', agent: 'ExampleBrowser/1.0' }, msie: { url: '/products.html', accept: 'deflate', agent: 'MSIE example' }, zero: { url: '/products.html', accept: 'gzip;q=0, br;q=1', agent: 'ExampleBrowser/1.0' } },
      response: { private: { status: 200, ttl: 3600, control: 'private', surrogate: '', vary: 'Accept-Encoding' }, nostore: { status: 200, ttl: 0, control: 'no-store', surrogate: '', vary: 'Accept-Encoding' }, late: { status: 200, ttl: 3600, control: 'no-store', surrogate: '', vary: 'Accept-Encoding' }, vary: { status: 200, ttl: 3600, control: 'public, max-age=3600', surrogate: '', vary: '*' }, surrogate: { status: 200, ttl: 3600, control: 'no-store', surrogate: 'max-age=3600', vary: 'Accept-Encoding' } }
    };
    if (examples[selected]?.[p]) apply(examples[selected][p]);
  });
  document.querySelectorAll('[data-lab]').forEach(button => button.addEventListener('click', () => { stop(); render(button.dataset.lab); }));
  $('lab-reset').addEventListener('click', () => render(selected));
  render('tracking');
})();
