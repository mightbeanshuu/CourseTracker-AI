// CourseTracker AI - Progress Calculator

(function () {
  function calculate(course) {
    const lectures = course?.lectures || {};
    const ids = Object.keys(lectures);
    const total = ids.length;
    const completed = ids.filter((id) => lectures[id]?.done).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, pct };
  }

  function formatLabel({ completed, total, pct }) {
    return `Progress: ${completed} / ${total} completed (${pct}%)`;
  }

  window.CTProgress = { calculate, formatLabel };
})();
