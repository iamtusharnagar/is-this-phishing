"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { analyzeSite, extractHostname, registrableDomain, isRawIp, isPunycode } = require("../site-detector.js");

test("a real HTTPS login page produces zero findings", () => {
  const result = analyzeSite({ url: "https://www.paypal.com/signin", hasPasswordField: true });
  assert.equal(result.findings.length, 0);
});

test("an ordinary HTTPS page with no login form produces zero findings", () => {
  const result = analyzeSite({ url: "https://www.nytimes.com/2026/09/05/article", hasPasswordField: false });
  assert.equal(result.findings.length, 0);
});

test("a password field over plain HTTP is flagged", () => {
  const result = analyzeSite({ url: "http://example.com/login", hasPasswordField: true });
  assert.ok(result.findings.some((f) => f.id === "insecure-password-form"));
});

test("no password field over HTTP is not flagged for that reason", () => {
  const result = analyzeSite({ url: "http://example.com/about", hasPasswordField: false });
  assert.ok(!result.findings.some((f) => f.id === "insecure-password-form"));
});

test("a password field over HTTPS is not flagged for that reason", () => {
  const result = analyzeSite({ url: "https://example.com/login", hasPasswordField: true });
  assert.ok(!result.findings.some((f) => f.id === "insecure-password-form"));
});

test("a raw IP address host is flagged", () => {
  const result = analyzeSite({ url: "http://192.168.1.50/login", hasPasswordField: false });
  assert.ok(result.findings.some((f) => f.id === "raw-ip-address"));
});

test("a punycode domain is flagged", () => {
  const result = analyzeSite({ url: "https://xn--pypal-4ve.com/login", hasPasswordField: false });
  assert.ok(result.findings.some((f) => f.id === "punycode-domain"));
});

test("an ordinary domain is not flagged as punycode", () => {
  const result = analyzeSite({ url: "https://www.wikipedia.org", hasPasswordField: false });
  assert.ok(!result.findings.some((f) => f.id === "punycode-domain"));
});

test("excessive hyphens in the hostname are flagged", () => {
  const result = analyzeSite({ url: "https://secure-account-login-verify-now.com", hasPasswordField: false });
  assert.ok(result.findings.some((f) => f.id === "excessive-hyphens"));
});

test("a domain with one ordinary hyphen is not flagged", () => {
  const result = analyzeSite({ url: "https://my-favorite-blog.com", hasPasswordField: false });
  // Note: "my-favorite-blog.com" has 2 hyphens, still under the threshold of 3.
  assert.ok(!result.findings.some((f) => f.id === "excessive-hyphens"));
});

test("a brand name in the URL that doesn't match the brand's real domain is flagged", () => {
  const result = analyzeSite({ url: "https://paypal-secure-verify.com/login", hasPasswordField: true });
  assert.ok(result.findings.some((f) => f.id === "url-brand-mismatch-paypal"));
});

test("the brand's actual real domain is not flagged as a mismatch", () => {
  const result = analyzeSite({ url: "https://www.paypal.com/signin", hasPasswordField: true });
  assert.ok(!result.findings.some((f) => f.id.startsWith("url-brand-mismatch")));
});

test("a legitimate subdomain of the real brand domain is not flagged", () => {
  const result = analyzeSite({ url: "https://notifications.paypal.com/receipt", hasPasswordField: false });
  assert.ok(!result.findings.some((f) => f.id.startsWith("url-brand-mismatch")));
});

test("page content claiming to be a brand on a mismatched domain is flagged", () => {
  const result = analyzeSite({
    url: "https://secure-login-portal.com/",
    hasPasswordField: true,
    pageBrandMentions: ["PayPal"],
  });
  assert.ok(result.findings.some((f) => f.id === "content-brand-mismatch-paypal"));
});

test("page content mentioning a brand on that brand's real domain is not flagged", () => {
  const result = analyzeSite({
    url: "https://www.paypal.com/signin",
    hasPasswordField: true,
    pageBrandMentions: ["PayPal"],
  });
  assert.ok(!result.findings.some((f) => f.id.startsWith("content-brand-mismatch")));
});

test("page content mentioning a brand not in the known-brands list is ignored, not flagged", () => {
  const result = analyzeSite({
    url: "https://some-small-blog.com/",
    hasPasswordField: false,
    pageBrandMentions: ["SomeObscureCompanyNotInOurList"],
  });
  assert.equal(result.findings.length, 0);
});

test("a malformed URL produces zero findings rather than throwing", () => {
  assert.doesNotThrow(() => analyzeSite({ url: "not a real url", hasPasswordField: true }));
  const result = analyzeSite({ url: "not a real url", hasPasswordField: true });
  assert.equal(result.findings.length, 0);
});

test("multiple genuine red flags on the same site all appear together", () => {
  const result = analyzeSite({
    url: "http://paypal-secure-account-verify-login-now.com/signin",
    hasPasswordField: true,
    pageBrandMentions: ["PayPal"],
  });
  const ids = result.findings.map((f) => f.id);

  assert.ok(ids.includes("insecure-password-form"));
  assert.ok(ids.includes("excessive-hyphens"));
  assert.ok(ids.includes("url-brand-mismatch-paypal"));
  assert.ok(ids.includes("content-brand-mismatch-paypal"));
});

require("node:test").describe("helper functions", () => {
  test("extractHostname lowercases the result", () => {
    assert.equal(extractHostname("https://WWW.Example.COM/x"), "www.example.com");
  });

  test("extractHostname returns null for a malformed URL", () => {
    assert.equal(extractHostname("not a url"), null);
  });

  test("registrableDomain takes the last two labels", () => {
    assert.equal(registrableDomain("notifications.paypal.com"), "paypal.com");
    assert.equal(registrableDomain("paypal.com"), "paypal.com");
  });

  test("isRawIp matches an IPv4-shaped hostname only", () => {
    assert.equal(isRawIp("192.168.1.1"), true);
    assert.equal(isRawIp("example.com"), false);
    assert.equal(isRawIp("999.999.999.999"), true); // shape-only check, documented limitation
  });

  test("isPunycode detects an xn-- label anywhere in the hostname", () => {
    assert.equal(isPunycode("xn--pypal-4ve.com"), true);
    assert.equal(isPunycode("sub.xn--80ak6aa92e.com"), true);
    assert.equal(isPunycode("example.com"), false);
  });
});
