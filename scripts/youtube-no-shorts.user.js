// ==UserScript==
// @name         No Shorts
// @description  Hides Shorts UI and turns /shorts/ links into normal watch pages
// @match        *://*.youtube.com/*
// @run-at       document-start
// @noframes
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // 1) Shorts URL -> normal player (no swipe feed)
  function redirectShorts() {
    var m = location.pathname.match(/^\/shorts\/([\w-]+)/);
    if (m) location.replace('/watch?v=' + m[1]);
  }

  // 2) CSS hiding (fast, runs before first paint)
  var style = document.createElement('style');
  style.textContent =
    'ytm-reel-shelf-renderer,' +
    'ytd-reel-shelf-renderer,' +
    'ytm-shorts-lockup-view-model,' +
    'ytm-shorts-lockup-view-model-v2,' +
    'ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model),' +
    'ytm-rich-section-renderer:has(ytm-reel-shelf-renderer),' +
    'ytm-pivot-bar-item-renderer:has(a[href^="/shorts"]),' +
    'ytd-guide-entry-renderer:has(a[title="Shorts"]),' +
    'ytd-mini-guide-entry-renderer[aria-label="Shorts"],' +
    'yt-tab-shape[tab-title="Shorts"],' +
    'a[href^="/shorts"] { display: none !important; }';
  document.documentElement.appendChild(style);

  // 3) JS sweep for things CSS cannot match (text-based)
  function hide(el) {
    el.style.setProperty('display', 'none', 'important');
  }

  function sweep() {
    document
      .querySelectorAll('ytm-pivot-bar-item-renderer, ytm-chip-cloud-chip-renderer, yt-chip-cloud-chip-renderer')
      .forEach(function (el) {
        if (el.textContent.trim().toLowerCase() === 'shorts') hide(el);
      });
  }

  // 4) Keep up with YouTube's SPA navigation and lazy rendering
  var scheduled = false;
  new MutationObserver(function () {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      sweep();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  var lastHref = '';
  setInterval(function () {
    if (location.href !== lastHref) {
      lastHref = location.href;
      redirectShorts();
    }
  }, 300);

  redirectShorts();
})();
