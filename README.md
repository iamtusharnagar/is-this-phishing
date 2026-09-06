# Is This Phishing?

A browser extension that checks the site you're currently on for common
phishing patterns. Runs entirely on your device — nothing about the pages
you visit is ever sent anywhere.

## Install (unpacked, for now)

This isn't published to the Chrome Web Store yet.

1. Download or clone this repository.
2. Go to `chrome://extensions`, turn on "Developer mode" (top right).
3. Click "Load unpacked" and select this folder.
4. Visit any page — the toolbar icon shows a number badge if it finds
   anything worth a second look. Click the icon for details.

## What it checks

Looking only at the current page, entirely locally:

- **A password field on a page that isn't using a secure connection.**
  Real login pages you'd trust with a password should always be `https://`.
- **A raw numeric address** instead of a normal web address.
- **A punycode address** (one that can display letters from other alphabets
  that look identical to familiar ones — a known trick for imitating a
  trusted site's name).
- **An unusual number of hyphens** in the address, a common way to imitate
  a real company's domain.
- **A brand name in the address that doesn't actually belong to that
  brand** (e.g. `paypal-secure-verify.com`).
- **A page that presents itself as a well-known company** (in its title or
  a main heading) **on an address that isn't that company's real site.**

## What it deliberately does not do

- **It doesn't claim certainty.** "No warning signs found" means the page
  didn't match the patterns this extension knows about — not that the page
  is confirmed safe. A flagged page isn't automatically confirmed unsafe
  either; use judgment.
- **It doesn't check against any external phishing database**, and never
  makes a network request of any kind. That's a deliberate trade-off: a
  live database can catch more, but it also means every site you visit
  gets reported to a third party. This extension only recognizes patterns
  it can see for itself.
- **It doesn't block or modify anything.** It observes and informs; it
  never stops a page from loading or interferes with a form.
- **It only looks at the page's title and main headings for brand
  impersonation**, not the entire visible text — an article that merely
  *mentions* PayPal shouldn't be treated the same as a page pretending
  *to be* PayPal. See the comment in `page-signals.js` for the reasoning.

## About the permissions this asks for

Being upfront about this matters more here than for most tools: to check
every page automatically, this extension asks for permission to read the
pages you visit (`host_permissions` for `http://*/*` and `https://*/*`).
That's a real, significant grant of access, and Chrome will show you a
corresponding warning at install time. In exchange, it never makes a
network request — you can verify this yourself by reading `content.js`,
`background.js`, and `popup/popup.js` in full; there is no `fetch`, no
`XMLHttpRequest`, nothing.

## Verified, honestly

No real browser was available in the sandbox this was built in — loading
this as an actual unpacked extension in Chrome and clicking through it
live could not be done here. Here's what *was* verified, and what wasn't:

**Verified for real:**
- 53 tests: the detection logic (`site-detector.js`) tested directly with
  honest false-positive checks (a real login page, an ordinary news
  article, a page that merely mentions a brand in passing); the page-
  scanning logic (`page-signals.js`) tested with `jsdom` against
  constructed HTML simulating both realistic phishing pages and realistic
  legitimate pages; the popup's rendering logic tested with `jsdom`
  against a mocked `chrome.*` API, including a direct check that a
  malicious-looking finding label renders as inert text, not markup.
- `manifest.json` validated two ways: a hand-written structural test suite
  (every field checked against Manifest V3's actual current requirements,
  researched directly rather than assumed) and Mozilla's official
  `addons-linter` (the same tool used to review real extension
  submissions). The linter caught a genuine issue during development --
  see below.
- A real bug caught by the linter, not by me: `popup.js` originally built
  its results view via `innerHTML` with manually escaped values. The
  linter flagged this as a class of risk worth eliminating outright rather
  than trusting the escaping to stay correct forever, so it was rewritten
  to build DOM nodes directly via `createElement`/`textContent` --
  structurally safe rather than defensively safe. A regression test now
  confirms `popup.js` contains no `innerHTML` assignment at all.

**Not verified:**
- The extension has never been loaded into an actual browser. Chrome's own
  runtime behavior (service worker lifecycle, message passing timing, the
  install-time permission prompt) could not be exercised for real. If you
  load it and something doesn't work as described, that's the gap to
  report first.
- `npm run lint` also reports three Firefox-specific findings (an add-on
  ID, a Firefox data-collection-permissions field, and a Firefox-only
  background-page fallback). These are real requirements for submitting to
  Mozilla's addon store, not for a Chrome extension, and don't apply here
  -- included for transparency about what the linter reports, not hidden.
- One dev-only dependency (`addons-linter`, used only for the `lint`
  script above) transitively depends on a package with a known
  denial-of-service vulnerability in image parsing. It is never bundled
  into the extension itself and only matters if you lint a maliciously
  crafted icon file, which isn't part of normal use here.

## Why a separate copy of the brand/URL logic from second-look

[second-look](https://github.com/tusharnagar2002/second-look) has similar
URL-analysis logic for a different context (a pasted message, not a live
page). Rather than a cross-repo dependency between two small,
independently-versioned projects, this repo keeps its own copy, adapted to
what a live page can actually tell you (a password field, the page's own
title/headings) that pasted text can't.

## Contributing

```bash
git clone https://github.com/tusharnagar2002/is-this-phishing.git
cd is-this-phishing
npm install
npm test
npm run lint   # informational; see the Firefox-specific note above
```

## License

MIT
