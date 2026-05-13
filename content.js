// CourseTracker AI - Content Script
// Injects checkboxes beside each lecture and renders a floating progress bar.

(function () {
  const ATTR = 'data-ct-injected';
  const SIDEBAR_ID = 'ct-sidebar';
  const HANDLE_ID = 'ct-handle';
  const BAR_ID = 'ct-progress-bar';

  let currentUrl = location.href;
  let scanDebounce = null;
  let observer = null;
  let urlInterval = null;
  let dead = false;

  function isAlive() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id); }
    catch (_) { return false; }
  }

  function teardown() {
    if (dead) return;
    dead = true;
    if (observer) { try { observer.disconnect(); } catch (_) {} observer = null; }
    if (urlInterval) { clearInterval(urlInterval); urlInterval = null; }
    document.querySelectorAll('.ct-check').forEach((el) => el.remove());
    document.querySelectorAll(`[${ATTR}="1"]`).forEach((n) => {
      n.removeAttribute(ATTR);
      n.classList.remove('ct-tracked', 'ct-done');
    });
    const sb = document.getElementById(SIDEBAR_ID);
    if (sb) sb.remove();
    const h = document.getElementById(HANDLE_ID);
    if (h) h.remove();
  }

  function debounce(fn, ms) {
    return function (...args) {
      clearTimeout(scanDebounce);
      scanDebounce = setTimeout(() => fn(...args), ms);
    };
  }

  async function applyTheme() {
    const settings = await CTStorage.getSettings();
    const root = document.documentElement;
    let theme = settings.theme;
    if (theme === 'auto') {
      theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    root.setAttribute('data-ct-theme', theme);
  }

  function clearInjected() {
    document.querySelectorAll('.ct-check').forEach((el) => el.remove());
    document.querySelectorAll(`[${ATTR}="1"]`).forEach((n) => {
      n.removeAttribute(ATTR);
      n.classList.remove('ct-tracked', 'ct-done');
    });
  }

  function injectCheckbox(item, course) {
    if (!item.node || item.node.getAttribute(ATTR) === '1') return;
    const state = course.lectures[item.id];
    const done = !!state?.done;

    const box = document.createElement('label');
    box.className = 'ct-check';
    box.title = 'Mark as completed';
    box.innerHTML = `
      <input type="checkbox" ${done ? 'checked' : ''} />
      <span class="ct-check-box"></span>
    `;
    const input = box.querySelector('input');
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('change', async (e) => {
      await CTStorage.setLectureState(currentUrl, item.id, {
        done: e.target.checked,
        title: item.title,
        index: item.index,
        duration: item.duration
      });
      item.node.classList.toggle('ct-done', e.target.checked);
      await renderProgress();
    });

    item.node.classList.add('ct-tracked');
    if (done) item.node.classList.add('ct-done');
    item.node.setAttribute(ATTR, '1');

    try {
      item.node.prepend(box);
    } catch (_) {
      item.node.insertBefore(box, item.node.firstChild);
    }
  }

  function ensureSidebar() {
    let el = document.getElementById(SIDEBAR_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = SIDEBAR_ID;
    el.className = 'ct-sidebar';
    el.innerHTML = `
      <div class="ct-sidebar-head">
        <div class="ct-brand">
          <span class="ct-dot"></span>
          <span>CourseTracker AI</span>
        </div>
        <div class="ct-head-actions">
          <button class="ct-icon-btn" id="ct-stop" title="Stop tracking">⏸</button>
          <button class="ct-icon-btn" id="ct-hide" title="Hide sidebar">✕</button>
          <button class="ct-icon-btn" id="ct-collapse" title="Collapse">–</button>
        </div>
      </div>
      <div id="${BAR_ID}" class="ct-progress">
        <div class="ct-progress-meta">
          <span class="ct-progress-label">Progress: 0 / 0 (0%)</span>
          <span class="ct-progress-pct">0%</span>
        </div>
        <div class="ct-progress-track"><div class="ct-progress-fill" style="width:0%"></div></div>
        <div class="ct-duration" hidden>
          <span class="ct-dur-icon">⏱</span>
          <span class="ct-dur-watched">0m</span>
          <span class="ct-dur-sep">/</span>
          <span class="ct-dur-total">0m</span>
          <span class="ct-dur-remaining"></span>
        </div>
      </div>
      <div class="ct-stopped-msg">Tracking paused. Click ▶ to resume.</div>
      <div class="ct-sidebar-foot">
        <button class="ct-btn" id="ct-rescan">Rescan</button>
        <button class="ct-btn ct-btn-ghost" id="ct-toggle-theme">Theme</button>
      </div>
    `;
    document.body.appendChild(el);

    el.querySelector('#ct-collapse').addEventListener('click', () => {
      el.classList.toggle('ct-collapsed');
    });
    el.querySelector('#ct-hide').addEventListener('click', async () => {
      await CTStorage.setSettings({ hidden: true });
      applyVisibility();
    });
    el.querySelector('#ct-stop').addEventListener('click', async () => {
      const settings = await CTStorage.getSettings();
      const next = !settings.enabled;
      await CTStorage.setSettings({ enabled: next });
      applyEnabled(next);
      if (next) runScan(true);
    });
    el.querySelector('#ct-rescan').addEventListener('click', () => runScan(true));
    el.querySelector('#ct-toggle-theme').addEventListener('click', async () => {
      const settings = await CTStorage.getSettings();
      const next = settings.theme === 'dark' ? 'light' : settings.theme === 'light' ? 'auto' : 'dark';
      await CTStorage.setSettings({ theme: next });
      await applyTheme();
    });
    return el;
  }

  function ensureHandle() {
    let h = document.getElementById(HANDLE_ID);
    if (h) return h;
    h = document.createElement('button');
    h.id = HANDLE_ID;
    h.className = 'ct-handle';
    h.title = 'Show CourseTracker AI';
    h.innerHTML = '<span class="ct-dot"></span>';
    h.addEventListener('click', async () => {
      await CTStorage.setSettings({ hidden: false });
      applyVisibility();
      runScan(true);
    });
    document.body.appendChild(h);
    return h;
  }

  async function applyVisibility() {
    const settings = await CTStorage.getSettings();
    const sb = document.getElementById(SIDEBAR_ID);
    const handle = document.getElementById(HANDLE_ID);
    if (settings.hidden) {
      if (sb) sb.style.display = 'none';
      ensureHandle().style.display = 'flex';
    } else {
      if (sb) sb.style.display = '';
      if (handle) handle.style.display = 'none';
    }
  }

  function applyEnabled(enabled) {
    const sb = document.getElementById(SIDEBAR_ID);
    if (sb) {
      sb.classList.toggle('ct-stopped', !enabled);
      const stopBtn = sb.querySelector('#ct-stop');
      if (stopBtn) {
        stopBtn.textContent = enabled ? '⏸' : '▶';
        stopBtn.title = enabled ? 'Stop tracking' : 'Resume tracking';
      }
    }
    if (!enabled) {
      clearInjected();
      if (observer) { observer.disconnect(); observer = null; }
    } else {
      watchDom();
    }
  }

  async function renderProgress() {
    const course = await CTStorage.getCourse(currentUrl);
    const stats = CTProgress.calculate(course);
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;
    bar.querySelector('.ct-progress-label').textContent =
      `Progress: ${stats.completed} / ${stats.total} completed`;
    bar.querySelector('.ct-progress-pct').textContent = `${stats.pct}%`;
    const fill = bar.querySelector('.ct-progress-fill');
    fill.style.width = `${stats.pct}%`;
    fill.classList.toggle('ct-pulse', stats.pct === 100);

    const dur = bar.querySelector('.ct-duration');
    if (stats.hasDuration && stats.totalDuration > 0) {
      dur.hidden = false;
      dur.querySelector('.ct-dur-watched').textContent =
        CTProgress.formatDuration(stats.completedDuration);
      dur.querySelector('.ct-dur-total').textContent =
        CTProgress.formatDuration(stats.totalDuration);
      const remEl = dur.querySelector('.ct-dur-remaining');
      remEl.textContent = stats.remainingDuration > 0
        ? `· ${CTProgress.formatDuration(stats.remainingDuration)} left`
        : '· done!';
    } else {
      dur.hidden = true;
    }
  }

  async function runScan(force = false) {
    if (!isAlive()) { teardown(); return; }
    const settings = await CTStorage.getSettings();
    if (!settings.enabled) {
      ensureSidebar();
      applyEnabled(false);
      applyVisibility();
      return;
    }

    const { platform, items } = CTDomScanner.scan();
    if (!items.length) {
      if (force) {
        ensureSidebar();
        applyVisibility();
      }
      return;
    }
    if (!CTDomScanner.isLikelyCoursePage() && platform === 'generic') return;

    ensureSidebar();
    applyEnabled(true);
    applyVisibility();
    await CTStorage.bulkUpsertLectures(currentUrl, items);
    const course = await CTStorage.getCourse(currentUrl);
    for (const item of items) injectCheckbox(item, course);
    await renderProgress();
  }

  const debouncedScan = debounce(() => runScan(false), 400);

  function watchDom() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => debouncedScan());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function watchUrl() {
    let last = location.href;
    urlInterval = setInterval(() => {
      if (!isAlive()) { teardown(); return; }
      if (location.href !== last) {
        last = location.href;
        currentUrl = last;
        clearInjected();
        runScan(true);
      }
    }, 600);
    window.addEventListener('popstate', () => debouncedScan());
  }

  try {
    chrome.runtime?.onMessage?.addListener((msg) => {
      if (!isAlive()) { teardown(); return; }
      if (msg?.type === 'CT_REFRESH' || msg?.type === 'CT_URL_CHANGED') {
        currentUrl = location.href;
        runScan(true);
      }
    });

    chrome.storage?.onChanged?.addListener((changes, area) => {
      if (!isAlive()) { teardown(); return; }
      if (area !== 'local' || !changes.ct_settings) return;
      applyTheme();
      applyVisibility();
      const next = changes.ct_settings.newValue || {};
      applyEnabled(next.enabled !== false);
    });
  } catch (_) { /* extension context already gone */ }

  async function init() {
    await applyTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
    const settings = await CTStorage.getSettings();
    if (settings.enabled) watchDom();
    watchUrl();
    runScan(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
