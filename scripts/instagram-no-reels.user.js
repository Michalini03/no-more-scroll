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
  var FORCE_FOLLOWING = true;
  var HIDE_SUGGESTED_POSTS = true;
  var DEBUG = false;

  var BLOCKED_PATH = BLOCK_EXPLORE
    ? /^\/(reels\/?|explore(\/.*)?)$/
    : /^\/reels\/?$/;

  var SEARCH_PATH = '/explore/search/';
  var EXPLORE_ROOT = /^\/explore\/?$/;

  function isSearchPath(p) {
    return /^\/explore\/search(\/|$)/.test(p);
  }

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
    if (!(target instanceof Element)) return null;
    if (target.closest && target.closest('textarea, input, [contenteditable="true"]')) return null;
    if (isSingleReelUrl()) return document.body;
    return findReelViewer(target);
  }

  // Let non-video panels scroll, but block gestures at their edges so they
  // cannot chain into the next reel. Video containers remain locked.
  function canScrollPanel(target, viewer, dx, dy) {
    var horizontal = Math.abs(dx) > Math.abs(dy);
    var delta = horizontal ? dx : dy;
    for (var el = target; el && el !== viewer && el !== document.body; el = el.parentElement) {
      if (el.tagName === 'VIDEO' || el.querySelector('video')) continue;
      var cs = getComputedStyle(el);
      var overflow = horizontal ? cs.overflowX : cs.overflowY;
      if (!/^(auto|scroll)$/.test(overflow)) continue;
      var position = horizontal ? el.scrollLeft : el.scrollTop;
      var size = horizontal ? el.clientWidth : el.clientHeight;
      var extent = horizontal ? el.scrollWidth : el.scrollHeight;
      if ((delta < 0 && position > 0) || (delta > 0 && position + size < extent - 1)) return true;
    }
    return false;
  }

  var touchX = null;
  var touchY = null;
  document.addEventListener('touchstart', function (e) {
    touchX = e.touches.length === 1 ? e.touches[0].clientX : null;
    touchY = e.touches.length === 1 ? e.touches[0].clientY : null;
  }, { passive: true, capture: true });

  function blocker(e) {
    // Preserve pinch zoom and track each move, including moves in comments.
    if (e.ctrlKey) return;
    var dx = e.deltaX || 0;
    var dy = e.deltaY || 0;
    if (e.touches) {
      if (e.touches.length !== 1) {
        touchX = touchY = null;
        return;
      }
      dx = touchX === null ? 0 : touchX - e.touches[0].clientX;
      dy = touchY === null ? 0 : touchY - e.touches[0].clientY;
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    }
    var viewer = isLockedTarget(e.target);
    if (!viewer) return;
    if (canScrollPanel(e.target, viewer, dx, dy)) return;
    e.preventDefault();
    e.stopPropagation();
    if (DEBUG && viewer !== document.body) viewer.style.outline = '3px solid red';
  }
  document.addEventListener('touchmove', blocker, { passive: false, capture: true });
  document.addEventListener('wheel', blocker, { passive: false, capture: true });

  var style = document.createElement('style');
  style.textContent =
    'html.ig-single-reel, html.ig-single-reel body { overflow: hidden !important; overscroll-behavior: none !important; }' +
    'a[href="/reels/"], a[href="/reels"], a[href^="/reels/?"], a[href^="/reels?"] { display: none !important; }' +
    'html.ig-home-feed article[data-ig-hidden-post] { display: none !important; }';
  document.documentElement.appendChild(style);

  function syncPageState() {
    document.documentElement.classList.toggle('ig-single-reel', isSingleReelUrl());
    document.documentElement.classList.toggle('ig-home-feed', HIDE_SUGGESTED_POSTS && isHomeFeed());
  }

  // ---------- Redirects ----------
  function safeGet(k) {
    try { return sessionStorage.getItem(k); } catch (e) { return null; }
  }
  function safeSet(k, v) {
    try { sessionStorage.setItem(k, v); return true; } catch (e) { return false; }
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
    if (FORCE_FOLLOWING && location.pathname === '/' && !/(?:[?&])variant=following(?:&|$)/.test(location.search)) {
      var last = Number(safeGet('ig-follow-redirect') || 0);
      if (Date.now() - last > 10000 && safeSet('ig-follow-redirect', String(Date.now()))) {
        var url = new URL(location.href);
        url.searchParams.set('variant', 'following');
        location.replace(url.href);
      }
    }
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
    var seen = Object.create(null);
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

  // Only the home feed. Profiles and post pages (/p/<id>) also render posts as
  // <article>, and hiding those left a black screen when opening a post.
  function isHomeFeed() {
    return location.pathname === '/';
  }

  function sweepPosts() {
    if (!HIDE_SUGGESTED_POSTS || !isHomeFeed()) return;
    var articles = document.querySelectorAll('article');
    articles.forEach(function (a) {
      // Recheck lazy headers and recycled articles. CSS only hides them on home.
      if (isForeignPost(a)) {
        if (!a.hasAttribute('data-ig-hidden-post')) {
          a.setAttribute('data-ig-hidden-post', '');
          if (DEBUG) console.log('hid post');
        }
      } else {
        a.removeAttribute('data-ig-hidden-post');
      }
    });
  }

  var scheduled = false;
  function scheduleSweep() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      sweepPosts();
    });
  }
  new MutationObserver(scheduleSweep).observe(document.documentElement, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['href', 'role']
  });

  var lastHref = '';
  setInterval(function () {
    if (location.href !== lastHref) {
      lastHref = location.href;
      redirectIfBlocked();
      syncPageState();
      scheduleSweep();
    }
  }, 300);

  redirectIfBlocked();
  syncPageState();
  scheduleSweep();
})();
