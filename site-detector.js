/**
 * Pure site-analysis logic. No chrome.* API, no DOM dependency here --
 * takes plain data (a URL and a few facts about the page) and returns
 * findings. This is the part that can be wrong in a way that matters, so
 * it's the part tested directly and exhaustively, the same way
 * second-look's scam-detector.js is.
 *
 * This is a heuristic, not a verdict. See README.md#what-this-does-not-do.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SiteDetector = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Recognizable brand names commonly impersonated by phishing sites.
  // Shared shape with second-look's list, kept as a separate copy in this
  // repo rather than a cross-repo dependency -- see README.md#why-a-separate-copy.
  const KNOWN_BRANDS = {
    paypal: ["paypal.com"],
    amazon: ["amazon.com", "amazon.co.uk", "amazon.ca", "amazon.de", "amazon.in"],
    apple: ["apple.com", "icloud.com"],
    microsoft: ["microsoft.com", "live.com", "outlook.com"],
    netflix: ["netflix.com"],
    google: ["google.com", "accounts.google.com"],
    facebook: ["facebook.com"],
    instagram: ["instagram.com"],
    bankofamerica: ["bankofamerica.com"],
    wellsfargo: ["wellsfargo.com"],
    chase: ["chase.com"],
    usps: ["usps.com"],
    fedex: ["fedex.com"],
  };

  function extractHostname(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  function isRawIp(hostname) {
    return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  }

  function isPunycode(hostname) {
    return hostname.split(".").some((label) => label.startsWith("xn--"));
  }

  function registrableDomain(hostname) {
    // Deliberately simple approximation (last two labels) -- documented
    // limitation, not silently assumed correct for every TLD. Same
    // approach and same honest caveat as second-look.
    const parts = hostname.split(".");
    return parts.length >= 2 ? parts.slice(-2).join(".") : hostname;
  }

  function brandsMentionedInHostname(hostname) {
    return Object.keys(KNOWN_BRANDS).filter((brand) => hostname.includes(brand));
  }

  function isBrandsRealDomain(brand, domain) {
    return KNOWN_BRANDS[brand] && KNOWN_BRANDS[brand].includes(domain);
  }

  /**
   * @param {object} input
   * @param {string} input.url - the page's current URL
   * @param {boolean} input.hasPasswordField - whether the page has a
   *   password input, as observed by the content script
   * @param {string[]} [input.pageBrandMentions] - brand names found in the
   *   page's own title/headings text, as observed by the content script
   * @returns {{findings: Array<{id: string, label: string, explanation: string}>}}
   */
  function analyzeSite(input) {
    const { url, hasPasswordField = false, pageBrandMentions = [] } = input;
    const findings = [];

    const hostname = extractHostname(url);
    if (!hostname) {
      return { findings: [] };
    }

    const isHttps = url.toLowerCase().startsWith("https://");
    const domain = registrableDomain(hostname);

    if (hasPasswordField && !isHttps) {
      findings.push({
        id: "insecure-password-form",
        label: "This page asks for a password but the connection isn't secure",
        explanation:
          "Anything you type here, including your password, could potentially be seen by others on the network. A real login page for an account that matters should always use a secure (https://) connection.",
      });
    }

    if (isRawIp(hostname)) {
      findings.push({
        id: "raw-ip-address",
        label: "This site's address is a raw number, not a normal web address",
        explanation:
          "Legitimate sites you'd log into essentially never use a plain numeric address like this. It's a pattern much more common in phishing pages.",
      });
    }

    if (isPunycode(hostname)) {
      findings.push({
        id: "punycode-domain",
        label: "This address uses characters that may not be what they appear to be",
        explanation:
          "This kind of address can display letters from other alphabets that look identical to familiar ones (for example, a Cyrillic \"a\" that looks just like an English \"a\"), which is a known trick for imitating a trusted site's name.",
      });
    }

    const hyphenCount = (hostname.match(/-/g) || []).length;
    if (hyphenCount >= 3) {
      findings.push({
        id: "excessive-hyphens",
        label: "This web address has an unusually large number of hyphens",
        explanation:
          "This is a pattern often used to imitate a real company's name, e.g. \"secure-account-login-verify-now.com\".",
      });
    }

    for (const brand of brandsMentionedInHostname(hostname)) {
      if (!isBrandsRealDomain(brand, domain)) {
        findings.push({
          id: `url-brand-mismatch-${brand}`,
          label: `This address mentions "${brand}" but isn't ${brand}'s real site`,
          explanation: `The web address contains "${brand}" but doesn't actually belong to ${brand}. This is a common way to look official at a glance.`,
        });
      }
    }

    for (const brand of pageBrandMentions) {
      const normalizedBrand = brand.toLowerCase().replace(/\s+/g, "");
      if (KNOWN_BRANDS[normalizedBrand] && !isBrandsRealDomain(normalizedBrand, domain)) {
        findings.push({
          id: `content-brand-mismatch-${normalizedBrand}`,
          label: `This page presents itself as ${brand}, but the address doesn't match`,
          explanation: `The page's own text refers to itself as ${brand}, but you're not actually on ${brand}'s real website. Real companies' pages and addresses always match.`,
        });
      }
    }

    return { findings };
  }

  return { analyzeSite, extractHostname, registrableDomain, isRawIp, isPunycode, KNOWN_BRANDS };
});
