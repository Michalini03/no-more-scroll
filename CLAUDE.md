# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

`no-more-scroll` is a small set of userscripts that remove short-format video feeds (Instagram Reels, YouTube Shorts) from the mobile web. The owner deleted the native apps and uses the sites in Safari on iPhone, with the scripts running through the free **Userscripts** Safari extension (by Justin Wasack). Any change must keep working in that setup.

## Layout

- `scripts/instagram-no-reels.user.js` - Instagram: hides Reels/Explore nav, redirects the feeds home, locks swiping inside reel viewers (including DM overlays), forces the Following feed, hides posts from accounts the user does not follow.
- `scripts/youtube-no-shorts.user.js` - YouTube: hides Shorts UI, redirects `/shorts/<id>` to `/watch?v=<id>`.
- `README.md` - why Userscripts is needed, Safari install guide, Shortcuts Home Screen icon tutorial, limitations.

There is no build step, package manager or test suite.

## Hard rules for the scripts

1. **Pure ASCII only.** A version containing accented characters (Czech words) stopped being detected by Userscripts. Write non-ASCII text as `\u` escapes, for example `navrhováno`. This applies to comments and the metadata header too.
2. **Keep the metadata header simple and valid.** `// ==UserScript==` block with `@name`, `@description`, `@match`, `@run-at document-start` and `@noframes`. Keep the file name ending in `.user.js`. Two files with the same `@name` can confuse the extension.
3. **Plain, conservative JavaScript** (`var`, `function`, no build tooling, no external dependencies). Scripts must be self-contained single files.
4. **The sites are single-page apps.** The scripts run once at load, so they use a `MutationObserver` for lazy-rendered elements and a 300 ms `location.href` poll for navigation. Do not rely on a page reload.
5. **Prefer stable hooks** such as `href`, `role`, `aria-label`, `position: fixed` and the presence of a `<video>`. Instagram and YouTube class names are obfuscated and change often.
6. **Do not break shared content.** A reel or Short a friend sends should still open and play. Block the feeds and the swipe, not the single item. On Instagram, `/reel/<id>` and `/reels/<id>` open, the bare `/reels/` feed redirects home, and shared reels in DMs open as an overlay while the URL stays `/direct/t/<id>`.
7. **Avoid redirect loops.** Any redirect that Instagram or YouTube might rewrite back needs a cooldown (see the `ig-follow-redirect` guard in the Instagram script).
8. **Keep the debug switch.** `DEBUG` stays in the Instagram script and defaults to `false`.

## Checks before committing

Run these on every changed script:

```bash
node --check scripts/<file>.user.js
grep -nP '[^\x00-\x7F]' scripts/<file>.user.js || echo "ASCII only: OK"
```

Both must pass (the grep must print the OK line). Behavior cannot be tested in this environment: the scripts have to be tried on an iPhone in Safari with Userscripts enabled. Say clearly when a change is untested on a device.

## Known unverified assumptions

- `/?variant=following` as the Instagram Following feed. If Instagram stops honoring it, remove the home redirect block in `redirectIfBlocked`.
- The post-hiding heuristic in the Instagram script (Follow button or "Suggested"/"Sponsored" label in the post header, English and Czech) may over- or under-hide when Instagram changes its markup.
- Home Screen web apps added through Safari may not load Safari extensions, which is why the README uses Shortcuts for the icon.

## Debugging a broken script

Ask for the outer HTML of the element that should be hidden (or the URL path, from the Safari **aA** menu) before guessing selectors. Check the cheap causes first: extension permission set to Allow for the site, a duplicate script file, a non-ASCII character in the file, and Safari needing a full restart.

## Documentation

When behavior changes, update the table and limitations in `README.md` in the same commit. Keep the README honest: label anything not tested on a real device.

## Workflow

Work on a branch and open a pull request instead of committing straight to `main`. Keep commits focused and describe what changed in plain language.

## License

MIT. The `LICENSE` file is in the repo root, the README mentions it, and each script header carries `// @license MIT`. Keep all three in sync: if the license ever changes, update the `LICENSE` file, the README and the `@license` line in every script header (ASCII only), and do not add code under an incompatible license.