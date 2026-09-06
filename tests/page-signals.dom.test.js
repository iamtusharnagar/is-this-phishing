"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { extractPageSignals } = require("../page-signals.js");

function makePage(url, html) {
  return new JSDOM(html, { url }).window;
}

test("detects a password field via a real querySelector, not a guess", () => {
  const win = makePage(
    "https://example.com/login",
    "<html><body><form><input type='text' name='u'><input type='password' name='p'></form></body></html>"
  );

  const signals = extractPageSignals(win);

  assert.equal(signals.hasPasswordField, true);
});

test("a page with no password field reports false, not just absence of a crash", () => {
  const win = makePage("https://example.com/about", "<html><body><h1>About us</h1></body></html>");

  const signals = extractPageSignals(win);

  assert.equal(signals.hasPasswordField, false);
});

test("isHttps reflects the actual page protocol", () => {
  const httpsWin = makePage("https://example.com/", "<html><body></body></html>");
  const httpWin = makePage("http://example.com/", "<html><body></body></html>");

  assert.equal(extractPageSignals(httpsWin).isHttps, true);
  assert.equal(extractPageSignals(httpWin).isHttps, false);
});

test("a brand name in the page title is detected", () => {
  const win = makePage(
    "https://secure-verify-login.com/",
    "<html><head><title>PayPal - Sign in to your account</title></head><body></body></html>"
  );

  const signals = extractPageSignals(win);

  assert.ok(signals.pageBrandMentions.includes("PayPal"));
});

test("a brand name in an h1 heading is detected", () => {
  const win = makePage(
    "https://secure-verify-login.com/",
    "<html><body><h1>Welcome to Amazon Account Verification</h1></body></html>"
  );

  const signals = extractPageSignals(win);

  assert.ok(signals.pageBrandMentions.includes("Amazon"));
});

test("a brand name mentioned only in ordinary body paragraph text is NOT flagged", () => {
  // Deliberate design choice, not an oversight: a news article that
  // discusses Amazon in its body text shouldn't be treated the same as a
  // page whose title or heading claims to *be* Amazon. See the comment in
  // page-signals.js for the reasoning.
  const win = makePage(
    "https://www.some-news-site.com/article",
    "<html><head><title>Tech News Today</title></head><body><h1>Market roundup</h1><p>Amazon's stock rose 3% today after strong earnings.</p></body></html>"
  );

  const signals = extractPageSignals(win);

  assert.equal(signals.pageBrandMentions.length, 0);
});

test("multi-word brand names (Bank of America, Wells Fargo) are detected", () => {
  const win = makePage(
    "https://secure-verify-login.com/",
    "<html><head><title>Bank of America - Online Banking</title></head><body></body></html>"
  );

  const signals = extractPageSignals(win);

  assert.ok(signals.pageBrandMentions.includes("Bank of America"));
});

test("brand detection is case-insensitive", () => {
  const win = makePage(
    "https://secure-verify-login.com/",
    "<html><head><title>paypal account login</title></head><body></body></html>"
  );

  const signals = extractPageSignals(win);

  assert.ok(signals.pageBrandMentions.includes("PayPal"));
});

test("duplicate mentions across title and heading are not double-counted", () => {
  const win = makePage(
    "https://secure-verify-login.com/",
    "<html><head><title>PayPal Login</title></head><body><h1>PayPal Account Verification</h1></body></html>"
  );

  const signals = extractPageSignals(win);

  assert.equal(signals.pageBrandMentions.filter((b) => b === "PayPal").length, 1);
});

test("a page with no title and no headings produces an empty brand list, not an error", () => {
  const win = makePage("https://example.com/", "<html><body><p>Just some content.</p></body></html>");

  assert.doesNotThrow(() => extractPageSignals(win));
  assert.deepEqual(extractPageSignals(win).pageBrandMentions, []);
});

test("end to end: a realistic phishing page structure produces the expected signals", () => {
  const win = makePage(
    "http://paypal-secure-account-verify.com/signin",
    `<html>
      <head><title>PayPal - Confirm Your Identity</title></head>
      <body>
        <h1>PayPal Account Verification Required</h1>
        <form>
          <input type="email" name="email">
          <input type="password" name="password">
        </form>
      </body>
    </html>`
  );

  const signals = extractPageSignals(win);

  assert.equal(signals.hasPasswordField, true);
  assert.equal(signals.isHttps, false);
  assert.ok(signals.pageBrandMentions.includes("PayPal"));
});

test("end to end: a realistic legitimate page structure produces harmless signals", () => {
  const win = makePage(
    "https://www.paypal.com/signin",
    `<html>
      <head><title>Log in to your PayPal account</title></head>
      <body>
        <h1>Log in</h1>
        <form>
          <input type="email" name="email">
          <input type="password" name="password">
        </form>
      </body>
    </html>`
  );

  const signals = extractPageSignals(win);
  const { analyzeSite } = require("../site-detector.js");
  const result = analyzeSite({ url: signals.url, hasPasswordField: signals.hasPasswordField, pageBrandMentions: signals.pageBrandMentions });

  assert.equal(result.findings.length, 0);
});
