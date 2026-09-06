/**
 * Runs automatically on every http(s) page (see manifest.json's
 * content_scripts). Extracts a few facts about the page via
 * page-signals.js and sends them to the background service worker, which
 * does the actual analysis and owns the badge/icon state.
 *
 * Deliberately thin: all the logic worth getting right lives in
 * site-detector.js and page-signals.js, both plain functions tested
 * directly under Node. This file is just the wiring that can't be tested
 * outside a real extension runtime -- kept as small as possible so there's
 * as little here as possible to get wrong.
 */
(function () {
  "use strict";

  try {
    const signals = PageSignals.extractPageSignals(window);
    chrome.runtime.sendMessage({ type: "PAGE_SIGNALS", signals });
  } catch (error) {
    // A content script that throws can break in ways that are hard to
    // diagnose from outside the page it's running in. Fail quiet: worst
    // case, this page doesn't get analyzed, rather than the error
    // surfacing somewhere confusing.
    console.warn("Is This Phishing?: could not analyze this page.", error);
  }
})();
