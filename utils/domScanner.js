// CourseTracker AI - DOM Scanner
// Detects course platform and returns an array of lecture nodes.

(function () {
  const PLATFORMS = {
    UDEMY: 'udemy',
    COURSERA: 'coursera',
    YOUTUBE: 'youtube',
    HUNDRED_X_DEVS: '100xdevs',
    GENERIC: 'generic'
  };

  function detectPlatform() {
    const host = location.hostname;
    if (host.includes('udemy.com')) return PLATFORMS.UDEMY;
    if (host.includes('coursera.org')) return PLATFORMS.COURSERA;
    if (host.includes('youtube.com')) return PLATFORMS.YOUTUBE;
    if (host.includes('100xdevs.com') || host.includes('harkirat.classx.co.in')) return PLATFORMS.HUNDRED_X_DEVS;
    return PLATFORMS.GENERIC;
  }

  function isLikelyCoursePage() {
    const platform = detectPlatform();
    if (platform === PLATFORMS.YOUTUBE) {
      return /[?&]list=/.test(location.search) || location.pathname.startsWith('/playlist');
    }
    if (platform !== PLATFORMS.GENERIC) return true;

    const hints = [
      'curriculum', 'lecture', 'lesson', 'syllabus', 'course-content',
      'video-list', 'chapter', 'module'
    ];
    const html = document.body?.innerHTML?.toLowerCase() || '';
    return hints.some((h) => html.includes(h));
  }

  function hashString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }

  function makeLectureId(title, index) {
    return `lec_${hashString((title || '').trim().toLowerCase())}_${index}`;
  }

  function uniqByTitle(items) {
    const seen = new Set();
    const out = [];
    for (const it of items) {
      const key = `${(it.title || '').trim()}|${it.index}`;
      if (!seen.has(key) && it.title) {
        seen.add(key);
        out.push(it);
      }
    }
    return out;
  }

  function scanUdemy() {
    const items = [];
    const nodes = document.querySelectorAll(
      '[data-purpose="curriculum-item"], li[class*="curriculum-item"], .ud-block-list-item'
    );
    nodes.forEach((node, i) => {
      const titleEl = node.querySelector(
        '[data-purpose="item-title"], .ud-block-list-item-content, span.truncate-with-tooltip__child'
      );
      const durEl = node.querySelector('[data-purpose="duration"], .curriculum-item-link--metadata--XK804');
      const title = titleEl?.textContent?.trim();
      if (!title) return;
      items.push({
        node,
        title,
        index: i,
        duration: durEl?.textContent?.trim() || null
      });
    });
    return items;
  }

  function scanCoursera() {
    const items = [];
    const nodes = document.querySelectorAll(
      'a[data-click-key*="lecture"], li[class*="rc-LessonItems"] a, [data-test="rc-LectureItem"]'
    );
    nodes.forEach((node, i) => {
      const title = node.querySelector('.lessonItemName, span')?.textContent?.trim() || node.textContent?.trim();
      if (!title) return;
      items.push({ node, title: title.slice(0, 160), index: i, duration: null });
    });
    return items;
  }

  function scanYouTube() {
    const items = [];
    const nodes = document.querySelectorAll(
      'ytd-playlist-panel-video-renderer, ytd-playlist-video-renderer'
    );
    nodes.forEach((node, i) => {
      const titleEl = node.querySelector('#video-title, a#video-title');
      const durEl = node.querySelector('span.ytd-thumbnail-overlay-time-status-renderer, #text.ytd-thumbnail-overlay-time-status-renderer');
      const title = titleEl?.title?.trim() || titleEl?.textContent?.trim();
      if (!title) return;
      items.push({
        node,
        title,
        index: i,
        duration: durEl?.textContent?.trim() || null
      });
    });
    return items;
  }

  function scan100xDevs() {
    const items = [];
    const nodes = document.querySelectorAll(
      '[class*="lecture"], [class*="Lecture"], [class*="video-item"], [class*="VideoItem"], li a[href*="lecture"], li a[href*="video"]'
    );
    nodes.forEach((node, i) => {
      const title = node.textContent?.trim();
      if (!title || title.length > 240) return;
      items.push({ node, title: title.slice(0, 200), index: i, duration: null });
    });
    return items;
  }

  function scanGeneric() {
    const items = [];
    const selectors = [
      'li a[href*="lecture"]',
      'li a[href*="lesson"]',
      'li a[href*="video"]',
      '[class*="lesson-item"]',
      '[class*="lecture-item"]',
      '[class*="video-item"]',
      '[class*="curriculum"] li',
      '[class*="chapter"] li',
      '[class*="syllabus"] li'
    ];
    const seen = new Set();
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((node) => {
        if (seen.has(node)) return;
        seen.add(node);
        const text = node.textContent?.trim();
        if (!text || text.length < 3 || text.length > 240) return;
        items.push({ node, title: text.slice(0, 200), index: items.length, duration: null });
      });
    });
    return items;
  }

  function scan() {
    const platform = detectPlatform();
    let items = [];
    switch (platform) {
      case PLATFORMS.UDEMY: items = scanUdemy(); break;
      case PLATFORMS.COURSERA: items = scanCoursera(); break;
      case PLATFORMS.YOUTUBE: items = scanYouTube(); break;
      case PLATFORMS.HUNDRED_X_DEVS: items = scan100xDevs(); break;
      default: items = scanGeneric();
    }
    items = uniqByTitle(items).map((it) => ({
      ...it,
      id: makeLectureId(it.title, it.index)
    }));
    return { platform, items };
  }

  window.CTDomScanner = {
    PLATFORMS,
    detectPlatform,
    isLikelyCoursePage,
    scan
  };
})();
