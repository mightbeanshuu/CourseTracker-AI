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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'CT_OPEN_POPUP') {
    chrome.action.openPopup?.().catch(() => {});
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
        if (t.id) chrome.tabs.sendMessage(t.id, { type: 'CT_REFRESH' }).catch(() => {});
      }
    });
    sendResponse({ ok: true });
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.url) {
    chrome.tabs.sendMessage(tabId, { type: 'CT_URL_CHANGED', url: tab.url }).catch(() => {});
  }
});
