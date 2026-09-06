"use strict";

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderNoData() {
  const content = document.getElementById("content");
  clearChildren(content);
  content.appendChild(
    el(
      "p",
      null,
      "No information yet for this page. Try reloading it, or this may be a page type (like a browser settings page) this extension can't check."
    )
  );
}

function render(result, url) {
  document.getElementById("meta").textContent = url;

  const content = document.getElementById("content");
  clearChildren(content);

  const total = result.findings.length;

  if (total === 0) {
    const verdict = el("div", "verdict clear", "No common warning signs found on this page.");
    verdict.appendChild(
      el(
        "p",
        null,
        "This doesn't guarantee the page is genuine -- only that it didn't match the patterns this extension knows to look for."
      )
    );
    content.appendChild(verdict);
    return;
  }

  const noun = total === 1 ? "warning sign" : "warning signs";
  const verdict = el("div", "verdict caution", `${total} ${noun} found on this page.`);
  verdict.appendChild(el("p", null, "Worth a closer look before entering any personal information here."));
  content.appendChild(verdict);

  for (const finding of result.findings) {
    const item = el("div", "finding");
    item.appendChild(el("p", "finding-label", finding.label));
    item.appendChild(el("p", "finding-explanation", finding.explanation));
    content.appendChild(item);
  }
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) {
    renderNoData();
    return;
  }

  const key = `tab-${tab.id}`;
  const stored = await chrome.storage.session.get(key);
  const result = stored[key];

  if (!result) {
    renderNoData();
    return;
  }

  render(result, tab.url || "");
}

main();
