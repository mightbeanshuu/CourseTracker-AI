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

  const durRow = $('#durationRow');
  if (stats.hasDuration && stats.totalDuration > 0) {
    durRow.hidden = false;
    $('#durWatched').textContent = CTProgress.formatDuration(stats.completedDuration);
    $('#durRemaining').textContent = CTProgress.formatDuration(stats.remainingDuration);
    $('#durTotal').textContent = CTProgress.formatDuration(stats.totalDuration);
  } else {
    durRow.hidden = true;
  }

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
    const durLabel = lec.duration ? `<span class="lec-dur">${escapeHtml(lec.duration)}</span>` : '';
    li.innerHTML = `
      <input type="checkbox" ${lec.done ? 'checked' : ''} />
      <span class="lec-title" title="${escapeHtml(lec.title)}">${escapeHtml(lec.title)}</span>
      ${durLabel}
      <button class="add-pl-btn" title="Add to playlist">⊕</button>
    `;
    li.querySelector('input').addEventListener('change', async (e) => {
      await CTStorage.setLectureState(url, id, { ...lec, done: e.target.checked });
      chrome.runtime.sendMessage({ type: 'CT_BROADCAST_UPDATE' });
      refresh();
    });
    li.querySelector('.add-pl-btn').addEventListener('click', () => {
      openAddToPlaylist({
        url: lec.url || url,
        title: lec.title,
        duration: lec.duration,
        courseKey: CTStorage.courseKey(url),
        lectureId: id
      });
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

let pendingItem = null;

async function renderPlaylists() {
  const playlists = await CTStorage.getPlaylists();
  const list = $('#playlistList');
  list.innerHTML = '';
  const entries = Object.values(playlists).sort((a, b) => b.updatedAt - a.updatedAt);
  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'muted small';
    li.textContent = 'No playlists yet. Tap ⊕ next to a lecture or "+ New".';
    list.appendChild(li);
    return;
  }
  for (const pl of entries) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="pl-row">
        <span class="pl-name" title="${escapeHtml(pl.name)}">${escapeHtml(pl.name)}</span>
        <span class="pl-count">${pl.items.length}</span>
        <div class="pl-actions">
          <button class="pl-icon-btn pl-open" title="Open">↗</button>
          <button class="pl-icon-btn pl-rename" title="Rename">✎</button>
          <button class="pl-icon-btn pl-delete" title="Delete">🗑</button>
        </div>
      </div>
    `;
    li.querySelector('.pl-name').addEventListener('click', () => openPlaylist(pl.id));
    li.querySelector('.pl-open').addEventListener('click', () => openPlaylist(pl.id));
    li.querySelector('.pl-rename').addEventListener('click', async () => {
      const newName = prompt('Rename playlist:', pl.name);
      if (newName && newName.trim()) {
        await CTStorage.renamePlaylist(pl.id, newName.trim());
        renderPlaylists();
      }
    });
    li.querySelector('.pl-delete').addEventListener('click', async () => {
      if (confirm(`Delete playlist "${pl.name}"?`)) {
        await CTStorage.deletePlaylist(pl.id);
        renderPlaylists();
      }
    });
    list.appendChild(li);
  }
}

function openPlaylist(id) {
  const url = chrome.runtime.getURL(`playlist/playlist.html?id=${encodeURIComponent(id)}`);
  chrome.tabs.create({ url });
}

async function openAddToPlaylist(item) {
  pendingItem = item;
  $('#addPanelTitle').textContent = `"${item.title}"`;
  $('#addPanelNewName').value = '';
  const playlists = await CTStorage.getPlaylists();
  const list = $('#addPanelList');
  list.innerHTML = '';
  const entries = Object.values(playlists).sort((a, b) => b.updatedAt - a.updatedAt);
  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'muted small';
    li.textContent = 'No playlists yet — create one below.';
    list.appendChild(li);
  } else {
    for (const pl of entries) {
      const li = document.createElement('li');
      li.style.cursor = 'pointer';
      li.innerHTML = `
        <span class="lec-title">${escapeHtml(pl.name)}</span>
        <span class="lec-dur">${pl.items.length}</span>
      `;
      li.addEventListener('click', async () => {
        await CTStorage.addItemToPlaylist(pl.id, pendingItem);
        closeAddToPlaylist();
        renderPlaylists();
      });
      list.appendChild(li);
    }
  }
  $('#addToPlaylistPanel').hidden = false;
  $('#addPanelNewName').focus();
}

function closeAddToPlaylist() {
  pendingItem = null;
  $('#addToPlaylistPanel').hidden = true;
}

document.addEventListener('DOMContentLoaded', async () => {
  await applyTheme();
  await refresh();
  await renderPlaylists();

  $('#newPlaylistBtn').addEventListener('click', async () => {
    const name = prompt('Playlist name:', 'My playlist');
    if (name && name.trim()) {
      await CTStorage.createPlaylist(name.trim());
      renderPlaylists();
    }
  });

  $('#addPanelClose').addEventListener('click', closeAddToPlaylist);
  $('#addToPlaylistPanel').addEventListener('click', (e) => {
    if (e.target === $('#addToPlaylistPanel')) closeAddToPlaylist();
  });
  $('#addPanelCreate').addEventListener('click', async () => {
    const name = $('#addPanelNewName').value.trim();
    if (!name || !pendingItem) return;
    const pl = await CTStorage.createPlaylist(name);
    await CTStorage.addItemToPlaylist(pl.id, pendingItem);
    closeAddToPlaylist();
    renderPlaylists();
  });
  $('#addPanelNewName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#addPanelCreate').click();
  });

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
