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
    const seen = new Set();
    const durRegex = /(?:\d+\s*hrs?\s+)?\d+\s*mins?(?:\s+\d+\s*secs?)?|\d+\s*secs?/i;

    function tryPush(node, title, duration) {
      if (!node || seen.has(node)) return;
      if (!title || title.length < 2 || title.length > 240) return;
      if (/^course website$/i.test(title.trim())) return;
      seen.add(node);
      items.push({
        node,
        title: title.replace(/\s+/g, ' ').trim().slice(0, 200),
        index: items.length,
        duration: duration ? duration.replace(/\s+/g, ' ').trim() : null
      });
    }

    // Strategy A: anchor links pointing to a specific video
    document.querySelectorAll('a[href*="/video/"]').forEach((node) => {
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 280) return;
      const m = text.match(durRegex);
      const duration = m ? m[0] : null;
      const title = duration ? text.replace(duration, '').trim() : text;
      tryPush(node, title, duration);
    });

    // Strategy B: walk up from each duration text node and pick the smallest
    // ancestor whose remaining text (after removing the duration) is a real title.
    let walker;
    try {
      walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          const t = (n.nodeValue || '').trim();
          return t && durRegex.test(t) && /\d/.test(t)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      });
    } catch (_) { walker = null; }

    let tn;
    while (walker && (tn = walker.nextNode())) {
      const durText = (tn.nodeValue || '').trim();
      if (!durText || durText.length > 60) continue;
      let row = tn.parentElement;
      for (let depth = 0; depth < 6 && row; depth++) {
        if (seen.has(row)) break;
        const allText = (row.textContent || '').replace(/\s+/g, ' ').trim();
        if (allText.length > 320) break;
        const title = allText.replace(durText, '').trim();
        if (title.length >= 3) {
          tryPush(row, title, durText);
          break;
        }
        row = row.parentElement;
      }
    }

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
