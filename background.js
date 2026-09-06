/**
 * Background service worker. Receives page signals from content.js,
 * analyzes them with site-detector.js, and stores the result per tab.
 *
 * Uses chrome.storage.session, not a plain JS variable, for that
 * per-tab state. This matters: Manifest V3 service workers are ephemeral
 * -- Chrome terminates and later re-wakes them whenever it wants, and
 * anything held only in a top-level variable is lost silently when that
 * happens. A naive `const resultsByTab = {}` would work fine in testing
 * (where the worker never sleeps) and then intermittently show the popup
 * as empty in real use, for reasons that would look like a UI bug rather
 * than the actual cause. chrome.storage.session survives worker restarts
 * for the life of the browser session, which is exactly the lifetime this
 * data actually needs.
 */
importScripts("site-detector.js");

const BADGE_COLORS = {
  none: "#4B7C63", // sage - matches second-look's reassurance color, not used yet as text
  caution: "#B8722C", // amber - matches second-look's caution color
};

async function storeResult(tabId, result) {
  await chrome.storage.session.set({ [`tab-${tabId}`]: result });
}

async function setBadge(tabId, findingCount) {
  if (findingCount === 0) {
    await chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }
  await chrome.action.setBadgeText({ tabId, text: String(findingCount) });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLORS.caution });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== "PAGE_SIGNALS" || !sender.tab || sender.tab.id === undefined) {
    return;
  }

  const tabId = sender.tab.id;
  const result = SiteDetector.analyzeSite(message.signals);

  storeResult(tabId, result);
  setBadge(tabId, result.findings.length);
});

// Without this, a closed tab's stored result lingers in
// chrome.storage.session forever (well, for the session) for no reason --
// small, but there's no cost to cleaning it up properly.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`tab-${tabId}`);
});
