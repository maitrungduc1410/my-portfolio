# jamesisme.com

Source of [jamesisme.com](https://jamesisme.com). The whole site is one file, `index.html`.

## One file, one request

Markup, styles, script and both typefaces live in that single file, so the page arrives in one
request and needs no further round trip to render. There is no bundler, no package manifest and no
dependency to upgrade. The deploy workflow copies the file rather than building it, because there is
nothing to build.

The constraint is the argument, not a party trick. A page whose subject is client performance should
not need a framework to say so.

## The frame timeline

The strip under the headline is a live trace of the frames your own browser is producing while you
read it. It is not a recording and not a video.

- It measures your display rather than mine. The budget line is drawn at your real refresh rate, so a
  120 Hz screen gets an 8.3 ms line instead of a hardcoded 16.7 ms.
- Bars turn amber when a frame misses that budget. The panel above reports frames per second, frame
  p50 and p95, and the share of recent frames that went over.
- `Inject jank` blocks the main thread deliberately for three seconds, so you can watch p95 climb
  from 16.7 ms to 33.3 ms and then recover. It exists so the instrument can be seen working on
  something rather than sitting flat.
- Under `prefers-reduced-motion` the trace samples briefly, freezes, and says so in the caption.
  Nothing animates.
- The render loop stops when the canvas scrolls out of view and when the tab is hidden.

## Measured, not asserted

The footer is the page measuring itself: largest contentful paint, cumulative layout shift,
interaction latency, bytes transferred, request count, script size and DOM node count, taken in your
browser rather than on my machine.

Verified in headless Chrome before publishing:

- Cumulative layout shift of `0.000000` at every viewport width from 320 px up to 2560 px, with no
  horizontal scrolling at any of them
- Zero axe-core violations, in both dark and light, at 1440 px and 390 px
- Zero console errors and zero failed requests
- One request for the document and no external assets of any kind

Layout shift is zero rather than merely small because the embedded typefaces are paired with
fallback faces whose metrics are overridden to match them, so the layout does not move when the real
fonts finish loading.

## Typefaces

Geist and Geist Mono, both variable, from the Geist project, used under the SIL Open Font License.
They are subset to latin, with a second Vietnamese range for the article titles in the writing
section, and embedded as woff2.

## Deploying

`.github/workflows/deploy-pages.yml` publishes to GitHub Pages. It stages an explicit allowlist of
files and uploads only those, rather than uploading the repository root, so nothing reaches the web
unless it is named in `PUBLISH_FILES`. Adding a file to the repository does not publish it.