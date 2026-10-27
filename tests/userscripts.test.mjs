import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { startBrowser } from './browser.mjs';

const instagram = await readFile(new URL('../scripts/instagram-no-reels.user.js', import.meta.url), 'utf8');
const youtube = await readFile(new URL('../scripts/youtube-no-shorts.user.js', import.meta.url), 'utf8');
const filters = await readFile(new URL('../filters/brave.txt', import.meta.url), 'utf8');
let browser;
before(async () => { browser = await startBrowser(); });
after(async () => { await browser?.close(); });

async function fixture(path, html, source = instagram) {
  await browser.navigate(path);
  await browser.evaluate(`document.body.innerHTML = ${JSON.stringify(html)}`);
  await browser.evaluate(source);
}

function disable(source, flag) {
  assert(source.includes(`var ${flag} = true;`), 'Missing feature flag: ' + flag);
  return source.replace(`var ${flag} = true;`, `var ${flag} = false;`);
}

test('userscripts retain ASCII and required unique metadata', () => {
  const names = new Set();
  for (const source of [instagram, youtube]) {
    assert(!/[^\x00-\x7F]/.test(source));
    const header = source.match(/^\/\/ ==UserScript==\n([\s\S]*?)^\/\/ ==\/UserScript==/m)?.[1];
    assert(header);
    for (const field of ['name', 'description', 'match', 'noframes']) {
      assert(new RegExp('^//\\s+@' + field + '(?:\\s|$)', 'm').test(header));
    }
    assert(/^\/\/\s+@run-at\s+document-start\s*$/m.test(header));
    assert(/^\/\/\s+@license\s+MIT\s*$/m.test(header));
    names.add(header.match(/@name\s+([^\n]+)/)[1]);
  }
  assert.equal(names.size, 2);
});

test('Instagram navigation never hides the app during incremental rendering', async () => {
  await fixture('/?variant=following', '<main id="app"><nav><a href="/reels/">Reels</a></nav></main>');
  // A late mutation also exercises scripts injected after the initial DOM exists.
  await browser.evaluate('document.body.appendChild(document.createElement("aside"))');
  await browser.waitFor('getComputedStyle(document.querySelector("nav a")).display === "none"');
  await browser.evaluate('document.querySelector("main").insertAdjacentHTML("beforeend", "<article>A followed post</article>")');
  assert.equal(await browser.evaluate('document.querySelector("article").getClientRects().length > 0'), true);
  await browser.evaluate('document.querySelector("nav a").href = "/explore/search/"');
  await browser.waitFor('getComputedStyle(document.querySelector("nav a")).display !== "none"');
});

test('Instagram catches a late sponsored header after the old 1.5 second window', async () => {
  await fixture('/?variant=following', '<article id="late"></article><article id="control"><header><span>Sponsored</span></header></article>');
  await browser.evaluate('document.body.appendChild(document.createElement("aside"))');
  await browser.waitFor('getComputedStyle(document.querySelector("#control")).display === "none"');
  await delay(1700);
  await browser.evaluate('document.querySelector("#late").innerHTML = "<header><span>Sponsored</span></header>"');
  await browser.waitFor('getComputedStyle(document.querySelector("#late")).display === "none"');
});

test('Instagram rechecks recycled articles and text-only header changes', async () => {
  await fixture('/?variant=following', '<article><header><span>Sponsored</span></header></article>');
  await browser.waitFor('getComputedStyle(document.querySelector("article")).display === "none"');
  await browser.evaluate('document.querySelector("header span").firstChild.data = "Following"');
  await browser.waitFor('getComputedStyle(document.querySelector("article")).display !== "none"');
  await browser.evaluate('document.querySelector("header span").firstChild.data = "Suggested for you"');
  await browser.waitFor('getComputedStyle(document.querySelector("article")).display === "none"');
});

test('Instagram only filters home, restoring visibility across SPA navigation', async () => {
  await fixture('/?variant=following', '<article><header><button>Follow</button></header></article>');
  await browser.waitFor('getComputedStyle(document.querySelector("article")).display === "none"');
  await browser.evaluate('history.pushState({}, "", "/p/shared-post/")');
  await browser.waitFor('getComputedStyle(document.querySelector("article")).display !== "none"');
  await browser.evaluate('history.pushState({}, "", "/?variant=following")');
  await browser.waitFor('getComputedStyle(document.querySelector("article")).display === "none"');
});

test('Instagram preserves captions, headerless articles and collaboration posts', async () => {
  await fixture('/?variant=following', '<article id="caption"><header>Friend</header><span>Sponsored</span></article><article id="noheader"><button>Follow</button></article><article id="collab"><header><a href="/alice/">Alice</a><a href="/bob/">Bob</a><button>Follow</button></header></article><article id="ad"><header><span>Sponsored</span></header></article>');
  await browser.waitFor('getComputedStyle(document.querySelector("#ad")).display === "none"');
  assert.deepEqual(await browser.evaluate('["caption", "noheader", "collab"].map(id => getComputedStyle(document.getElementById(id)).display !== "none")'), [true, true, true]);
});

test('Instagram filtering and Following redirect can be independently disabled', async () => {
  await fixture('/?variant=following', '<article><header><span>Sponsored</span></header></article>', disable(instagram, 'HIDE_SUGGESTED_POSTS'));
  await delay(350);
  assert.equal(await browser.evaluate('getComputedStyle(document.querySelector("article")).display !== "none"'), true);
  await fixture('/?keep=1', '', disable(instagram, 'FORCE_FOLLOWING'));
  await delay(350);
  assert.equal(await browser.evaluate('location.search'), '?keep=1');
});

test('Instagram Following redirect preserves other parameters and stores its cooldown', async () => {
  await fixture('/?keep=1#anchor', '');
  await browser.waitFor('new URL(location.href).searchParams.get("variant") === "following"');
  assert.equal(await browser.evaluate('new URL(location.href).searchParams.get("keep")'), '1');
  assert.equal(await browser.evaluate('location.hash'), '#anchor');
  assert.equal(await browser.evaluate('Number(sessionStorage.getItem("ig-follow-redirect")) > 0'), true);
});

test('Instagram Following redirect honors cooldown and skips unavailable storage', async () => {
  await browser.navigate('/');
  await browser.evaluate('sessionStorage.setItem("ig-follow-redirect", String(Date.now()))');
  await browser.evaluate(instagram);
  await delay(350);
  assert.equal(await browser.evaluate('location.search'), '');
  await browser.navigate('/');
  await browser.evaluate('void Object.defineProperty(window, "sessionStorage", {get: function () { throw new Error("Storage denied"); }})');
  await browser.evaluate(instagram);
  await delay(350);
  assert.equal(await browser.evaluate('location.search'), '');
});

test('Instagram redirects blocked feeds while keeping search and shared reel URLs', async () => {
  const withoutFollowing = disable(instagram, 'FORCE_FOLLOWING');
  for (const [path, expected] of [
    ['/reels/?igsh=abc', '/'], ['/reels?igsh=abc', '/'],
    ['/explore/', '/explore/search/'], ['/explore/tags/example/', '/'],
    ['/explore/search/', '/explore/search/'],
    ['/reel/shared-id/', '/reel/shared-id/'], ['/reels/shared-id/', '/reels/shared-id/']
  ]) {
    await fixture(path, '', withoutFollowing);
    await browser.waitFor(`location.pathname === ${JSON.stringify(expected)}`);
  }
  await fixture('/explore/', '', disable(instagram, 'BLOCK_EXPLORE'));
  await delay(350);
  assert.equal(await browser.evaluate('location.pathname'), '/explore/');
});

test('Instagram comments scroll, but reel swipes and scroll chaining stay blocked', async () => {
  for (const path of ['/reel/shared-id/', '/direct/t/friend/']) {
    await fixture(path, '<div role="dialog" style="position:fixed;inset:0"><video></video><section id="comments" style="height:100px;overflow-y:auto"><div style="height:1000px"><span id="comment">Comment</span><textarea></textarea></div></section></div>');
    const result = await browser.evaluate(`(() => {
      const panel = document.querySelector('#comments');
      const target = document.querySelector('#comment');
      function wheel(el, deltaY, extra) {
        const event = new WheelEvent('wheel', Object.assign({deltaY, bubbles:true, cancelable:true}, extra));
        el.dispatchEvent(event);
        return event.defaultPrevented;
      }
      const downward = wheel(target, 50);
      const topEdge = wheel(target, -50);
      panel.scrollTop = panel.scrollHeight;
      const bottomEdge = wheel(target, 50);
      const upward = wheel(target, -50);
      const reel = wheel(document.querySelector('video'), 50);
      const editable = wheel(document.querySelector('textarea'), 50);
      const zoom = wheel(target, 50, {ctrlKey:true});
      function touch(type, points) {
        const event = new Event(type, {bubbles:true, cancelable:true});
        Object.defineProperty(event, 'touches', {value:points});
        target.dispatchEvent(event);
        return event.defaultPrevented;
      }
      panel.scrollTop = 0;
      touch('touchstart', [{clientX:0, clientY:100}]);
      const touchInPanel = touch('touchmove', [{clientX:0, clientY:50}]);
      panel.scrollTop = panel.scrollHeight;
      const touchAtEdge = touch('touchmove', [{clientX:0, clientY:0}]);
      const pinch = touch('touchmove', [{clientX:0, clientY:0}, {clientX:50, clientY:0}]);
      return {downward, topEdge, bottomEdge, upward, reel, editable, zoom, touchInPanel, touchAtEdge, pinch};
    })()`);
    assert.deepEqual(result, { downward:false, topEdge:true, bottomEdge:true, upward:false, reel:true, editable:false, zoom:false, touchInPanel:false, touchAtEdge:true, pinch:false }, path);
  }
});

test('YouTube shared links remain visible while Shorts shelves and navigation hide', async () => {
  await fixture('/watch?v=normal', '<p><a id="shared" href="/shorts/shared-id">Watch this</a></p><ytm-reel-shelf-renderer><a href="/shorts/next">Next</a></ytm-reel-shelf-renderer><ytm-pivot-bar-item-renderer><a href="/shorts/">Shorts</a></ytm-pivot-bar-item-renderer>', youtube);
  assert.deepEqual(await browser.evaluate('[document.querySelector("#shared"), document.querySelector("ytm-reel-shelf-renderer"), document.querySelector("ytm-pivot-bar-item-renderer")].map(el => el.getClientRects().length > 0)'), [true, false, false]);
});

test('YouTube sweeps existing chips and rechecks text changes on recycled chips', async () => {
  await fixture('/watch?v=normal', '<ytm-chip-cloud-chip-renderer>Shorts</ytm-chip-cloud-chip-renderer>', youtube);
  await browser.waitFor('getComputedStyle(document.querySelector("ytm-chip-cloud-chip-renderer")).display === "none"');
  await browser.evaluate('document.querySelector("ytm-chip-cloud-chip-renderer").firstChild.data = "Music"');
  await browser.waitFor('getComputedStyle(document.querySelector("ytm-chip-cloud-chip-renderer")).display !== "none"');
});

test('YouTube redirects direct and SPA Shorts URLs into the regular player', async () => {
  await fixture('/shorts/shared-id', '', youtube);
  await browser.waitFor('location.pathname === "/watch" && location.search === "?v=shared-id"');
  // A userscript runs once per document; evaluate it again after this full load.
  await browser.evaluate(youtube);
  await browser.evaluate('history.pushState({}, "", "/shorts/another-id")');
  await browser.waitFor('location.pathname === "/watch" && location.search === "?v=another-id"');
});

// Only the literal URL patterns, | anchors and * wildcard used in this file.
// This checks rule matching cases, not native Brave/iOS filter-engine support.
function documentRuleMatches(rule, url) {
  let pattern = rule.slice(0, -'$document'.length);
  const start = pattern.startsWith('|');
  const end = pattern.endsWith('|');
  if (start) pattern = pattern.slice(1);
  if (end) pattern = pattern.slice(0, -1);
  assert(!/[|^]/.test(pattern), 'Unsupported filter syntax in this test');
  const escaped = pattern.replace(/[.+?${}()\[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp((start ? '^' : '') + escaped + (end ? '$' : '')).test(url);
}

test('Brave blocks feed URLs with or without slash and tracking queries, keeping individual reels', () => {
  const rules = filters.split('\n').filter(line => line.endsWith('$document'));
  assert(rules.length > 0);
  for (const host of ['www.instagram.com', 'instagram.com']) {
    for (const suffix of ['', '/', '?igsh=abc', '/?igsh=abc']) {
      const url = `https://${host}/reels${suffix}`;
      assert(rules.some(rule => documentRuleMatches(rule, url)), url);
    }
    for (const path of ['/reel/shared-id/', '/reels/shared-id/?igsh=abc', '/reels/shared-id', '/someone/reels/', '/']) {
      const url = `https://${host}${path}`;
      assert(!rules.some(rule => documentRuleMatches(rule, url)), url);
    }
  }
});
