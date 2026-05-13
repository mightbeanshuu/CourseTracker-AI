// CourseTracker AI - Popup logic

const $ = (sel) => document.querySelector(sel);

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
  });
}

function detectPlatformFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    if (host.includes('udemy.com')) return 'Udemy';
    if (host.includes('coursera.org')) return 'Coursera';
    if (host.includes('youtube.com')) return 'YouTube';
    if (host.includes('100xdevs.com') || host.includes('harkirat.classx.co.in')) return '100xDevs';
    return 'Generic';
  } catch (_) {
    return 'Generic';
  }
}

async function applyTheme() {
  const settings = await CTStorage.getSettings();
  let theme = settings.theme;
  if (theme === 'auto') {
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
}

async function refresh() {
  const tab = await getActiveTab();
  const url = tab?.url || '';
  $('#courseUrl').textContent = url ? new URL(url).hostname + new URL(url).pathname : '—';
  $('#platformPill').textContent = detectPlatformFromUrl(url);

  const course = await CTStorage.getCourse(url);
  const stats = CTProgress.calculate(course);
  $('#progressLabel').textContent = `Progress: ${stats.completed} / ${stats.total}`;
  $('#progressPct').textContent = `${stats.pct}%`;
  $('#progressFill').style.width = `${stats.pct}%`;
  $('#lectureCount').textContent = stats.total;

  const settings = await CTStorage.getSettings();
  $('#enabledToggle').checked = !!settings.enabled;
  $('#hiddenToggle').checked = !!settings.hidden;
  $('#stopBtn').textContent = settings.enabled ? 'Stop' : 'Resume';
  $('#hideBtn').textContent = settings.hidden ? 'Show' : 'Hide';

  const list = $('#lectureList');
  list.innerHTML = '';
  const entries = Object.entries(course.lectures || {})
    .sort((a, b) => (a[1].index ?? 0) - (b[1].index ?? 0));
  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'muted small';
    li.textContent = 'No lectures detected yet. Open a course page and click Rescan.';
    list.appendChild(li);
    return;
  }
  for (const [id, lec] of entries) {
    const li = document.createElement('li');
    li.className = lec.done ? 'done' : '';
    li.innerHTML = `
      <input type="checkbox" ${lec.done ? 'checked' : ''} />
      <span class="lec-title" title="${escapeHtml(lec.title)}">${escapeHtml(lec.title)}</span>
    `;
    li.querySelector('input').addEventListener('change', async (e) => {
      await CTStorage.setLectureState(url, id, { ...lec, done: e.target.checked });
      chrome.runtime.sendMessage({ type: 'CT_BROADCAST_UPDATE' });
      refresh();
    });
    list.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function download(filename, content) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', async () => {
  await applyTheme();
  await refresh();

  $('#themeBtn').addEventListener('click', async () => {
    const s = await CTStorage.getSettings();
    const next = s.theme === 'dark' ? 'light' : s.theme === 'light' ? 'auto' : 'dark';
    await CTStorage.setSettings({ theme: next });
    await applyTheme();
    chrome.runtime.sendMessage({ type: 'CT_BROADCAST_UPDATE' });
  });

  $('#rescanBtn').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'CT_REFRESH' }).catch(() => {});
    setTimeout(refresh, 500);
  });

  $('#enabledToggle').addEventListener('change', async (e) => {
    await CTStorage.setSettings({ enabled: e.target.checked });
    chrome.runtime.sendMessage({ type: 'CT_BROADCAST_UPDATE' });
    refresh();
  });

  $('#hiddenToggle').addEventListener('change', async (e) => {
    await CTStorage.setSettings({ hidden: e.target.checked });
    chrome.runtime.sendMessage({ type: 'CT_BROADCAST_UPDATE' });
    refresh();
  });

  $('#stopBtn').addEventListener('click', async () => {
    const s = await CTStorage.getSettings();
    await CTStorage.setSettings({ enabled: !s.enabled });
    chrome.runtime.sendMessage({ type: 'CT_BROADCAST_UPDATE' });
    refresh();
  });

  $('#hideBtn').addEventListener('click', async () => {
    const s = await CTStorage.getSettings();
    await CTStorage.setSettings({ hidden: !s.hidden });
    chrome.runtime.sendMessage({ type: 'CT_BROADCAST_UPDATE' });
    refresh();
  });

  $('#exportBtn').addEventListener('click', async () => {
    const data = await CTStorage.exportAll();
    download(`coursetracker-${Date.now()}.json`, JSON.stringify(data, null, 2));
  });

  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      await CTStorage.importAll(JSON.parse(text));
      chrome.runtime.sendMessage({ type: 'CT_BROADCAST_UPDATE' });
      refresh();
    } catch (err) {
      alert('Invalid JSON file');
    }
  });

  $('#resetBtn').addEventListener('click', async () => {
    if (!confirm('Reset progress for this course?')) return;
    const tab = await getActiveTab();
    await CTStorage.saveCourse(tab.url, { url: tab.url, lectures: {}, meta: { createdAt: Date.now() } });
    chrome.runtime.sendMessage({ type: 'CT_BROADCAST_UPDATE' });
    refresh();
  });
});
