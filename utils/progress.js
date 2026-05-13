// CourseTracker AI - Progress Calculator

(function () {
  function parseDuration(str) {
    if (!str || typeof str !== 'string') return 0;
    const s = str.trim();
    if (!s) return 0;

    const colon = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
    if (colon) {
      const a = parseInt(colon[1], 10);
      const b = parseInt(colon[2], 10);
      const c = colon[3] != null ? parseInt(colon[3], 10) : null;
      return c != null ? a * 3600 + b * 60 + c : a * 60 + b;
    }

    let total = 0;
    const hr = s.match(/(\d+)\s*h(?:r|our)?s?/i);
    const mn = s.match(/(\d+)\s*m(?:in)?s?/i);
    const sc = s.match(/(\d+)\s*s(?:ec)?s?/i);
    if (hr) total += parseInt(hr[1], 10) * 3600;
    if (mn) total += parseInt(mn[1], 10) * 60;
    if (sc) total += parseInt(sc[1], 10);
    return total;
  }

  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  }

  function calculate(course) {
    const lectures = course?.lectures || {};
    const ids = Object.keys(lectures);
    const total = ids.length;
    const completed = ids.filter((id) => lectures[id]?.done).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    let totalSec = 0;
    let doneSec = 0;
    let withDuration = 0;
    for (const id of ids) {
      const lec = lectures[id];
      const sec = parseDuration(lec?.duration);
      if (sec > 0) withDuration++;
      totalSec += sec;
      if (lec?.done) doneSec += sec;
    }

    return {
      total,
      completed,
      pct,
      totalDuration: totalSec,
      completedDuration: doneSec,
      remainingDuration: Math.max(0, totalSec - doneSec),
      hasDuration: withDuration > 0
    };
  }

  function formatLabel({ completed, total, pct }) {
    return `Progress: ${completed} / ${total} completed (${pct}%)`;
  }

  window.CTProgress = { calculate, formatLabel, parseDuration, formatDuration };
})();
