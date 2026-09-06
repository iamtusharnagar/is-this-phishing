/**
 * Extracts the small set of page facts site-detector.js needs, from a real
 * (or jsdom-simulated) `window`. Kept separate from content.js itself so it
 * can be unit tested without needing chrome.* APIs or a real extension
 * runtime -- content.js is a thin wrapper that calls this and sends the
 * result over chrome.runtime.sendMessage.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PageSignals = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Only brands also present in site-detector.js's KNOWN_BRANDS are worth
  // looking for in page text -- anything else would never match there
  // anyway. Kept as its own short list rather than importing
  // site-detector.js's, since content scripts and this module may be
  // bundled independently.
  const BRAND_KEYWORDS = [
    "PayPal",
    "Amazon",
    "Apple",
    "Microsoft",
    "Netflix",
    "Google",
    "Facebook",
    "Instagram",
    "Bank of America",
    "Wells Fargo",
    "Chase",
    "USPS",
    "FedEx",
  ];

  /**
   * @param {Window} win - a real window, or a jsdom window in tests
   * @returns {{url: string, isHttps: boolean, hasPasswordField: boolean, pageBrandMentions: string[]}}
   */
  function extractPageSignals(win) {
    const doc = win.document;
    const url = win.location.href;
    const isHttps = win.location.protocol === "https:";

    const hasPasswordField = doc.querySelector('input[type="password"]') !== null;

    // Only the page's own title and top-level headings -- not the entire
    // visible text -- to avoid false-flagging a page that merely mentions
    // a brand in passing (a news article about Amazon, a blog post
    // comparing PayPal and Stripe). A phishing page impersonating a brand
    // puts that brand's name in the title or a prominent heading; an
    // article that happens to discuss the brand usually doesn't put it
    // there the same way a spoofed login page does.
    const headingText = Array.from(doc.querySelectorAll("h1"))
      .map((el) => el.textContent || "")
      .join(" ");
    const searchableText = `${doc.title || ""} ${headingText}`;

    const pageBrandMentions = Array.from(
      new Set(
        BRAND_KEYWORDS.filter((brand) => searchableText.toLowerCase().includes(brand.toLowerCase()))
      )
    );

    return { url, isHttps, hasPasswordField, pageBrandMentions };
  }

  return { extractPageSignals };
});
