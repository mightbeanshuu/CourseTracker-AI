// CourseTracker AI - Storage Utility
// Wraps chrome.storage.local with a course-scoped API.

(function () {
  const STORAGE_KEY = 'ct_courses';
  const SETTINGS_KEY = 'ct_settings';
  const PLAYLISTS_KEY = 'ct_playlists';

  function isAlive() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id); }
    catch (_) { return false; }
  }

  function safeGet(keys) {
    return new Promise((resolve) => {
      if (!isAlive()) { resolve({}); return; }
      try {
        chrome.storage.local.get(keys, (res) => {
          if (chrome.runtime.lastError) { resolve({}); return; }
          resolve(res || {});
        });
      } catch (_) { resolve({}); }
    });
  }

  function safeSet(obj) {
    return new Promise((resolve) => {
      if (!isAlive()) { resolve(); return; }
      try {
        chrome.storage.local.set(obj, () => {
          if (chrome.runtime.lastError) { /* swallow */ }
          resolve();
        });
      } catch (_) { resolve(); }
    });
  }

  function courseKey(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      let path = u.pathname.replace(/\/+$/, '');

      // YouTube playlist: key by list=<id> regardless of which video you're on
      if (host.includes('youtube.com')) {
        const list = u.searchParams.get('list');
        if (list) return `youtube.com/playlist?list=${list}`;
      }
      // 100xDevs: /new-courses/<id>/video/<vid> -> /new-courses/<id>
      if (host.includes('100xdevs.com')) {
        path = path.replace(/\/video\/[^/]+.*$/, '');
      }
      // Udemy: /course/<slug>/learn/lecture/<id> -> /course/<slug>
      if (host.includes('udemy.com')) {
        path = path.replace(/\/learn\/(lecture|practice|quiz|video)\/.+$/, '');
      }
      // Coursera: trim specific lecture/quiz suffixes
      if (host.includes('coursera.org')) {
        path = path
          .replace(/\/lecture\/[^/]+\/?[^/]*$/, '')
          .replace(/\/quiz\/[^/]+\/?[^/]*$/, '')
          .replace(/\/home$/, '');
      }
      // harkirat.classx.co.in: same pattern as 100xdevs
      if (host.includes('classx.co.in')) {
        path = path.replace(/\/video\/[^/]+.*$/, '');
      }

      return `${host}${path}`;
    } catch (_) {
      return url;
    }
  }

  async function getAll() {
    const res = await safeGet([STORAGE_KEY]);
    return res[STORAGE_KEY] || {};
  }

  function setAll(data) {
    return safeSet({ [STORAGE_KEY]: data });
  }

  async function getCourse(url) {
    const all = await getAll();
    const key = courseKey(url);
    return all[key] || { url: key, lectures: {}, meta: { createdAt: Date.now() } };
  }

  async function saveCourse(url, course) {
    const all = await getAll();
    const key = courseKey(url);
    course.meta = course.meta || {};
    course.meta.updatedAt = Date.now();
    all[key] = course;
    await setAll(all);
    return course;
  }

  async function setLectureState(url, lectureId, state) {
    const course = await getCourse(url);
    const prev = course.lectures[lectureId] || {};
    course.lectures[lectureId] = {
      done: !!state.done,
      title: state.title || prev.title || '',
      index: state.index ?? prev.index ?? 0,
      duration: state.duration ?? prev.duration ?? null,
      url: state.url || prev.url || null,
      updatedAt: Date.now()
    };
    return saveCourse(url, course);
  }

  async function bulkUpsertLectures(url, lectures) {
    const course = await getCourse(url);
    for (const l of lectures) {
      const prev = course.lectures[l.id] || {};
      course.lectures[l.id] = {
        done: prev.done ?? false,
        title: l.title || prev.title || '',
        index: l.index ?? prev.index ?? 0,
        duration: l.duration ?? prev.duration ?? null,
        url: l.url || prev.url || null,
        updatedAt: prev.updatedAt || Date.now()
      };
    }
    return saveCourse(url, course);
  }

  // ----- Playlists -----

  function makePlaylistId() {
    return 'pl_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  async function getPlaylists() {
    const res = await safeGet([PLAYLISTS_KEY]);
    return res[PLAYLISTS_KEY] || {};
  }

  async function savePlaylists(data) {
    await safeSet({ [PLAYLISTS_KEY]: data });
  }

  async function getPlaylist(id) {
    const all = await getPlaylists();
    return all[id] || null;
  }

  async function createPlaylist(name) {
    const all = await getPlaylists();
    const id = makePlaylistId();
    all[id] = {
      id,
      name: (name || 'Untitled playlist').trim().slice(0, 80),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: []
    };
    await savePlaylists(all);
    return all[id];
  }

  async function renamePlaylist(id, name) {
    const all = await getPlaylists();
    if (!all[id]) return null;
    all[id].name = (name || all[id].name).trim().slice(0, 80);
    all[id].updatedAt = Date.now();
    await savePlaylists(all);
    return all[id];
  }

  async function deletePlaylist(id) {
    const all = await getPlaylists();
    delete all[id];
    await savePlaylists(all);
  }

  async function addItemToPlaylist(playlistId, item) {
    const all = await getPlaylists();
    if (!all[playlistId]) return null;
    const exists = all[playlistId].items.some(
      (it) => it.url === item.url && it.lectureId === item.lectureId
    );
    if (exists) return all[playlistId];
    all[playlistId].items.push({
      id: 'it_' + Math.random().toString(36).slice(2, 10),
      url: item.url,
      title: item.title,
      duration: item.duration || null,
      courseKey: item.courseKey,
      lectureId: item.lectureId,
      addedAt: Date.now()
    });
    all[playlistId].updatedAt = Date.now();
    await savePlaylists(all);
    return all[playlistId];
  }

  async function removeItemFromPlaylist(playlistId, itemId) {
    const all = await getPlaylists();
    if (!all[playlistId]) return null;
    all[playlistId].items = all[playlistId].items.filter((it) => it.id !== itemId);
    all[playlistId].updatedAt = Date.now();
    await savePlaylists(all);
    return all[playlistId];
  }

  async function isItemDone(item) {
    const all = await getAll();
    const course = all[item.courseKey];
    return !!course?.lectures?.[item.lectureId]?.done;
  }

  async function getSettings() {
    const res = await safeGet([SETTINGS_KEY]);
    const defaults = {
      theme: 'auto',
      sidebarPosition: 'right',
      enabled: true,
      hidden: false,
      animations: true
    };
    return { ...defaults, ...(res[SETTINGS_KEY] || {}) };
  }

  async function setSettings(patch) {
    const cur = await getSettings();
    const next = { ...cur, ...patch };
    await safeSet({ [SETTINGS_KEY]: next });
    return next;
  }

  async function exportAll() {
    const courses = await getAll();
    const settings = await getSettings();
    const playlists = await getPlaylists();
    return { exportedAt: new Date().toISOString(), settings, courses, playlists };
  }

  async function importAll(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Invalid import payload');
    if (payload.courses) await setAll(payload.courses);
    if (payload.settings) await setSettings(payload.settings);
    if (payload.playlists) await savePlaylists(payload.playlists);
  }

  window.CTStorage = {
    isAlive,
    courseKey,
    getAll,
    getCourse,
    saveCourse,
    setLectureState,
    bulkUpsertLectures,
    getSettings,
    setSettings,
    exportAll,
    importAll,
    getPlaylists,
    getPlaylist,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addItemToPlaylist,
    removeItemFromPlaylist,
    isItemDone
  };
})();
