/* Public teaching model. These illustrative policies are not a production
   configuration, a configuration export, or a general VCL interpreter. */
(() => {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const HOST = 'shop.example';
  const RAW_URL = '/products.html?color=green&utm_source=google&utm_medium=cpc&gclid=abc123&size=32';
  const COOKIE = '_ga=demo-analytics; PHPSESSID=demo-session; X-Magento-Vary=demo-store';
  const GRACE_LABEL = '30 minutes';
  const tracked = /^(?:utm_[a-z]+|gclid|fbclid|mc_[a-z]+)$/i;
  const pathPatterns = ['^/checkout/', '^/account/', '^/admin/', '^/cart/'];
  const allowedMethods = ['GET', 'HEAD', 'PUT', 'POST', 'PATCH', 'TRACE', 'OPTIONS', 'DELETE'];
  const removedHeaders = ['X-Powered-By', 'Server', 'X-Varnish', 'Via', 'X-Magento-Debug'];

  function marketingAnalysis(url) {
    const fragmentAt = url.indexOf('#');
    const fragment = fragmentAt < 0 ? '' : url.slice(fragmentAt);
    const body = fragmentAt < 0 ? url : url.slice(0, fragmentAt);
    const queryAt = body.indexOf('?');
    if (queryAt < 0) return { output: url, parameters: [] };
    const kept = new URLSearchParams();
    const parameters = [...new URLSearchParams(body.slice(queryAt + 1))].map(([name, value]) => {
      const removed = tracked.test(name);
      if (!removed) kept.append(name, value);
      return { name, value, removed, changed: false };
    });
    const query = kept.toString();
    return { output: body.slice(0, queryAt) + (query ? `?${query}` : '') + fragment, parameters };
  }
  const stripMarketing = url => marketingAnalysis(url).output;
  const collectCookies = lines => lines.filter(Boolean).join(', ');
  function encoding(url, accept, agent = '') {
    if (!accept) return { value: '', reason: 'There is no encoding preference to normalize.' };
    if (/\.(?:jpg|jpeg|png|gif|webp|avif|zip|gz)(?:$|\?)/i.test(url)) return { value: '', reason: 'This demo avoids recompressing the listed image and archive formats.' };
    const accepted = accept.split(',').map(part => {
      const [name, ...options] = part.trim().toLowerCase().split(';');
      const quality = options.find(option => option.trim().startsWith('q='));
      return { name: name.trim(), quality: quality ? Number(quality.trim().slice(2)) : 1 };
    });
    for (const algorithm of ['gzip', 'deflate']) {
      if (algorithm === 'deflate' && /MSIE/i.test(agent)) continue;
      if (accepted.some(item => item.name === algorithm && item.quality > 0)) return { value: algorithm, reason: `${algorithm} is accepted by the client and supported by this example policy.` };
    }
    return { value: '', reason: 'No supported, acceptable encoding remains in this example.' };
  }
  function classify({ method = 'GET', url = '/', cookie = '', authorization = '' }) {
    if (url.split('?')[0] === '/health') return { action: 'SYNTH', at: 'control', reason: 'The example health endpoint returns a local response.' };
    if (method === 'PURGE') return { action: 'BAN + SYNTH', at: 'control', reason: 'This example invalidates matching cache tags and acknowledges the request.' };
    if (!allowedMethods.includes(method)) return { action: 'PIPE', at: 'method', reason: 'An unfamiliar method uses the illustrative tunnel route.' };
    if (!['GET', 'HEAD'].includes(method)) return { action: 'PASS', at: 'method', reason: `${method} is not a cache-lookup method in this example.` };
    if (/wordpress_logged_in_/.test(cookie)) return { action: 'PASS', at: 'cookies', reason: 'A login cookie selects the personalized-content route.' };
    const matched = pathPatterns.find(pattern => new RegExp(pattern).test(url));
    if (matched) return { action: 'PASS', at: 'paths', reason: 'The URL matches a sample personalized-page exclusion.', matched };
    if (authorization) return { action: 'PASS', at: 'auth', reason: 'Credentials select PASS in this teaching policy.' };
    return { action: 'HASH', at: 'auth', reason: 'This example request is eligible for cache lookup.' };
  }
  function varyValue(cookie) {
    const entry = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('X-Magento-Vary='));
    return entry ? entry.slice('X-Magento-Vary='.length) : '';
  }
  function hashParts({ url, headers }) {
    const parts = [];
    const context = varyValue(headers.Cookie || '');
    if (context) parts.push({ name: 'Application context', value: context, source: 'DEMO' });
    if (headers['X-Forwarded-Proto']) parts.push({ name: 'Forwarded protocol', value: headers['X-Forwarded-Proto'], source: 'DEMO' });
    if (url.split('?')[0] === '/graphql') {
      for (const h of ['Store', 'Content-Currency']) if (headers[h]) parts.push({ name: h, value: headers[h], source: 'GRAPHQL' });
    }
    parts.push({ name: 'Request URL', value: url, source: 'BUILT-IN' });
    parts.push({ name: headers.Host ? 'Host' : 'Server address', value: headers.Host || '192.0.2.10', source: 'BUILT-IN' });
    return parts;
  }
  function responseDecision({ status = 200, ttl = 3600, control = 'public, max-age=3600', surrogate = '', vary = '', method = 'GET', passed = false, setCookie = true }) {
    if (![200, 404].includes(Number(status))) return { cacheable: false, ttl: 0, cookieRemoved: false, early: true, reason: 'This example does not cache this response status.' };
    if (/private/i.test(control)) return { cacheable: false, ttl: 120, cookieRemoved: false, early: true, reason: 'A private response returns early and keeps its response cookie.' };
    const cookieRemoved = Boolean(setCookie && ttl > 0 && ['GET', 'HEAD'].includes(method));
    const blocked = ttl <= 0 || /no-store/i.test(surrogate) || (!surrogate && /no-cache|no-store/i.test(control)) || vary === '*';
    return { cacheable: !passed && !blocked, ttl: blocked ? 120 : ttl, cookieRemoved, early: false, reason: passed ? 'PASS remains uncacheable throughout the transaction.' : blocked ? 'This example keeps short-lived hit-for-miss metadata instead of reusable HTML.' : 'The example cacheability checks all passed.' };
  }

  const scenarios = {
    miss: { label: 'Storefront · cache miss', line: 'ALL-STOPS SERVICE', badge: 'MISS', subtitle: 'A complete example request and response journey.', group: 'The main lines' },
    hit: { label: 'Repeat visitor · cache hit', line: 'CACHE EXPRESS', badge: 'HIT', subtitle: 'A fresh matching object skips the origin.', group: 'The main lines' },
    checkout: { label: 'Checkout · URL bypass', line: 'PRIVATE LINE', badge: 'PASS', url: '/checkout/cart/?utm_source=mail', subtitle: 'A sample URL exclusion returns before later cleanup.', group: 'Request-side detours' },
    wordpress: { label: 'WordPress cookie · bypass', line: 'COOKIE DETOUR', badge: 'PASS', cookie: `${COOKIE}; wordpress_logged_in_demo=sample-user`, subtitle: 'A recognizable login cookie changes the route.', group: 'Request-side detours' },
    bearer: { label: 'Authorization · bypass', line: 'AUTHENTICATED LINE', badge: 'PASS', authorization: 'Bearer example-token', subtitle: 'Credentials select PASS in this example policy.', group: 'Request-side detours' },
    post: { label: 'POST · method bypass', line: 'METHOD DETOUR', badge: 'PASS', method: 'POST', subtitle: 'A method-based return skips the cache lookup.', group: 'Request-side detours' },
    graphql: { label: 'GraphQL · store & currency key', line: 'GRAPHQL CONNECTION', badge: 'MISS', url: '/graphql?query=%7Bproducts%7D&utm_source=app', subtitle: 'Application dimensions can separate cache variants.', group: 'Cache & response lines' },
    grace: { label: 'Stale by 120s · grace', line: 'GRACE CONNECTION', badge: 'STALE HIT', subtitle: 'An example stale object is still inside the serving window.', group: 'Cache & response lines' },
    restart: { label: 'Stale by 360s · restart', line: 'RESTART LOOP', badge: 'RESTART → MISS', subtitle: 'An illustrative restart forces the next lookup to miss.', group: 'Cache & response lines' },
    private: { label: 'Origin says private', line: 'UNCACHEABLE LINE', badge: 'PRIVATE', subtitle: 'The origin makes the response uncacheable.', group: 'Cache & response lines' },
    nostore: { label: 'Origin says no-store', line: 'UNCACHEABLE LINE', badge: 'HIT-FOR-MISS', subtitle: 'A short marker replaces reusable response storage.', group: 'Cache & response lines' },
    error: { label: 'Origin returns 500', line: 'ERROR RETURN', badge: '500', subtitle: 'The response status selects an uncached return.', group: 'Cache & response lines' },
    health: { label: 'Health endpoint · synthetic reply', line: 'LOCAL SERVICE', badge: 'SYNTH', url: '/health', subtitle: 'A local reply skips normal origin processing.', group: 'Special services' },
    purge: { label: 'PURGE · example tag invalidation', line: 'INVALIDATION SERVICE', badge: 'BAN', method: 'PURGE', url: '/products.html', subtitle: 'Tag invalidation followed by a local acknowledgement.', group: 'Special services' },
    pipe: { label: 'Custom method · pipe tunnel', line: 'TUNNEL SERVICE', badge: 'PIPE', method: 'CUSTOM', subtitle: 'A connection-level tunnel skips later HTTP hooks.', group: 'Special services' }
  };
  const stations = {
    client: { name: 'Browser', port: 'THE PASSENGER', x: 80, y: 145 }, edge: { name: 'Public Nginx', port: 'TLS · :443', x: 270, y: 145 },
    receive: { name: 'Receive', port: 'vcl_recv · :6081', x: 465, y: 145 }, hash: { name: 'Hash junction', port: 'vcl_hash', x: 665, y: 145 },
    cache: { name: 'Object cache', port: 'HIT / MISS', x: 860, y: 145 }, backend: { name: 'Backend Nginx', port: 'HTTP · :8080', x: 665, y: 355 },
    php: { name: 'PHP / Magento', port: 'FASTCGI', x: 465, y: 355 }, response: { name: 'Response check', port: 'vcl_backend_response', x: 860, y: 290 },
    deliver: { name: 'Delivery', port: 'vcl_deliver', x: 270, y: 355 }
  };
  const groups = { departure: 'Departure', receive: 'Receive & clean', hash: 'Build the key', lookup: 'Cache lookup', origin: 'Origin', response: 'Response rules', deliver: 'Delivery', arrival: 'Arrival' };
  const change = (name, before, after, reason = '', action) => ({ name, before: String(before ?? '—'), after: String(after ?? '—'), reason, action: action || (before === after ? 'keep' : after == null || after === '' ? 'remove' : before == null ? 'add' : 'change') });

  function build(key = 'miss') {
    const config = scenarios[key] || scenarios.miss;
    const request = { method: config.method || 'GET', url: config.url || RAW_URL, cookie: config.cookie || COOKIE, authorization: config.authorization || '' };
    const route = classify(request);
    const passed = route.action === 'PASS';
    const isHit = ['hit', 'grace'].includes(key);
    const isPrivate = passed || key === 'private';
    const status = key === 'error' ? 500 : 200;
    const control = isPrivate ? 'private, no-store' : ['nostore', 'error'].includes(key) ? 'no-store, max-age=0' : 'public, max-age=3600';
    const initialTTL = isPrivate || ['nostore', 'error'].includes(key) ? 0 : 3600;
    const contentType = key === 'graphql' ? 'application/json' : 'text/html; charset=UTF-8';
    const state = { method: request.method, url: request.url, scope: 'req', status: null, headers: { Host: HOST, 'Accept-Encoding': 'gzip, deflate, br', Cookie: request.cookie, 'User-Agent': 'ExampleBrowser/1.0' }, attrs: { 'req.restarts': 0 }, cache: isHit ? (key === 'grace' ? 'Stale · −120s' : 'Fresh · 3576s') : key === 'restart' ? 'Stale · −360s' : 'No matching object' };
    if (request.authorization) state.headers.Authorization = request.authorization;
    if (key === 'graphql') Object.assign(state.headers, { Store: 'demo', 'Content-Currency': 'USD' });
    const stages = [];
    function add(id, station, group, title, description, changes = [], facts = [], mutate, extra = {}) {
      const before = copy(state);
      if (mutate) mutate(state);
      stages.push({ id, station, group, title, description, changes, facts, before, after: copy(state), ...extra });
    }
    add('departure', 'client', 'departure', 'Your request boards the train.', 'A sample URL, cookies, and headers travel together. This public simulator uses fictional inputs and illustrative policies.', [change('Request', null, `${request.method} ${request.url}`), change('Host', null, HOST)], ['No production configuration is loaded, displayed, or downloadable.', 'The examples demonstrate concepts rather than a particular company’s setup.']);
    add('edge', 'edge', 'departure', 'Nginx checks the ticket at the front door.', 'The example edge terminates HTTPS and forwards the request to a cache service. Client information travels in forwarding headers.', [change('Transport', 'HTTPS', 'Internal HTTP'), change('X-Forwarded-For', null, '203.0.113.42')], ['Ports and addresses in this diagram are illustrative.', 'Forwarded protocol information is optional in this example.'], s => Object.assign(s.headers, { 'X-Forwarded-For': '203.0.113.42', 'X-Forwarded-Host': HOST }));
    function receive(retry = false) {
      const suffix = retry ? '-retry' : '';
      add('entry' + suffix, 'receive', 'receive', retry ? 'Restart the trip with a forced miss.' : 'Retain the original client information.', retry ? 'This example uses a positive restart count to force a fresh origin fetch on the next lookup.' : 'The edge already supplied the client’s address. The cache keeps that forwarding information.', [change('req.restarts', 0, retry ? 1 : 0), change(retry ? 'Forced miss' : 'X-Forwarded-For', retry ? false : '203.0.113.42', retry ? true : '203.0.113.42')], ['Restart behavior is policy-controlled; this is one teaching example.'], s => { s.scope = 'req'; s.attrs['req.restarts'] = retry ? 1 : 0; if (retry) s.attrs['req.hash_always_miss'] = true; });
      add('control' + suffix, 'receive', 'receive', 'Check for a local service request.', 'Health checks and cache invalidation may finish inside the proxy rather than visiting the application.', [change('Example health endpoint', null, route.action === 'SYNTH'), change('Invalidation method', null, request.method === 'PURGE')], ['A synthetic response is generated locally.', 'This example uses a tag ban for invalidation; real invalidation policies differ.']);
      if (route.at === 'control') return;
      add('method' + suffix, 'receive', 'receive', route.at === 'method' ? `${request.method} takes the ${route.action} track.` : 'GET and HEAD can continue toward the cache.', 'A method gate can distinguish cache lookups, passed transactions, and connection-level tunnels.', [change('Method', request.method, request.method), change('Decision', null, route.at === 'method' ? route.action : 'Continue')], ['This demo passes POST, PUT, PATCH, DELETE, OPTIONS, and TRACE.', 'Its CUSTOM-method example uses PIPE. It does not describe a production allowlist.']);
      if (route.at === 'method') return;
      const parsed = new URL(state.url, `https://${HOST}`);
      const normalized = parsed.pathname + parsed.search + parsed.hash;
      add('normalize' + suffix, 'receive', 'receive', 'Give the request a consistent URL shape.', 'The example normalizes a URL to its path and query before applying the remaining request policies.', [change('Request URL', state.url, normalized), change('Grace status', state.headers.grace, 'none')], ['Normalization choices determine which requests can share a cache key.'], s => { s.url = normalized; s.headers.grace = 'none'; });
      add('cookies' + suffix, 'receive', 'receive', key === 'wordpress' ? 'A login cookie selects the personal-content route.' : 'Cookie collection is not cookie removal.', 'Collection combines repeated header fields. This storefront demo preserves cookie values, then recognizes a sample login cookie as a reason to bypass cache lookup.', request.cookie.split('; ').map(pair => { const [name, ...v] = pair.split('='); return change(name, v.join('='), v.join('='), name === 'X-Magento-Vary' ? 'An application-context value can separate cache variants.' : 'Retained by the illustrative policy.'); }), ['Stock Varnish generally passes requests with cookies. This demo intentionally illustrates a custom eligibility policy.', 'The public std module defaults to comma + space when collecting repeated fields; collection is not a cookie-aware parser.'], undefined, { visual: 'cookies' });
      if (route.at === 'cookies') return;
      add('paths' + suffix, 'receive', 'receive', route.at === 'paths' ? 'A personal URL gets a bypass ticket.' : 'Check the sample URL exclusions.', 'Checkout, account, admin, and cart paths bypass caching in this simplified example.', [change('Request URL', state.url, state.url), change('Exclusion', null, route.at === 'paths' ? 'Matched' : 'No match')], [route.at === 'paths' ? 'This early return skips the later tracking-cleanup and hash stations.' : 'This small sample list is not a production route list.']);
      if (route.at === 'paths') return;
      const preference = encoding(state.url, state.headers['Accept-Encoding'], state.headers['User-Agent']);
      add('encoding' + suffix, 'receive', 'receive', 'Choose an acceptable compression preference.', 'The example avoids recompressing selected media and otherwise chooses an accepted gzip or deflate representation.', [change('Accept-Encoding', state.headers['Accept-Encoding'], preference.value, preference.reason)], ['A quality value of zero means that encoding is not acceptable.', 'Encoding compatibility and backend compression are separate decisions.'], s => { if (preference.value) s.headers['Accept-Encoding'] = preference.value; else delete s.headers['Accept-Encoding']; });
      const beforeURL = state.url;
      const cleanup = marketingAnalysis(beforeURL);
      add('marketing' + suffix, 'receive', 'receive', 'Marketing baggage gets left on the platform.', 'The demo removes selected campaign parameters by name while retaining product choices such as color and size.', [change('Request URL', beforeURL, cleanup.output)], ['Examples include utm_*, gclid, fbclid, and mc_*.', 'This public model uses a query-string parser, not a private deployment’s replacement expressions.', 'Matching application context and remaining URL inputs are still required for a shared cache key.'], s => { s.url = cleanup.output; }, { visual: 'parameters', parameters: cleanup.parameters });
      add('auth' + suffix, 'receive', 'receive', request.authorization ? 'Credentials select PASS.' : 'No credentials. Continue to the hash.', 'The example routes requests with Authorization to the origin. Anonymous requests that passed earlier checks continue to lookup.', [change('Authorization', state.headers.Authorization, state.headers.Authorization), change('Decision', null, passed ? 'PASS' : 'HASH')], ['Actual authorization and cookie policy is application-specific.'], s => { if (passed) s.cache = 'Bypassed'; });
    }
    receive();
    if (['SYNTH', 'BAN + SYNTH'].includes(route.action)) {
      add('synth', 'receive', 'arrival', key === 'purge' ? 'Invalidate, then acknowledge locally.' : 'Reply locally without the origin.', 'A synthetic response is generated by Varnish. It bypasses normal delivery-hook processing.', [change('Status', null, 200), change('Origin request', null, 'Not needed')], ['Client synthetic responses use vcl_synth rather than vcl_deliver.'], s => { s.scope = 'resp'; s.status = 200; s.headers = { 'Content-Type': 'text/html' }; s.cache = 'No reusable response stored'; });
      add('arrive', 'client', 'arrival', 'The local service has arrived.', 'The edge returns the acknowledgement to the client.', [], ['This is simulated traffic.'], undefined, { via: [[270, 145]] });
      return { ...config, key, stages, route };
    }
    if (route.action === 'PIPE') {
      add('pipe', 'backend', 'origin', 'A connection tunnel takes over.', 'After the pipe hook, Varnish relays bytes between the client and origin. Later VCL HTTP hooks do not process those bytes.', [change('Mode', null, 'PIPE')], ['The origin decides how to answer. No particular response status is assumed.'], s => { s.scope = 'tunnel'; s.cache = 'Not used'; }, { via: [[665, 145]] });
      add('arrive', 'client', 'arrival', 'The tunnel carries bytes back.', 'PIPE differs from PASS: a passed transaction still runs normal backend-response and delivery hooks.', [], ['This is an illustrative connection-level route.'], undefined, { via: [[665, 145], [270, 145]] });
      return { ...config, key, stages, route };
    }
    function hashing(suffix = '') {
      const context = varyValue(state.headers.Cookie || '');
      add('vary' + suffix, 'hash', 'hash', 'Application context can separate cache variants.', 'The demo uses a Magento-style context cookie as one cache-key ingredient while preserving the incoming cookie.', [change('Cookie', state.headers.Cookie, state.headers.Cookie), change('Context value', null, context)], ['A context cookie and the HTTP Vary response header are different concepts.'], undefined, { visual: 'key', keyParts: [{ name: 'Application context', value: context, source: 'DEMO' }] });
      add('hash' + suffix, 'hash', 'hash', 'Assemble the complete lookup key.', 'Optional application dimensions supplement the URL and host. The GraphQL example also uses store and currency.', [], ['This is an illustrative key recipe, not an exported hash configuration.', 'Changing a contributing input may select a different object.'], undefined, { visual: 'key', keyParts: hashParts(state) });
    }
    if (!passed) {
      hashing();
      if (key === 'restart') {
        add('expired', 'cache', 'lookup', 'This example stale window has closed.', 'The object is 360 seconds past expiry. In this demo, a healthy-origin stale-serving window is 300 seconds, so the request restarts.', [change('Remaining TTL', null, '-360s'), change('Decision', null, 'RESTART')], ['Grace and restart policies are configurable; these numbers are example inputs.'], undefined, { visual: 'ttl', ttl: -360 });
        receive(true); hashing('-retry');
      }
      add('lookup', 'cache', 'lookup', key === 'grace' ? 'Serve the available stale object and refresh separately.' : isHit ? 'A fresh hit takes the express home.' : 'Take the origin line on a miss.', key === 'grace' ? 'A sample object is 120 seconds past expiry and within the illustrative grace-serving window. A background refresh is scheduled.' : isHit ? 'The preset object is still fresh, so the application does not need to run again.' : 'No usable object is selected. A backend fetch is needed.', [change('Outcome', null, key === 'grace' ? 'STALE HIT' : isHit ? 'HIT' : 'MISS')], ['A fresh HIT does not run the backend-response hook again.', 'Background refresh is a separate fetch, not the client waiting for PHP.'], s => { if (key === 'grace') s.headers.grace = 'demo stale delivery'; }, { visual: isHit ? 'ttl' : 'decision', ttl: key === 'grace' ? -120 : 3576 });
    } else add('pass', 'receive', 'lookup', 'PASS skips lookup, not the proxy.', 'The transaction visits the origin and still uses response hooks. It cannot become a reusable cached page.', [change('Lookup', null, 'Skipped'), change('bereq.uncacheable', null, true)], ['Later positive TTL does not make a passed transaction cacheable.'], s => { s.attrs['bereq.uncacheable'] = true; s.cache = 'Bypassed'; });
    const graceLabel = state.headers.grace || 'none';
    const origin = { 'Content-Type': contentType, 'Cache-Control': control, 'Set-Cookie': 'demo_session=sample; Path=/; HttpOnly', 'X-Magento-Debug': '1', 'X-Magento-Tags': 'demo_product_42', 'X-Magento-Route': 'demo_page', 'X-Powered-By': 'PHP', Server: 'example-origin', Vary: 'Accept-Encoding', 'X-Origin-Debug': 'demo-origin', 'X-Frame-Options': 'SAMEORIGIN', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
    const decision = responseDecision({ status, ttl: initialTTL, control, method: request.method, passed });
    if (!isHit) {
      add('backend', 'backend', 'origin', 'The proxy creates an origin request.', 'A backend request carries the current URL and relevant headers to the example HTTP origin. Backend-request preparation is separate from client-request processing.', [change('Object', 'req', 'bereq'), change('Destination', null, 'Example origin service')], ['Varnish talks HTTP to the origin. Nginx handles the separate FastCGI connection to PHP.'], s => { s.scope = 'bereq'; s.headers['X-Varnish'] = '10001'; if (!passed) { s.method = 'GET'; s.headers['Accept-Encoding'] = 'gzip'; } }, { via: [[665, 145]] });
      add('php', 'php', 'origin', 'The application runs behind the origin.', 'The example web server dispatches a request to PHP-FPM. Magento renders a page or produces application data.', [change('Processing', null, 'PHP / Magento')], ['FastCGI parameters are not HTTP headers.', 'The diagram contains no production upstream definition or PHP-FPM address.'], s => { s.scope = 'FastCGI'; s.attrs = { 'Example application': 'Magento', 'Dispatch protocol': 'FastCGI' }; });
      add('origin-response', 'response', 'response', 'The response carries its own cache policy.', 'The illustrative origin supplies a status, headers, and a body stream. An initial TTL has been calculated before the response policy runs.', [change('Status', null, status), change('Cache-Control', null, control), change('Set-Cookie', null, origin['Set-Cookie'])], ['These are deliberately fictional response values.'], s => { s.scope = 'beresp'; s.status = status; s.headers = copy(origin); s.attrs = { 'beresp.ttl': `${initialTTL}s`, 'beresp.uncacheable': passed }; }, { via: [[665, 355], [860, 355]] });
      add('text', 'response', 'response', 'Text processing and freshness are separate settings.', 'The sample policy enables text processing for HTML and assigns an illustrative stale-serving allowance. A debug copy keeps the origin’s cache policy visible.', [change('Example grace', null, GRACE_LABEL), change('ESI processing', false, /text/.test(contentType)), change('Gzip processing', false, /text/.test(contentType))], ['Enabling ESI does not mean a body contains ESI includes.', 'Grace starts after freshness ends.'], s => { Object.assign(s.attrs, { 'beresp.grace': '1800s', 'beresp.do_esi': /text/.test(contentType), 'beresp.do_gzip': /text/.test(contentType) }); s.headers['X-Magento-Cache-Control'] = control; });
      add('status', 'response', 'response', decision.early ? 'An early decision skips later checks.' : 'Check status and privacy first.', 'This teaching policy accepts 200/404 candidates and treats private responses as uncacheable. An early return means later cookie processing is not reached.', [change('Status accepted', null, [200, 404].includes(status)), change('Private policy', null, /private/i.test(control))], ['Response policy is configurable; this example demonstrates ordering rather than a universal Varnish rule.'], s => { if (decision.early) { s.attrs['beresp.ttl'] = `${decision.ttl}s`; s.attrs['beresp.uncacheable'] = true; } });
      if (!decision.early) {
        add('set-cookie', 'response', 'response', decision.cookieRemoved ? 'The example response cookie is detached.' : 'The response cookie stays on board.', 'After the earlier gates, this illustrative policy removes Set-Cookie for positive-TTL GET/HEAD responses. It is a separate operation from preserving request cookies.', [change('Set-Cookie', origin['Set-Cookie'], decision.cookieRemoved ? undefined : origin['Set-Cookie'])], ['Cookie travels toward the application; Set-Cookie travels toward the browser.', 'This example deliberately places cookie processing before the final cacheability gate.'], s => { if (decision.cookieRemoved) delete s.headers['Set-Cookie']; });
        add('cacheability', 'response', 'response', decision.cacheable ? 'The example final checks pass.' : 'A final check marks the response uncacheable.', 'TTL, surrogate policy, ordinary cache policy, and Vary can affect reuse. A passed transaction remains uncacheable.', [change('TTL <= 0', null, initialTTL <= 0), change('Cache policy blocks storage', null, /no-cache|no-store/i.test(control)), change('Reusable response', null, decision.cacheable)], ['Hit-for-miss metadata is distinct from a reusable cached body.', 'Surrogate and ordinary Cache-Control policies can have different precedence.'], s => { s.attrs['beresp.ttl'] = `${decision.ttl}s`; s.attrs['beresp.uncacheable'] = !decision.cacheable; });
      }
      add('storage', decision.cacheable ? 'cache' : 'response', 'response', decision.cacheable ? 'Store a reusable object.' : passed ? 'Deliver without a reusable cache entry.' : 'Keep metadata separate from reusable content.', decision.cacheable ? 'The object retains its own headers and freshness information. Storage and streaming delivery may overlap.' : 'Uncacheable content can still be delivered. A miss may retain short-lived metadata, while a passed transaction does not store a reusable page.', [change('Reusable body', null, decision.cacheable ? 'Stored' : 'Not stored'), change('Example TTL', null, `${decision.ttl}s`)], ['Later delivery-header changes affect the outgoing response, not the stored object.'], s => { s.cache = decision.cacheable ? 'Stored · TTL 3600s / grace 1800s' : passed ? 'PASS · no object' : decision.ttl > 0 ? `Hit-for-miss · ${decision.ttl}s` : 'Uncacheable · TTL 0'; });
    } else { state.headers = { ...origin, 'X-Magento-Cache-Control': control }; delete state.headers['Set-Cookie']; state.status = status; state.attrs = { 'obj.ttl': key === 'grace' ? '-120s' : '3576s', 'obj.grace': '1800s' }; }
    const age = key === 'grace' ? '3720' : key === 'hit' ? '24' : '0';
    state.scope = 'resp';
    Object.assign(state.headers, { Age: age, 'X-Varnish': 'example-transaction', Via: 'example-cache' });
    const from = stages.at(-1).station;
    add('debug', 'deliver', 'deliver', 'Add illustrative cache diagnostics.', 'An example debug policy exposes cache age and the simulated outcome. These diagnostic headers are optional application choices.', [change('X-Cache-Age', null, age), change('X-Magento-Cache-Debug', null, passed ? 'PASS' : isHit ? 'HIT' : 'MISS')], ['Debug labels in this simulator come from the scenario state, not a private header-detection rule.'], s => { s.headers['X-Cache-Age'] = age; s.headers['X-Magento-Cache-Debug'] = passed ? 'PASS' : isHit ? 'HIT' : 'MISS'; if (isHit) s.headers.Grace = graceLabel; }, { via: from === 'cache' ? [[940, 145], [940, 430], [270, 430]] : [[940, 290], [940, 430], [270, 430]] });
    add('tags', 'deliver', 'deliver', 'Keep internal tags on the stored object.', 'The example removes internal application metadata from the outgoing response. The cache object retains its own tag metadata for invalidation.', [change('X-Magento-Tags', state.headers['X-Magento-Tags'], undefined), change('X-Magento-Route', state.headers['X-Magento-Route'], undefined)], ['Object headers and client response headers are separate.'], s => { delete s.headers['X-Magento-Tags']; delete s.headers['X-Magento-Route']; });
    add('browser-policy', 'deliver', 'deliver', 'The browser receives its own caching instructions.', 'This example preserves private policies and otherwise sends a browser-facing no-store policy. That does not change an already-stored object’s TTL.', [change('Cache-Control', control, isPrivate ? control : 'no-store')], ['Browser caching and reverse-proxy caching are separate decisions.'], s => { if (!isPrivate) s.headers['Cache-Control'] = 'no-store'; }, { visual: 'policy' });
    add('strip', 'deliver', 'deliver', 'Remove example diagnostic headers.', 'A final illustrative cleanup removes server-identification and cache-debug fields. Browser policy headers remain intact in this demo.', removedHeaders.map(h => change(h, state.headers[h], undefined)), ['This short teaching list is not a production removal list.', 'Security response headers are preserved by this example.'], s => removedHeaders.forEach(h => delete s.headers[h]));
    add('edge-return', 'edge', 'arrival', 'The edge finishes the return journey.', 'The example edge removes its origin-debug field and sends the response over HTTPS. It leaves the response’s Vary policy intact.', [change('X-Origin-Debug', state.headers['X-Origin-Debug'], undefined)], ['Each proxy layer can have its own header policy.'], s => { delete s.headers['X-Origin-Debug']; });
    add('arrive', 'client', 'arrival', 'Every decision has left a trace.', 'The browser receives the sample response. Compare another service to see how different inputs change the same conceptual journey.', [change('Status', null, status), change('Cache state', null, state.cache), change('Browser policy', null, state.headers['Cache-Control'])], ['All values and policies are illustrative. No private configuration is part of this public site.']);
    return { ...config, key, stages, route };
  }
  window.JourneyModel = { build, scenarios, stations, groups, stripMarketing, marketingAnalysis, collectCookies, encoding, classify, varyValue, hashParts, responseDecision, pathPatterns, tracked, removedHeaders, RAW_URL, COOKIE, GRACE_LABEL };
})();
