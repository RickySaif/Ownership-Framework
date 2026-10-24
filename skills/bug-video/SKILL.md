---
name: bug-video
description: Records a short captioned video of a bug in a QA hub, headless with Playwright, with on-screen captions and an evidence panel showing the response and the stored state. Saved as qa/<app>/videos/<ID>-<slug>.webm, with an optional "after fix" clip. Use after a bug report is written, or when someone asks to "record the bug", "make a video", "show the developers".
---

# Bug video

Work inside a QA hub. The harness is `lib/demo.mjs`: `demo(name, fn)`, `caption(text)`, `evidence(panel)`,
`as(page, role)`. Demos live in `qa/<app>/videos/demos/<ID>.demo.mjs`. Example: the framework's
`examples/acme-leave/hub/qa/acme-leave/videos/demos/`.

## Write the demo

```js
import { demo, caption, evidence, as } from '../../../../lib/demo.mjs';

demo('AL-4 short description of the bug', async ({ page, db, track, api }) => {
  await caption('Requirement R7: <the rule, in plain words>.');
  await as(page, 'employee');
  await caption('<what the user does next>');
  // … the bug's steps, through the UI where possible …
  await evidence({ title: 'Confirmed two ways', rows: {
    'expected (R7)': { value: '<expected>', good: true },
    'response': { value: '<what the app answered>', bad: true },
    'stored': { value: '<what db.read returned>', bad: true },
  } });
  await caption('<why it matters to the user>', { hold: 3500 });
});
```

- The name **starts with the bug id**; the file name and video name come from it.
- Start with the requirement, then the steps, then the evidence, then why it matters. 20 to 40 seconds.
- Use the UI where the user would. When the bug is in the API behind a hidden button, show the page first, then make
  the call from the page (`page.evaluate(fetch …)`) and reload so the result is visible.
- Read stored state with `db.read` for the evidence panel. Record created rows with `track()`.
- Captions in plain words. No secrets on screen: never type or show a password; `as()` logs in without showing it.

## Record

```sh
npm run videos -- --grep AL-4          # → qa/<app>/videos/AL-4-<slug>.webm
AFTER=1 npm run videos -- --grep AL-4  # after-fix clip, against a fix branch → AL-4-<slug>.after.webm
```

Then set `video` (and `videoAfter`) in the bug file, `npm run validate`, and `npm run board`. Watch the clip once
on the board to check the captions are readable.
