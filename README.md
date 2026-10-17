# no-more-scroll

A small collection of userscripts that remove short-format video feeds (Instagram Reels, YouTube Shorts) from the mobile web, so you can still use the services without the doomscroll.

The idea: delete the native apps, use the sites in Safari instead, and let a userscript strip out the endless-scroll features.

## What's included

| Script | Site | What it does |
| --- | --- | --- |
| [`scripts/instagram-no-reels.user.js`](scripts/instagram-no-reels.user.js) | instagram.com | Hides the Reels button, redirects the Reels page to the home page, turns the Explore grid into a search-only page (so you can still look up profiles), locks swiping inside a reel (so a reel a friend sends you plays once and you cannot scroll on to the next), tries to switch the home feed to "Following" and hides posts from accounts you do not follow (suggested or sponsored posts). |
| [`scripts/youtube-no-shorts.user.js`](scripts/youtube-no-shorts.user.js) | youtube.com | Hides the Shorts shelves, tab and buttons, and turns `/shorts/<id>` links into normal `/watch?v=<id>` pages so you can still watch a Short someone sends you without the swipe feed. |

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
- **Instagram "Following" feed.** The redirect to `/?variant=following` is based on how Instagram's web home worked when this was written. It has a 10-second cooldown to avoid redirect loops. If Instagram changes this parameter, delete that block in `redirectIfBlocked`.
- **Hiding posts from accounts you do not follow** is a heuristic. It hides posts whose header contains a "Follow" button or a "Suggested"/"Sponsored" label (English and Czech). Add your own language to `FOLLOW_WORDS` and `LABELS` in the script.
- **Explore is blocked** by default because it is another endless feed. The search icon and `/explore/search/` still work, so you can look up profiles. Other Explore pages (hashtags, places) redirect home. To allow all of Explore, set `BLOCK_EXPLORE = false` at the top of the Instagram script.
- Tested on iPhone with Safari and Userscripts. Not tested on Android or desktop.

## Security note

A userscript can read and change everything on the pages it runs on, including logged-in pages. Only install scripts you have read or trust. These are short and commented, so please read them before installing.

## License

No license has been chosen yet.
