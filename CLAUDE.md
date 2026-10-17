# CLAUDE.md

Userscripts that remove Instagram Reels and YouTube Shorts from the mobile web. See README.md for the user-facing overview.

## Rules for the scripts

- **Pure ASCII only.** Write non-ASCII text (e.g. Czech words) as `\u` escapes. Accented characters made a script silently fail to load in the Userscripts extension.
- **ES5 style, no build step.** Use `var` and `function`, no libraries, no bundler. Each script is one self-contained `.user.js` file wrapped in an IIFE with `'use strict'`.
- Keep the `// ==UserScript==` header intact. `@name` must stay unique per script.

## Target environment

- iPhone Safari with the free Userscripts extension (not Tampermonkey).
- Instagram and YouTube are single-page apps: navigation does not reload the page. Scripts catch changes with a MutationObserver plus URL polling, not only at load time.
- On Instagram mobile web the search icon is the `/explore/` link; `/explore/search/` must stay reachable when Explore is blocked.

## Testing

- There are no automated tests. `node --check scripts/<file>.user.js` catches syntax errors; real testing is done by the user on the phone.
- If an edited script seems not to run, clear Safari's cache first before debugging the code.

## When changing behavior

Update the script's `@description` line and the README (the scripts table and "Known limitations").
