# no-more-scroll

A small collection of userscripts that remove short-format video feeds (Instagram Reels, YouTube Shorts) from the mobile web, so you can still use the services without the doomscroll.

The idea: delete the native apps, use the sites in Safari instead, and let a userscript strip out the endless-scroll features.

## What's included

| Script | Site | What it does |
| --- | --- | --- |
| [`scripts/instagram-no-reels.user.js`](scripts/instagram-no-reels.user.js) | instagram.com | Hides the Reels link without hiding its surrounding navigation, redirects the Reels feed home, keeps Explore search, and blocks swiping to the next reel while allowing comments to scroll. Optional Following redirects and suggested/sponsored post filtering are enabled by default. |
| [`scripts/youtube-no-shorts.user.js`](scripts/youtube-no-shorts.user.js) | youtube.com | Hides Shorts shelves and navigation, keeps ordinary shared video links visible, and turns `/shorts/<id>` links into normal `/watch?v=<id>` pages without the swipe feed. |

## Why Userscripts?

Safari on iPhone cannot run desktop-style extension managers such as Tampermonkey, and the content blockers built into Safari only hide elements with static rules. That is not enough here:

- The Instagram and YouTube mobile sites are single-page apps: tapping a link does not reload the page, so a rule that only runs once at page load misses most navigation.
- Hiding a button is not enough. A reel opened from a DM is an overlay on top of the chat and the URL does not change, so the script has to detect the overlay and cancel the swipe gesture.
- Redirects (`/shorts/<id>` to `/watch?v=<id>`, Reels page to home) need real code, not a CSS rule.
- Some of AdGuard's advanced rule types are a paid feature, while Userscripts is free.

[Userscripts](https://apps.apple.com/app/userscripts/id1463298887) is a free, open-source Safari extension (by Justin Wasack) that runs your own JavaScript and CSS on the sites you choose. That is exactly what these scripts need.

## Installation (iPhone / iPad, Safari)

1. **Install Userscripts** from the App Store: search for "Userscripts" (developer Justin Wasack).
2. **Open the Userscripts app** and choose a folder for your scripts (iCloud Drive works well, and lets you edit them from a computer too).
3. **Enable the extension**: Settings -> Apps -> Safari -> Extensions -> Userscripts. Turn it on and set the permission to **Allow** for `instagram.com` and `youtube.com` (not "Ask" or "Deny").
4. **Add the scripts**: download the `.user.js` files from the [`scripts/`](scripts) folder and save them into the folder you picked in step 2. Keep the `.user.js` ending in the file name.
5. **Restart Safari**: swipe it away from the app switcher and open it again.
6. **Check it**: open instagram.com or youtube.com, tap **aA** in the address bar, and open **Userscripts**. The script should be listed for that site.

Tips:

- Keep only one copy of each script in the folder. Two files with the same `@name` can confuse the extension.
- Keep the files pure ASCII. Accented characters caused a script to silently fail to load during development, which is why the Czech words in the Instagram script are written as `\u` escapes.
- Keep a backup copy outside the Userscripts folder, so you can roll back if a site changes.

## Instagram options

Edit the switches near the top of `scripts/instagram-no-reels.user.js`, then save the file back to your Userscripts folder and reload the page:

| Switch | Default | Purpose |
| --- | --- | --- |
| `BLOCK_EXPLORE` | `true` | Keep Explore search available while blocking the endless grid and other Explore feeds. |
| `FORCE_FOLLOWING` | `true` | Try to open the Following feed on home. Set to `false` if Instagram stops supporting its URL parameter. |
| `HIDE_SUGGESTED_POSTS` | `true` | Hide suggested/sponsored posts on home using the header heuristic. Set to `false` independently of the Following redirect. |
| `DEBUG` | `false` | Log hidden posts and outline detected reel overlays while blocking a swipe. |

The Reels feed remains blocked regardless of these switches. Shared `/reel/<id>` and `/reels/<id>` pages remain available.

## Other browsers on iPhone

Every iPhone browser uses Safari's engine, but only Safari can load Safari extensions such as Userscripts. Other browsers get less.

| Browser | Instagram | YouTube |
| --- | --- | --- |
| Safari | Everything (userscript) | Everything (userscript) |
| Brave | Hiding only (custom filters) | Brave's built-in Shorts blocker |
| Firefox | Nothing | Nothing |

### Brave

**YouTube:** you do not need anything from this repo. Brave already has a built-in YouTube Shorts blocker, so just turn it on in Brave's settings.

**Instagram setup:**

1. Open [`filters/brave.txt`](filters/brave.txt) (on GitHub, tap **Raw**) and copy all of it.
2. In Brave, go to Settings -> Shields & Privacy -> Content Filtering -> **Add Custom Filters**.
3. Paste the text and save.
4. Make sure Shields are on for instagram.com.

**What the filters do:**

- Hide the Reels button.
- Hide the Reels tab on profiles. Brave cannot lock swiping, so a reel opened from this tab could lead into the endless feed.
- Block the Reels feed when opened directly, including `/reels`, `/reels/` and tracking-query variants on `instagram.com` and `www.instagram.com`. Individual reel URLs remain available.

**What they cannot do.** Filters can only hide and block, they cannot run code, so:

- The Reels page is not redirected home, and moving to it from inside the site is not caught. Hiding the button covers the usual way in.
- Swiping inside a reel is not locked.
- There is no switch to the "Following" feed and no hiding of posts from accounts you do not follow.

> URL-matching regression cases are covered by the local tests below. Native Brave filter-engine support and behavior on an iPhone are not yet verified.

**Coming later:** Brave is planning custom scriptlets (small scripts that run on a page) for iPhone, starting with a Developer Mode toggle for custom filters ([brave/brave-browser#57848](https://github.com/brave/brave-browser/issues/57848), part of [#53511](https://github.com/brave/brave-browser/issues/53511)). There is no release date yet. Once it ships, the redirects and the swipe lock could be ported to Brave.

### Firefox

Firefox on iPhone does not support extensions or userscripts, so nothing from this repo works there.

Why: in a [Mozilla support thread](https://support.mozilla.org/en-US/questions/1486487), Mozilla says that add-ons for desktop and Android Firefox are not available on Firefox for iOS. Apple requires every iOS browser to be built on its WebKit engine, and the thread describes Firefox on iOS as basically a shell around that engine, with limited extension abilities.

## Home Screen icon with Shortcuts (iPhone)

You deleted the apps, but you can keep a normal-looking icon on your Home Screen that opens the site in Safari (where the userscripts run).

1. Open the **Shortcuts** app and tap **+** to create a new shortcut.
2. Tap **Add Action**, search for **Open URLs**, and add it.
3. Enter the address, for example `https://www.instagram.com/` or `https://www.youtube.com/`.
4. Tap the shortcut name at the top and **Rename** it (for example "Instagram").
5. Open the shortcut's settings (the **i** or share-sheet button) and choose **Add to Home Screen**.
6. Tap the small icon next to the name to change the image: **Choose Photo**, **Choose File** or **Take Photo**. Use the logo image you like (a square image around 512x512 works well).
7. Tap **Add**.

Notes:

- Use this method instead of Safari's own "Add to Home Screen". A shortcut opens the page in a normal Safari tab. A site saved as a Home Screen web app may not load Safari extensions, so the userscripts might not run there. This is my understanding rather than something I tested, so check it on your device.
- When you tap the icon, Shortcuts flashes briefly before Safari opens. That is normal.
- This opens the link in your default browser, so Safari needs to be your default.

## Notifications

A site opened in a Safari tab cannot send push notifications on iPhone. Web push on iOS works only for web apps saved to the Home Screen, and Instagram's support for it on iPhone is uncertain. Practical options:

- Turn on Instagram's email notifications for messages and activity.
- Check your messages at set times instead of reacting to pings, which is part of the point of removing the app.

## Known limitations

- **Sites change.** These scripts rely on page structure and wording that Instagram and YouTube can change at any time. If something stops working, open an issue or adjust the selectors.
- **Instagram "Following" feed.** The `variant=following` parameter is based on how Instagram's web home worked when this was written. The redirect preserves other query parameters and the fragment. It has a 10-second cooldown and is skipped if session storage is unavailable, so the cooldown can always survive a reload. If Instagram changes this parameter, set `FORCE_FOLLOWING = false`.
- **Hiding posts from accounts you do not follow** works only on home and is a heuristic. It checks the post header for "Follow" or exact suggested/sponsored labels in English and Czech. A Follow button alone does not hide collaboration posts with multiple profile links; sponsored labels still apply. Headerless posts are left alone and checked again when their content changes. Recycled articles are reevaluated, and filtering is inactive on profiles and opened posts. If Instagram changes its wording, update `FOLLOW_WORDS` or `LABELS`, or set `HIDE_SUGGESTED_POSTS = false`.
- **Comment scrolling** is allowed inside scrollable panels that do not contain a video. At panel edges the gesture is blocked to prevent scrolling into the next reel. This is still a markup heuristic; panels containing embedded videos may remain locked. Pinch zoom and editable fields are left alone.
- **Explore is blocked** by default because it is another endless feed. The search icon and `/explore/search/` still work, so you can look up profiles. Other Explore pages (hashtags, places) redirect home. To allow all of Explore, set `BLOCK_EXPLORE = false` at the top of the Instagram script.
- Earlier versions were tested on iPhone with Safari and Userscripts. The current fixes have local Chromium fixture coverage, but have not been retested on an iPhone or against the live sites. Android and desktop site compatibility remain unverified.

## Development checks

The userscripts remain standalone files: no build step, package install or external runtime dependencies. Local regression tests use Node.js 24+ and an installed Chromium browser:

```bash
node --check scripts/instagram-no-reels.user.js
node --check scripts/youtube-no-shorts.user.js
node --test tests/userscripts.test.mjs
```

Set `CHROMIUM_PATH` if the executable is not named `chromium`. In a container without a working Chromium sandbox, run `CHROMIUM_NO_SANDBOX=1 node --test tests/userscripts.test.mjs`. The test browser only loads local fixtures, and its temporary profile and HTTP server are cleaned up afterward.

Tests cover ASCII/metadata, incremental navigation rendering, lazy and recycled post headers, SPA navigation, feature switches, redirect cooldown/storage failures, comment scroll boundaries, shared Shorts links and Brave URL patterns. The filter tests implement only the literal patterns and anchors used in this file; they do not run Brave's native engine. These checks do not validate Userscripts injection or current Instagram/YouTube markup in Safari.

Before shipping a change, also check on an iPhone:

1. Safari with Userscripts: Reels/Explore feeds are blocked, search works, and navigation and followed posts remain visible.
2. Open a shared reel directly and from a DM: playback works, comments scroll, and swiping at their edges does not advance to another reel.
3. Navigate between home, a profile and a shared post; check that posts are not left hidden outside home. Try the feature switches independently.
4. Open a shared Short and confirm the regular player loads; check that Shorts shelves/navigation hide while ordinary shared links remain available.
5. In Brave, try direct Reels feed URLs with/without a slash and query parameters, then confirm individual reels still open.

## Security note

A userscript can read and change everything on the pages it runs on, including logged-in pages. Only install scripts you have read or trust. These are short and commented, so please read them before installing.

## License

[MIT](LICENSE)
