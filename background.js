// DramaLounge background service worker (Manifest V3)
// Provides action toggle and simple relay. Avoids destructive actions.

const STORAGE_KEY = 'annoyanceEnabled';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    if (typeof res[STORAGE_KEY] === 'undefined') {
      chrome.storage.local.set({ [STORAGE_KEY]: false });
    }
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  const current = await chrome.storage.local.get([STORAGE_KEY]);
  const next = !current[STORAGE_KEY];
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  chrome.action.setBadgeText({ text: next ? 'ON' : '' });
  chrome.action.setBadgeBackgroundColor({ color: next ? '#ef4444' : '#000000' });
  // Inform all tabs so content can start/stop
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs) {
      try {
        chrome.tabs.sendMessage(t.id, { type: 'DRAMALOUNGE_TOGGLE', enabled: next }, () => void chrome.runtime.lastError);
      } catch (_) {}
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'DRAMALOUNGE_LOG') {
    console.log('[DramaLounge]', message.payload);
    sendResponse({ ok: true });
    return; // handled
  }
  return false;
});



