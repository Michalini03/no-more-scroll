// ==UserScript==
// @name         No Reels
// @description  Hides Reels nav, redirects feeds home (Explore to search), locks swiping inside reel viewers, Following feed only
// @match        *://*.instagram.com/*
// @run-at       document-start
// @noframes
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  var BLOCK_EXPLORE = true;
  var DEBUG = false;

  var BLOCKED_PATH = BLOCK_EXPLORE
    ? /^\/(reels\/?|explore(\/.*)?)$/
    : /^\/reels\/?$/;

  var SEARCH_PATH = '/explore/search/';
  var EXPLORE_ROOT = /^\/explore\/?$/;

  function isSearchPath(p) {
    return /^\/explore\/search(\/|$)/.test(p);
  }

  var LINK_SELECTOR = 'a[href="/reels/"], a[href="/reels"]';

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
    if (BLOCK_EXPLORE && isSearchPath(location.pathname)) return;
    if (BLOCK_EXPLORE && EXPLORE_ROOT.test(location.pathname)) {
      location.replace(SEARCH_PATH);
      return;
    }
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

  // ---------- Search icon goes straight to search ----------
  // The app's router would open the Explore grid first; load the search page instead.
  if (BLOCK_EXPLORE) {
    document.addEventListener('click', function (e) {
      var a = e.target instanceof Element && e.target.closest('a[href]');
      if (!a || !EXPLORE_ROOT.test(a.getAttribute('href'))) return;
      e.preventDefault();
      e.stopPropagation();
      location.assign(SEARCH_PATH);
    }, true);
  }

  // ---------- Hide posts from accounts you do not follow ----------
  // Czech words are written as unicode escapes to keep this file pure ASCII.
  var FOLLOW_WORDS = ['follow', 'sledovat'];
  var LABELS = [
    'suggested', 'suggested for you', 'sponsored',
    'navrhov\u00e1no', 'navrhov\u00e1no pro v\u00e1s',
    'doporu\u010deno', 'doporu\u010deno pro v\u00e1s',
    'sponzorov\u00e1no', 'reklama'
  ];

  // A profile link is a single path segment such as /someone/ (not /explore/..., /p/..., /reels/...)
  var NOT_PROFILES = ['explore', 'reels', 'reel', 'p', 'direct', 'stories', 'accounts', 'tv', 'about', 'legal'];
  function profileNames(header) {
    var seen = {};
    var links = header.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var m = (links[i].getAttribute('href') || '').match(/^\/([A-Za-z0-9._]+)\/?$/);
      if (m && NOT_PROFILES.indexOf(m[1].toLowerCase()) === -1) seen[m[1].toLowerCase()] = true;
    }
    return Object.keys(seen);
  }

  function isForeignPost(article) {
    // Only look in the post header. Without one, leave the post alone:
    // searching the whole post also hits captions and comments.
    var header = article.querySelector('header');
    if (!header) return false;
    // Collaboration post: several accounts in the header. The Follow button then usually
    // belongs to a co-author, so it must not hide the post. Labels still apply.
    var isCollab = profileNames(header).length >= 2;
    var candidates = header.querySelectorAll('button, div[role="button"], span');
    for (var i = 0; i < candidates.length; i++) {
      var t = (candidates[i].textContent || '').trim().toLowerCase();
      if (!t || t.length > 40) continue;
      if (!isCollab && FOLLOW_WORDS.indexOf(t) !== -1) return true;
      if (LABELS.indexOf(t) !== -1) return true;
    }
    return false;
  }

  function hidePost(a) {
    a.style.setProperty('display', 'none', 'important');
    if (DEBUG) console.log('hid post');
  }

  // Only the home feed. Profiles and post pages (/p/<id>) also render posts as
  // <article>, and hiding those left a black screen when opening a post.
  function isHomeFeed() {
    return location.pathname === '/';
  }

  function sweepPosts() {
    if (!isHomeFeed()) return;
    var articles = document.querySelectorAll('article:not([data-ig-checked])');
    articles.forEach(function (a) {
      if (isForeignPost(a)) hidePost(a);
      a.setAttribute('data-ig-checked', '1');
      // Headers may render lazily, so check again shortly after
      setTimeout(function () {
        if (isHomeFeed() && isForeignPost(a)) hidePost(a);
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
