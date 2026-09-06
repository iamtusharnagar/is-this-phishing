"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

/**
 * Loads the real popup.html/popup.js with a mocked chrome.* API, so the
 * test exercises the actual DOM-building code in popup.js rather than
 * calling internal functions directly (which wouldn't need this file's
 * own module.exports -- popup.js is a page script, not a module, matching
 * how it will actually run).
 */
function loadPopup({ tab, storedResult }) {
  const html = fs.readFileSync(path.join(__dirname, "..", "popup", "popup.html"), "utf-8");
  const popupSrc = fs.readFileSync(path.join(__dirname, "..", "popup", "popup.js"), "utf-8");

  const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
  const { window } = dom;

  window.chrome = {
    tabs: {
      query: async () => (tab ? [tab] : []),
    },
    storage: {
      session: {
        get: async (key) => (storedResult !== undefined ? { [key]: storedResult } : {}),
      },
    },
  };

  const script = window.document.createElement("script");
  script.textContent = popupSrc;
  window.document.body.appendChild(script);

  return window;
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("a page with findings renders the caution verdict and each finding", async () => {
  const window = loadPopup({
    tab: { id: 1, url: "https://paypal-secure-verify.com/login" },
    storedResult: {
      findings: [
        { id: "url-brand-mismatch-paypal", label: "Address mismatch", explanation: "Doesn't match PayPal's real site." },
      ],
    },
  });
  await flushMicrotasks();

  const content = window.document.getElementById("content");
  assert.match(content.textContent, /1 warning sign found/);
  assert.match(content.textContent, /Address mismatch/);
  assert.match(content.textContent, /Doesn't match PayPal's real site/);
  assert.equal(window.document.getElementById("meta").textContent, "https://paypal-secure-verify.com/login");
});

test("a page with zero findings renders the clear verdict", async () => {
  const window = loadPopup({
    tab: { id: 1, url: "https://www.wikipedia.org" },
    storedResult: { findings: [] },
  });
  await flushMicrotasks();

  const content = window.document.getElementById("content");
  assert.match(content.textContent, /No common warning signs found/);
});

test("no stored result for the tab shows the no-data message, not an error", async () => {
  const window = loadPopup({ tab: { id: 1, url: "https://example.com" }, storedResult: undefined });
  await flushMicrotasks();

  const content = window.document.getElementById("content");
  assert.match(content.textContent, /No information yet for this page/);
});

test("no active tab at all shows the no-data message, not a crash", async () => {
  const window = loadPopup({ tab: null, storedResult: undefined });
  await flushMicrotasks();

  const content = window.document.getElementById("content");
  assert.match(content.textContent, /No information yet for this page/);
});

test("a malicious-looking finding label is rendered as inert text, not markup", () => {
  // The actual regression check for the linter-flagged innerHTML issue:
  // popup.js now builds DOM nodes via createElement/textContent, so this
  // has nowhere to execute even if a future site-detector.js change ever
  // let attacker-influenced text into a finding's label or explanation.
  const window = loadPopup({
    tab: { id: 1, url: "https://example.com" },
    storedResult: {
      findings: [
        {
          id: "test",
          label: "<img src=x onerror=alert(1)>",
          explanation: "<script>alert(2)</script>",
        },
      ],
    },
  });

  return flushMicrotasks().then(() => {
    const content = window.document.getElementById("content");
    assert.equal(content.querySelector("img"), null);
    assert.equal(content.querySelector("script"), null);
    assert.match(content.textContent, /img src=x onerror=alert\(1\)/);
  });
});

test("popup.js contains no innerHTML assignment at all", () => {
  // Structural guard matching the linter's own finding category: confirms
  // the fix wasn't just "escape harder" but "don't use innerHTML here at all."
  const src = fs.readFileSync(path.join(__dirname, "..", "popup", "popup.js"), "utf-8");
  assert.doesNotMatch(src, /\.innerHTML\s*=/);
});
