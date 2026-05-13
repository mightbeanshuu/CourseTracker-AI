// CourseTracker AI - Playlist viewer

const $ = (sel) => document.querySelector(sel);
const params = new URLSearchParams(location.search);
const playlistId = params.get('id');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch (_) { return ''; }
}

async function applyTheme() {
  const settings = await CTStorage.getSettings();
  let theme = settings.theme;
  if (theme === 'auto') {
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
}

async function loadDoneMap(items) {
  const courses = await CTStorage.getAll();
  const map = {};
  for (const it of items) {
    map[it.id] = !!courses[it.courseKey]?.lectures?.[it.lectureId]?.done;
  }
  return map;
}

async function render() {
  if (!playlistId) {
    document.title = 'CourseTracker AI · Playlist not found';
    $('#playlistName').textContent = 'Playlist not found';
    $('#meta').textContent = 'No playlist id was provided.';
    $('#emptyState').hidden = false;
    return;
  }

  const pl = await CTStorage.getPlaylist(playlistId);
  if (!pl) {
    document.title = 'CourseTracker AI · Playlist not found';
    $('#playlistName').textContent = 'Playlist not found';
    $('#meta').textContent = 'This playlist may have been deleted.';
    $('#emptyState').hidden = false;
    return;
  }

  document.title = `CourseTracker AI · ${pl.name}`;
  $('#playlistName').textContent = pl.name;
  $('#itemCount').textContent = pl.items.length;

  const doneMap = await loadDoneMap(pl.items);

  let totalSec = 0;
  let doneSec = 0;
  let withDuration = 0;
  for (const it of pl.items) {
    const sec = CTProgress.parseDuration(it.duration || '');
    if (sec > 0) withDuration++;
    totalSec += sec;
    if (doneMap[it.id]) doneSec += sec;
  }
  const completed = pl.items.filter((it) => doneMap[it.id]).length;
  const total = pl.items.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  $('#progressLabel').textContent = `Progress: ${completed} / ${total} completed`;
  $('#progressPct').textContent = `${pct}%`;
  $('#progressFill').style.width = `${pct}%`;

  const durRow = $('#durationRow');
  if (withDuration > 0 && totalSec > 0) {
    durRow.hidden = false;
    $('#durWatched').textContent = CTProgress.formatDuration(doneSec);
    $('#durRemaining').textContent = CTProgress.formatDuration(Math.max(0, totalSec - doneSec));
    $('#durTotal').textContent = CTProgress.formatDuration(totalSec);
  } else {
    durRow.hidden = true;
  }

  const created = new Date(pl.createdAt).toLocaleDateString();
  const updated = new Date(pl.updatedAt).toLocaleDateString();
  $('#meta').textContent = `${total} ${total === 1 ? 'video' : 'videos'} · created ${created} · updated ${updated}`;

  const list = $('#itemsList');
  list.innerHTML = '';
  $('#emptyState').hidden = pl.items.length > 0;

  pl.items.forEach((it, i) => {
    const done = doneMap[it.id];
    const li = document.createElement('li');
    li.className = `item${done ? ' done' : ''}`;
    li.innerHTML = `
      <span class="item-index">${i + 1}</span>
      <input type="checkbox" class="item-check" ${done ? 'checked' : ''} />
      <div class="item-main" tabindex="0">
        <div class="item-title" title="${escapeHtml(it.title)}">${escapeHtml(it.title)}</div>
        <div class="item-sub">
          <span class="item-host">${escapeHtml(hostOf(it.url))}</span>
          ${it.duration ? `<span class="item-dur">⏱ ${escapeHtml(it.duration)}</span>` : ''}
        </div>
      </div>
      <div class="item-actions">
        <button class="item-btn open" title="Open in new tab">↗</button>
        <button class="item-btn remove" title="Remove from playlist">🗑</button>
      </div>
    `;

    const goTo = () => {
      try { chrome.tabs.create({ url: it.url }); }
      catch (_) { window.open(it.url, '_blank'); }
    };

    li.querySelector('.item-main').addEventListener('click', goTo);
    li.querySelector('.item-main').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') goTo();
    });
    li.querySelector('.open').addEventListener('click', (e) => {
      e.stopPropagation();
      goTo();
    });
    li.querySelector('.item-check').addEventListener('click', (e) => e.stopPropagation());
    li.querySelector('.item-check').addEventListener('change', async (e) => {
      await CTStorage.setLectureState(it.url, it.lectureId, {
        done: e.target.checked,
        title: it.title,
        duration: it.duration,
        url: it.url
      });
      chrome.runtime.sendMessage({ type: 'CT_BROADCAST_UPDATE' });
      render();
    });
    li.querySelector('.remove').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Remove "${it.title}" from this playlist?`)) {
        await CTStorage.removeItemFromPlaylist(playlistId, it.id);
        render();
      }
    });

    list.appendChild(li);
  });
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

  // Rename playlist when name is edited
  $('#playlistName').addEventListener('blur', async () => {
    const newName = $('#playlistName').textContent.trim();
    if (!newName || !playlistId) return;
    const pl = await CTStorage.getPlaylist(playlistId);
    if (pl && pl.name !== newName) {
      await CTStorage.renamePlaylist(playlistId, newName);
      document.title = `CourseTracker AI · ${newName}`;
    }
  });
  $('#playlistName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#playlistName').blur();
    }
  });

  $('#exportBtn').addEventListener('click', async () => {
    if (!playlistId) return;
    const pl = await CTStorage.getPlaylist(playlistId);
    if (!pl) return;
    const blob = new Blob([JSON.stringify(pl, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pl.name.replace(/[^\w\-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  $('#deleteBtn').addEventListener('click', async () => {
    if (!playlistId) return;
    const pl = await CTStorage.getPlaylist(playlistId);
    if (!pl) return;
    if (confirm(`Delete playlist "${pl.name}"? This cannot be undone.`)) {
      await CTStorage.deletePlaylist(playlistId);
      window.close();
    }
  });

  // Live sync when other tabs / the popup change storage
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.ct_playlists || changes.ct_courses) render();
  });
});
