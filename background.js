// CourseTracker AI - Background Service Worker

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.local.set({
      ct_settings: {
        theme: 'auto',
        sidebarPosition: 'right',
        enabled: true,
        animations: true
      }
    });
  }
});

function safeSend(tabId, payload) {
  try {
    const p = chrome.tabs.sendMessage(tabId, payload);
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (_) { /* tab gone or no listener */ }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'CT_OPEN_POPUP') {
    try {
      const p = chrome.action.openPopup?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {}
    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === 'CT_GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] || null });
    });
    return true;
  }

  if (msg?.type === 'CT_BROADCAST_UPDATE') {
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        if (t.id) safeSend(t.id, { type: 'CT_REFRESH' });
      }
    });
    sendResponse({ ok: true });
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.url && /^https?:/.test(tab.url)) {
    safeSend(tabId, { type: 'CT_URL_CHANGED', url: tab.url });
  }
});
