// ==UserScript==
// @name         No Reels
// @description  Hides Reels/Explore nav, redirects feeds home, locks swiping inside reel viewers, Following feed only
// @match        *://*.instagram.com/*
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  var BLOCK_EXPLORE = true;
  var DEBUG = false;

  var BLOCKED_PATH = BLOCK_EXPLORE
    ? /^\/(reels\/?|explore(\/.*)?)$/
    : /^\/reels\/?$/;

  var LINK_SELECTOR = BLOCK_EXPLORE
    ? 'a[href="/reels/"], a[href="/reels"], a[href="/explore/"], a[href="/explore"]'
    : 'a[href="/reels/"], a[href="/reels"]';

  function isSingleReelUrl() {
    return /^\/reels?\/[^/]+/.test(location.pathname);
  }

  // ---------- Reel viewer swipe lock ----------
  function findReelViewer(target) {
    if (!(target instanceof Element)) return null;
    var el = target;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.querySelector && el.querySelector('video')) {
        var cs = getComputedStyle(el);
        var r = el.getBoundingClientRect();
        var covers = r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.8;
        var overlay = cs.position === 'fixed' || el.getAttribute('role') === 'dialog';
        if (covers && overlay) return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function isLockedTarget(target) {
    if (target.closest && target.closest('textarea, input, [contenteditable="true"]')) return null;
    if (isSingleReelUrl()) return document.body;
    return findReelViewer(target);
  }

  function blocker(e) {
    var viewer = isLockedTarget(e.target);
    if (!viewer) return;
    e.preventDefault();
    e.stopPropagation();
    if (DEBUG && viewer !== document.body) viewer.style.outline = '3px solid red';
  }
  document.addEventListener('touchmove', blocker, { passive: false, capture: true });
  document.addEventListener('wheel', blocker, { passive: false, capture: true });

  var style = document.createElement('style');
  style.textContent =
    'html.ig-single-reel, html.ig-single-reel body { overflow: hidden !important; overscroll-behavior: none !important; }' +
    'html.ig-single-reel * { scroll-snap-type: none !important; }';
  document.documentElement.appendChild(style);

  function syncReelLock() {
    document.documentElement.classList.toggle('ig-single-reel', isSingleReelUrl());
  }

  // ---------- Redirects ----------
  function safeGet(k) {
    try { return sessionStorage.getItem(k); } catch (e) { return null; }
  }
  function safeSet(k, v) {
    try { sessionStorage.setItem(k, v); } catch (e) {}
  }

  function redirectIfBlocked() {
    if (BLOCKED_PATH.test(location.pathname)) {
      location.replace('/');
      return;
    }
    // Home -> Following feed. Cooldown prevents redirect loops.
    if (location.pathname === '/' && !/variant=following/.test(location.search)) {
      var last = Number(safeGet('ig-follow-redirect') || 0);
      if (Date.now() - last > 10000) {
        safeSet('ig-follow-redirect', String(Date.now()));
        location.replace('/?variant=following');
      }
    }
  }

  // ---------- Hide nav links ----------
  function hideItem(a) {
    var el = a;
    while (el.parentElement && el.parentElement !== document.body && el.parentElement.children.length === 1) {
      el = el.parentElement;
    }
    el.style.setProperty('display', 'none', 'important');
  }

  // ---------- Hide posts from accounts you do not follow ----------
  // Czech words are written as unicode escapes to keep this file pure ASCII.
  var FOLLOW_WORDS = ['follow', 'sledovat'];
  var LABELS = ['suggested', 'sponsored', 'navrhov\u00e1no', 'doporu\u010deno', 'sponzorov\u00e1no', 'reklama'];

  function isForeignPost(article) {
    var header = article.querySelector('header') || article;
    var candidates = header.querySelectorAll('button, div[role="button"], span');
    for (var i = 0; i < candidates.length; i++) {
      var t = (candidates[i].textContent || '').trim().toLowerCase();
      if (!t || t.length > 40) continue;
      if (FOLLOW_WORDS.indexOf(t) !== -1) return true;
      for (var j = 0; j < LABELS.length; j++) {
        if (t.indexOf(LABELS[j]) !== -1) return true;
      }
    }
    return false;
  }

  function hidePost(a) {
    a.style.setProperty('display', 'none', 'important');
    if (DEBUG) console.log('hid post');
  }

  function sweepPosts() {
    var articles = document.querySelectorAll('article:not([data-ig-checked])');
    articles.forEach(function (a) {
      if (isForeignPost(a)) hidePost(a);
      a.setAttribute('data-ig-checked', '1');
      // Headers may render lazily, so check again shortly after
      setTimeout(function () {
        if (isForeignPost(a)) hidePost(a);
      }, 1500);
    });
  }

  function sweep() {
    document.querySelectorAll(LINK_SELECTOR).forEach(hideItem);
    sweepPosts();
  }

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
      redirectIfBlocked();
      syncReelLock();
    }
  }, 300);

  redirectIfBlocked();
  syncReelLock();
})();
