(() => {
  'use strict';
  const M = window.JourneyModel;
  const $ = id => document.getElementById(id);
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const enhanced = Boolean(window.gsap && window.ScrollTrigger);
  const journey = $('journey');
  const board = journey.querySelector('.journey-board');
  let trip = M.build('miss');
  let current = -1;
  let progress = 0;
  let start = 0;
  let distance = 1;
  let segments = [];
  let tween;
  let renderFrame = 0;
  let resizeTimer;
  let playing = false;
  let playFrame;
  let playY = 0;
  let playTime = 0;
  let snapshotView = 'after';
  let detailView = 'changes';
  if (enhanced) gsap.registerPlugin(ScrollTrigger);

  const short = { departure: 'Client', edge: 'Nginx', entry: 'Entry', control: 'Special', method: 'Method', normalize: 'URL', cookies: 'Cookies', paths: 'Bypass', encoding: 'Encoding', marketing: 'Tracking', auth: 'Auth', vary: 'Vary', hash: 'Key', lookup: 'Lookup', expired: 'Expired', pass: 'PASS', backend: 'Fetch', php: 'PHP', 'origin-response': 'Origin', text: 'ESI / gzip', status: 'Status', 'set-cookie': 'Set-Cookie', cacheability: 'Policy', storage: 'Store', debug: 'Debug', tags: 'Tags', 'browser-policy': 'Browser', strip: 'Strip', 'edge-return': 'Nginx', arrive: 'Client', synth: 'SYNTH', pipe: 'PIPE' };
  const mapNames = {
    client: ['Browser'], edge: ['Public', 'Nginx'], receive: ['Receive'],
    hash: ['Hash', 'junction'], cache: ['Object', 'cache'],
    backend: ['Backend', 'Nginx'], php: ['PHP /', 'Magento'],
    response: ['Response', 'check'], deliver: ['Delivery']
  };
  const mapPorts = { client: 'Client', edge: 'TLS · :443', receive: ':6081', hash: 'vcl_hash', cache: 'HIT / MISS', backend: ':8080', php: 'FastCGI', response: 'beresp', deliver: 'resp' };

  function sizeMapLabels() {
    const svg = $('rail-map');
    const scale = svg.getScreenCTM()?.a;
    if (!scale) return;
    const rootScale = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
    const compact = innerWidth <= 640;
    const labelSize = (compact ? 14 : 15) * rootScale;
    const lineHeight = labelSize * 1.2;
    // SVG text otherwise shrinks with the entire 1000-unit diagram. Keep its
    // rendered size in CSS pixels, and wrap station names into short lines.
    svg.style.setProperty('--map-name-size', `${labelSize / scale}px`);
    svg.style.setProperty('--map-port-size', `${12 * rootScale / scale}px`);
    svg.style.setProperty('--map-caption-size', `${11 * rootScale / scale}px`);
    svg.classList.toggle('compact-labels', compact || scale < .58);
    $('zone-name').textContent = scale < .7 ? 'VARNISH CACHE' : 'VARNISH · THE CACHE CONTROL ZONE';
    document.querySelectorAll('.station-node').forEach(node => {
      const lines = mapNames[node.dataset.station];
      if (node.dataset.station === 'backend') node.querySelector('.station-name tspan').textContent = scale < .4 ? 'Origin' : 'Backend';
      const above = M.stations[node.dataset.station].y === 355 && scale >= .58;
      const baseline = above ? -(lines.length - 1) * lineHeight - 34 * rootScale : 22 * rootScale;
      node.querySelector('.station-name').setAttribute('y', baseline / scale);
      node.querySelector('.station-port').setAttribute('y', above ? -16 * rootScale / scale : (baseline + (lines.length - 1) * lineHeight + 18 * rootScale) / scale);
    });
  }
  function hook(s) {
    if (s.id === 'php') return 'NGINX / FASTCGI';
    if (s.id === 'backend') return 'vcl_backend_fetch';
    if (s.id === 'storage') return 'VARNISH CORE';
    if (s.id === 'expired' || (s.id === 'lookup' && ['hit', 'grace'].includes(trip.key))) return 'vcl_hit';
    if (s.id === 'pass') return 'vcl_pass';
    if (s.id === 'pipe') return 'vcl_pipe';
    if (s.id === 'synth') return 'vcl_synth';
    return { departure: s.id === 'edge' ? 'PUBLIC NGINX' : 'CLIENT', receive: 'vcl_recv', hash: 'vcl_hash', lookup: 'vcl_miss', origin: 'ORIGIN', response: 'vcl_backend_response', deliver: 'vcl_deliver', arrival: s.id === 'edge-return' ? 'PUBLIC NGINX' : 'CLIENT' }[s.group];
  }
  function changeHTML(c) {
    const labels = { keep: 'KEPT', remove: 'REMOVED', change: 'CHANGED', add: 'ADDED' };
    const long = c.before.length > 58 || c.after.length > 58;
    return `<article class="change-card ${c.action === 'remove' ? 'is-removed' : ''} ${long ? 'long-value' : ''}"><div class="change-heading"><h4>${escape(c.name)}</h4><span class="change-badge ${c.action}">${labels[c.action]}</span></div><div class="change-values"><div class="change-value"><span>BEFORE</span><code>${escape(c.before)}</code></div><i aria-hidden="true">→</i><div class="change-value after"><span>AFTER</span><code>${escape(c.after)}</code></div></div>${c.reason ? `<p>${escape(c.reason)}</p>` : ''}</article>`;
  }
  function keyHTML(parts) {
    return `<div class="key-list">${parts.map((p, i) => `<div class="key-ingredient ${p.source === 'BUILT-IN' ? 'built-in' : ''}"><span>${pad(i + 1)}</span><div><b>${escape(p.name)}</b><code>${escape(p.value)}</code></div><small>${p.source}</small></div>`).join('')}</div><p class="key-caption">Ordered hash inputs, not a fabricated hash digest. Each input contributes to the lookup key.</p>`;
  }
  function parameterHTML(parameters) {
    const n = parameters.filter(p => p.removed).length;
    const altered = parameters.filter(p => p.changed).length;
    return `<div class="parameter-summary"><span>${n} STRIPPED</span>${altered ? `<span>${altered} ALTERED</span>` : ''}<span>${parameters.length - n - altered} RETAINED</span></div><div class="parameter-list">${parameters.map(p => `<div class="parameter-row ${p.removed ? 'removed' : p.changed ? 'altered' : ''}"><span>${escape(p.name)}=${escape(p.value)}</span><b>${p.removed ? '− REMOVED' : p.changed ? '~ PARTIAL MATCH' : '✓ KEPT'}</b></div>`).join('')}</div>`;
  }
  function manifest() {
    const s = trip.stages[current];
    const snapshot = s[snapshotView];
    const entries = { ...(snapshot.status !== null ? { 'Response status': snapshot.status } : { Method: snapshot.method }), URL: snapshot.url, ...snapshot.headers };
    $('manifest-label').textContent = `${snapshot.scope.toUpperCase()} · ${snapshotView.toUpperCase()} THIS STOP`;
    const rows = items => Object.entries(items).map(([name, value]) => `<div class="manifest-row"><dt>${escape(name)}</dt><dd>${escape(value)}</dd></div>`).join('');
    $('manifest').innerHTML = `<div class="manifest-section-title">RELEVANT ${snapshot.status !== null ? 'RESPONSE' : 'REQUEST'} FIELDS</div>${rows(entries)}${Object.keys(snapshot.attrs).length ? `<div class="manifest-section-title">${snapshot.scope === 'FastCGI' ? 'FASTCGI PARAMETERS' : 'PROCESSING ATTRIBUTES'}</div>${rows(snapshot.attrs)}` : ''}`;
  }
  function cargo(s) {
    const state = s.after;
    $('packet-scope').textContent = state.scope;
    $('packet-method').textContent = state.status ?? state.method;
    $('packet-url').textContent = state.status !== null ? `${state.status === 200 ? 'OK' : 'Origin error'} · ${state.headers['Content-Type'] || 'response'}` : state.url;
    $('cache-state').textContent = state.cache;
    let chips;
    if (s.visual === 'parameters') chips = s.parameters.map(p => ({ label: p.name, status: p.removed ? 'removed' : 'retained' }));
    else if (state.status !== null) chips = [{ label: `TTL: ${state.attrs['beresp.ttl'] || state.attrs['obj.ttl'] || 'see policy'}`, status: '' }, { label: state.headers['Set-Cookie'] ? 'Set-Cookie on board' : 'No Set-Cookie', status: '' }, { label: state.headers['Cache-Control']?.includes('no-store') ? 'no-store' : 'cache candidate', status: '' }];
    else chips = (state.headers.Cookie || '').split('; ').filter(Boolean).map(p => ({ label: p.split('=')[0], status: s.visual === 'cookies' ? 'retained' : '' }));
    $('cargo-chips').innerHTML = chips.map(c => `<span class="cargo-chip ${c.status}">${escape(c.label)}</span>`).join('');
  }
  function renderStop(index) {
    if (current === index) return;
    current = index;
    const s = trip.stages[index];
    $('station-number').textContent = `STATION ${pad(index + 1)} / ${trip.stages.length}`;
    $('hook-name').textContent = hook(s);
    $('station-title').textContent = s.title;
    $('station-description').textContent = s.description;
    $('change-count').textContent = s.changes.length || (s.keyParts?.length ?? '·');
    let visual = '';
    if (s.visual === 'parameters') visual = parameterHTML(s.parameters);
    if (s.visual === 'key') visual = keyHTML(s.keyParts);
    if (s.visual === 'ttl') visual = `<div class="ttl-cards"><div><span>REMAINING TTL</span><b>${s.ttl}s</b></div><div><span>EXAMPLE GRACE</span><b>${escape(M.GRACE_LABEL)}</b></div></div>`;
    if (s.visual === 'policy') visual = `<div class="policy-cards"><div><span>VARNISH OBJECT</span><b>${escape(s.after.cache)}</b></div><div><span>BROWSER RESPONSE</span><b>${escape(s.after.headers['Cache-Control'])}</b></div></div>`;
    $('change-visual').innerHTML = visual;
    $('changes-list').innerHTML = s.changes.map(changeHTML).join('');
    $('station-facts').innerHTML = s.facts.map(f => `<li>${escape(f)}</li>`).join('');
    manifest();
    cargo(s);
    for (const panel of document.querySelectorAll('.inspector-body')) panel.scrollTop = 0;
    $('stop-counter').textContent = `${pad(index + 1)} / ${trip.stages.length} stops`;
    $('station-progress').value = index;
    $('station-progress').setAttribute('aria-valuetext', `${index + 1}: ${s.title}`);
    $('previous').disabled = index === 0;
    $('next').disabled = index === trip.stages.length - 1;
    $('next-station-hint').textContent = index === trip.stages.length - 1 ? 'END OF THE LINE' : `NEXT: ${short[trip.stages[index + 1].id.replace('-retry', '')] || M.stations[trip.stages[index + 1].station].name}`.toUpperCase();
    document.querySelectorAll('[data-group]').forEach(button => {
      button.classList.toggle('active', button.dataset.group === s.group);
      if (button.dataset.group === s.group) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    const local = trip.stages.map((step, i) => ({ ...step, index: i })).filter(step => step.group === s.group);
    $('platform-name').textContent = `${M.groups[s.group].toUpperCase()} PLATFORM`;
    $('platform-count').textContent = `${pad(local.findIndex(step => step.index === index) + 1)} / ${pad(local.length)}`;
    $('local-stops').innerHTML = local.map(step => `<button class="local-stop${step.index === index ? ' active' : ''}" data-index="${step.index}" title="${escape(step.title)}" aria-label="Stop ${step.index + 1}: ${escape(step.title)}" ${step.index === index ? 'aria-current="step"' : ''}>${escape(short[step.id.replace('-retry', '')] || step.id)}</button>`).join('');
    const activeLocal = $('local-stops').querySelector('.active');
    if (activeLocal) $('local-stops').scrollLeft = activeLocal.offsetLeft - $('local-stops').offsetLeft - 60;
    const activeGroup = $('group-nav').querySelector('.active');
    if (activeGroup) $('group-nav').scrollLeft = activeGroup.offsetLeft - $('group-nav').offsetLeft - 50;
    const visited = new Set(trip.stages.slice(0, index).map(step => step.station));
    document.querySelectorAll('.station-node').forEach(node => {
      node.classList.toggle('active', node.dataset.station === s.station);
      node.classList.toggle('passed', visited.has(node.dataset.station));
    });
    $('request-train').classList.toggle('response-train', s.after.status !== null);
    $('train-label').textContent = s.after.scope === 'tunnel' ? 'PIPE' : s.after.status ?? s.after.method;
    $('background-track').classList.toggle('visible', trip.key === 'grace' && index >= trip.stages.findIndex(step => step.id === 'lookup'));
    $('map-description').textContent = `${trip.label}. Stop ${index + 1}: ${s.title} ${s.description}`;
    $('announcement').textContent = `Stop ${index + 1} of ${trip.stages.length}. ${s.title}`;
    if (enhanced && !reduced.matches) gsap.fromTo('#changes-list .change-card, #change-visual > *', { opacity: .4, y: 5 }, { opacity: 1, y: 0, duration: .35, stagger: .035, overwrite: true });
  }
  function makeSegments() {
    segments = trip.stages.slice(0, -1).map((s, i) => {
      const target = trip.stages[i + 1];
      const a = M.stations[s.station];
      const b = M.stations[target.station];
      const coordinates = [[a.x, a.y], ...(target.via || []), [b.x, b.y]];
      const d = coordinates.map((p, j) => `${j ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      return { path, d, length: path.getTotalLength() };
    });
  }
  function render(value) {
    progress = clamp(value);
    const position = progress * (trip.stages.length - 1);
    const index = Math.min(trip.stages.length - 1, Math.floor(position + .5));
    renderStop(index);
    const segmentIndex = Math.min(segments.length - 1, Math.floor(position));
    const segment = segments[segmentIndex];
    const fraction = progress >= 1 ? 1 : position - segmentIndex;
    const station = M.stations[trip.stages[index].station];
    const p = !reduced.matches && segment.length ? segment.path.getPointAtLength(segment.length * fraction) : station;
    $('request-train').setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
    $('active-track').setAttribute('d', segment.d);
    $('active-track').style.stroke = trip.stages[index].after.status !== null ? 'var(--blue)' : 'var(--lime)';
    $('active-track').style.strokeDasharray = `${segment.length} ${segment.length}`;
    $('active-track').style.strokeDashoffset = segment.length * (1 - fraction);
    $('scroll-progress-fill').style.transform = `scaleX(${progress})`;
  }
  function measure() {
    start = journey.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(board).top) || 0);
    distance = (trip.stages.length - 1) * Math.max(200, innerHeight * .34);
    journey.style.height = `${Math.ceil(board.offsetHeight + distance)}px`;
    sizeMapLabels();
  }
  function setupTimeline() {
    if (tween) { tween.scrollTrigger.kill(); tween.kill(); tween = null; }
    measure();
    if (enhanced) {
      const clock = { progress: 0 };
      tween = gsap.fromTo(clock, { progress: 0 }, { progress: 1, ease: 'none', onUpdate: () => render(clock.progress), scrollTrigger: { trigger: journey, start: () => start, end: () => start + distance, scrub: reduced.matches ? true : .28, invalidateOnRefresh: true } });
      ScrollTrigger.refresh();
    }
    render((scrollY - start) / distance);
  }
  function go(index, smooth = true) {
    stop();
    const i = clamp(index, 0, trip.stages.length - 1);
    scrollTo({ top: Math.max(0, start + i / (trip.stages.length - 1) * distance), behavior: smooth && !reduced.matches ? 'smooth' : 'instant' });
    if (!smooth || reduced.matches) {
      if (tween) {
        ScrollTrigger.update();
        const scrubTween = tween.scrollTrigger.getTween();
        if (scrubTween && typeof scrubTween.progress === 'function') scrubTween.progress(1);
      }
      render(i / (trip.stages.length - 1));
    }
  }
  function stationList(query = '') {
    let lastGroup = '';
    $('station-list').innerHTML = trip.stages.map((s, i) => ({ ...s, index: i })).filter(s => `${s.title} ${s.description} ${s.id} ${hook(s)}`.toLowerCase().includes(query.toLowerCase())).map(s => {
      const title = lastGroup === s.group ? '' : `<h3 class="station-list-group">${M.groups[s.group].toUpperCase()}</h3>`;
      lastGroup = s.group;
      return `${title}<button class="station-list-button${s.index === current ? ' current' : ''}" data-index="${s.index}"><span>${pad(s.index + 1)}</span><b>${escape(s.title)}</b><i aria-hidden="true">↗</i></button>`;
    }).join('') || '<p class="station-list-group">No matching station on this service.</p>';
  }
  function selectScenario(key, move = true) {
    stop();
    if (move) scrollTo({ top: Math.max(0, start), behavior: 'instant' });
    trip = M.build(key);
    current = -1;
    $('scenario-select').value = key;
    $('line-name').textContent = trip.line;
    $('service-badge').textContent = trip.badge;
    $('service-badge').title = trip.subtitle;
    $('station-progress').max = trip.stages.length - 1;
    $('group-nav').innerHTML = Object.entries(M.groups).map(([key, name], i) => `<button data-group="${key}" ${trip.stages.some(s => s.group === key) ? '' : 'disabled'}><span>${pad(i + 1)}</span>${name}</button>`).join('');
    document.querySelectorAll('.station-node').forEach(node => {
      const used = trip.stages.some(s => s.station === node.dataset.station);
      node.classList.toggle('unused', !used);
      node.setAttribute('tabindex', used ? '0' : '-1');
      node.setAttribute('aria-disabled', String(!used));
    });
    makeSegments();
    setupTimeline();
    if (move) go(0, false);
  }
  function stop() {
    playing = false;
    cancelAnimationFrame(playFrame);
    $('play').setAttribute('aria-pressed', 'false');
    $('play').setAttribute('aria-label', 'Play journey');
    $('play-icon').textContent = '▶';
    $('play-label').textContent = 'Auto ride';
  }
  function tick(time) {
    if (!playing) return;
    playY += Math.min(time - playTime, 80) * (distance / (trip.stages.length - 1)) / 3800 * Number($('speed').value);
    playTime = time;
    scrollTo({ top: Math.min(playY, start + distance), behavior: 'instant' });
    if (playY >= start + distance) { stop(); render(1); }
    else playFrame = requestAnimationFrame(tick);
  }
  function play() {
    if (current === trip.stages.length - 1) go(0, false);
    playing = true;
    playY = clamp(scrollY, start, start + distance);
    playTime = performance.now();
    $('play').setAttribute('aria-pressed', 'true');
    $('play').setAttribute('aria-label', 'Pause journey');
    $('play-icon').textContent = 'Ⅱ';
    $('play-label').textContent = 'Pause';
    playFrame = requestAnimationFrame(tick);
  }
  function setView(view) {
    detailView = view;
    document.querySelectorAll('[data-view]').forEach(b => {
      const active = b.dataset.view === view;
      b.setAttribute('aria-selected', active); b.tabIndex = active ? 0 : -1;
      $(`panel-${b.dataset.view}`).hidden = !active;
    });
  }
  // Keyboard behavior shared by the inspector and rule-workbench tab groups.
  document.querySelectorAll('[role="tablist"]').forEach(list => list.addEventListener('keydown', event => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const i = tabs.indexOf(document.activeElement);
    let target;
    if (i < 0) return;
    if (event.key === 'ArrowRight') target = (i + 1) % tabs.length;
    if (event.key === 'ArrowLeft') target = (i + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = tabs.length - 1;
    if (target === undefined) return;
    event.preventDefault(); tabs[target].focus({ preventScroll: true }); tabs[target].click();
  }));
  $('scenario-select').innerHTML = [...new Set(Object.values(M.scenarios).map(s => s.group))].map(group => `<optgroup label="${group}">${Object.entries(M.scenarios).filter(([, s]) => s.group === group).map(([key, s]) => `<option value="${key}">${escape(s.label)}</option>`).join('')}</optgroup>`).join('');
  $('map-stations').innerHTML = Object.entries(M.stations).map(([id, s]) => `<g class="station-node" data-station="${id}" transform="translate(${s.x} ${s.y})" role="button" tabindex="0" aria-label="Jump to ${s.name}, ${s.port}"><title>${escape(s.name)} · ${escape(s.port)}</title><circle class="station-ring" r="11"/><circle class="station-center" r="4"/><text class="station-name" y="37">${mapNames[id].map((line, i) => `<tspan x="0" dy="${i ? '1.2em' : '0'}">${escape(line)}</tspan>`).join('')}</text><text class="station-port" y="75">${escape(mapPorts[id])}</text></g>`).join('');
  $('scenario-select').addEventListener('change', e => selectScenario(e.target.value));
  $('group-nav').addEventListener('click', e => { const button = e.target.closest('[data-group]'); if (button && !button.disabled) go(trip.stages.findIndex(s => s.group === button.dataset.group)); });
  $('local-stops').addEventListener('click', e => { const button = e.target.closest('[data-index]'); if (button) go(Number(button.dataset.index)); });
  $('map-stations').addEventListener('click', e => { const node = e.target.closest('[data-station]'); if (node && node.getAttribute('aria-disabled') !== 'true') go(trip.stages.findIndex(s => s.station === node.dataset.station)); });
  $('map-stations').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { stop(); setView(b.dataset.view); }));
  document.querySelectorAll('[data-snapshot]').forEach(b => b.addEventListener('click', () => { snapshotView = b.dataset.snapshot; document.querySelectorAll('[data-snapshot]').forEach(button => button.setAttribute('aria-pressed', String(button === b))); manifest(); }));
  $('station-progress').addEventListener('input', e => go(Number(e.target.value), false));
  $('previous').addEventListener('click', () => go(current - 1));
  $('next').addEventListener('click', () => go(current + 1));
  $('restart').addEventListener('click', () => go(0));
  $('play').addEventListener('click', () => playing ? stop() : play());
  $('open-stations').addEventListener('click', () => { stop(); $('station-search').value = ''; stationList(); $('stations-dialog').showModal(); });
  $('station-search').addEventListener('input', e => stationList(e.target.value));
  $('station-list').addEventListener('click', e => { const button = e.target.closest('[data-index]'); if (button) { $('stations-dialog').close(); go(Number(button.dataset.index)); } });
  document.querySelectorAll('[data-close-dialog]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); dialog.close(); } }, true);
  });
  document.querySelectorAll('[data-jump]').forEach(button => button.addEventListener('click', () => {
    if (!trip.stages.some(s => s.id === button.dataset.jump)) selectScenario('miss');
    go(trip.stages.findIndex(s => s.id === button.dataset.jump));
    setView('changes');
  }));
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    stop();
    if (link.getAttribute('href') === '#journey') { event.preventDefault(); go(0); history.replaceState(null, '', '#journey'); }
  }));
  window.addEventListener('wheel', stop, { passive: true });
  window.addEventListener('touchstart', e => { if (!e.target.closest('#play')) stop(); }, { passive: true });
  window.addEventListener('keydown', e => { if (e.key === ' ' && e.target.closest('#play')) return; if (['Escape', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End', ' '].includes(e.key)) stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  if (!enhanced) window.addEventListener('scroll', () => { if (!renderFrame) renderFrame = requestAnimationFrame(() => { render((scrollY - start) / distance); renderFrame = 0; }); }, { passive: true });
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const inside = scrollY >= start && scrollY <= start + distance;
      const saved = progress;
      stop(); setupTimeline();
      if (inside) { scrollTo({ top: start + saved * distance, behavior: 'instant' }); render(saved); }
    }, 170);
  });
  reduced.addEventListener('change', () => { stop(); setupTimeline(); });
  selectScenario('miss', false);
  if ('ResizeObserver' in window) new ResizeObserver(sizeMapLabels).observe($('rail-map'));
  if (enhanced && !reduced.matches) gsap.from('.hero-copy > *', { y: 13, opacity: 0, duration: .7, stagger: .065, ease: 'power2.out' });
  if (document.fonts) document.fonts.ready.then(() => { setupTimeline(); if (location.hash === '#journey') go(0, false); });
  window.RailUI = { escape, keyHTML, parameterHTML, stop };
})();
