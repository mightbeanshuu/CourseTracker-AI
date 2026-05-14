// CourseTracker AI - Home Dashboard

const $ = (sel) => document.querySelector(sel);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function prettyCourseLabel(key) {
  // courseKey looks like "hostname/path"
  const slash = key.indexOf('/');
  if (slash === -1) return { host: key, path: '' };
  return { host: key.slice(0, slash), path: key.slice(slash) || '/' };
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

async function applyTheme() {
  const settings = await CTStorage.getSettings();
  let theme = settings.theme;
  if (theme === 'auto') {
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
}

function openPlaylist(id) {
  const url = chrome.runtime.getURL(`playlist/playlist.html?id=${encodeURIComponent(id)}`);
  chrome.tabs.create({ url });
}

async function renderStats(courses, playlists) {
  const courseList = Object.values(courses);
  let totalLectures = 0;
  let completedLectures = 0;
  for (const c of courseList) {
    const stats = CTProgress.calculate(c);
    totalLectures += stats.total;
    completedLectures += stats.completed;
  }
  const pct = totalLectures === 0 ? 0 : Math.round((completedLectures / totalLectures) * 100);

  $('#statPlaylists').textContent  = Object.keys(playlists).length;
  $('#statCourses').textContent    = courseList.length;
  $('#statLectures').textContent   = totalLectures;
  $('#statCompletion').textContent = `${pct}%`;

  $('#overallLabel').textContent = `${completedLectures} of ${totalLectures} lectures complete`;
  $('#overallPct').textContent   = `${pct}%`;
  $('#overallFill').style.width  = `${pct}%`;
}

async function renderPlaylists(playlists) {
  const list = $('#playlistList');
  const empty = $('#playlistEmpty');
  list.innerHTML = '';
  const entries = Object.values(playlists).sort((a, b) => b.updatedAt - a.updatedAt);
  $('#playlistCount').textContent = entries.length;

  if (!entries.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const pl of entries) {
    const updated = new Date(pl.updatedAt).toLocaleDateString();
    const count = pl.items.length;
    const li = document.createElement('li');
    li.className = 'dash-item';
    li.innerHTML = `
      <div class="dash-main">
        <div class="dash-title" title="${escapeHtml(pl.name)}">${escapeHtml(pl.name)}</div>
        <div class="dash-sub">
          <span class="pill outline">${count} ${count === 1 ? 'video' : 'videos'}</span>
          <span>updated ${updated}</span>
        </div>
      </div>
      <div class="dash-actions">
        <button class="item-btn pl-open" title="Open">↗</button>
        <button class="item-btn pl-rename" title="Rename">✎</button>
        <button class="item-btn remove pl-delete" title="Delete">🗑</button>
      </div>
    `;
    li.querySelector('.dash-main').addEventListener('click', () => openPlaylist(pl.id));
    li.querySelector('.pl-open').addEventListener('click', () => openPlaylist(pl.id));
    li.querySelector('.pl-rename').addEventListener('click', async () => {
      const newName = prompt('Rename playlist:', pl.name);
      if (newName && newName.trim()) {
        await CTStorage.renamePlaylist(pl.id, newName.trim());
        render();
      }
    });
    li.querySelector('.pl-delete').addEventListener('click', async () => {
      if (confirm(`Delete playlist "${pl.name}"?`)) {
        await CTStorage.deletePlaylist(pl.id);
        render();
      }
    });
    list.appendChild(li);
  }
}

async function renderCourses(courses) {
  const list = $('#courseList');
  const empty = $('#courseEmpty');
  list.innerHTML = '';

  const entries = Object.entries(courses)
    .map(([key, c]) => ({ key, course: c, stats: CTProgress.calculate(c) }))
    .filter((e) => e.stats.total > 0)
    .sort((a, b) => (b.course.meta?.updatedAt || 0) - (a.course.meta?.updatedAt || 0))
    .slice(0, 10);

  $('#courseCount').textContent = entries.length;

  if (!entries.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const e of entries) {
    const { host, path } = prettyCourseLabel(e.key);
    const li = document.createElement('li');
    li.className = 'dash-item';
    li.innerHTML = `
      <div class="dash-main">
        <div class="dash-title" title="${escapeHtml(e.key)}">${escapeHtml(host)}</div>
        <div class="dash-sub">
          <span class="pill outline">${escapeHtml(host.split('.').slice(-2, -1)[0] || host)}</span>
          <span title="${escapeHtml(path)}">${escapeHtml(path.length > 40 ? path.slice(0, 40) + '…' : path)}</span>
        </div>
      </div>
      <div class="dash-progress">
        <div class="row between small">
          <span class="muted">${e.stats.completed} / ${e.stats.total}</span>
          <span class="pct">${e.stats.pct}%</span>
        </div>
        <div class="track"><div class="fill" style="width:${e.stats.pct}%"></div></div>
      </div>
    `;
    li.querySelector('.dash-main').addEventListener('click', () => {
      // best-effort: open the course root URL
      const url = /^https?:\/\//.test(e.course.url) ? e.course.url : `https://${e.key}`;
      try { chrome.tabs.create({ url }); }
      catch (_) { window.open(url, '_blank'); }
    });
    list.appendChild(li);
  }
}

async function render() {
  const [courses, playlists] = await Promise.all([
    CTStorage.getAll(),
    CTStorage.getPlaylists()
  ]);
  await renderStats(courses, playlists);
  await renderPlaylists(playlists);
  await renderCourses(courses);
}

document.addEventListener('DOMContentLoaded', async () => {
  await applyTheme();
  await render();

  $('#themeBtn').addEventListener('click', async () => {
    const s = await CTStorage.getSettings();
    const next = s.theme === 'dark' ? 'light' : s.theme === 'light' ? 'auto' : 'dark';
    await CTStorage.setSettings({ theme: next });
    await applyTheme();
  });

  $('#newPlaylistBtn').addEventListener('click', async () => {
    const name = prompt('Playlist name:', 'My playlist');
    if (name && name.trim()) {
      const pl = await CTStorage.createPlaylist(name.trim());
      await render();
      openPlaylist(pl.id);
    }
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
      await render();
    } catch (err) {
      alert('Invalid JSON file');
    }
  });

  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.ct_playlists || changes.ct_courses) render();
  });
});
