# Browser support

Version 0.8.0 uses one reader frontend, PDF.js worker, recoloring worker and Rust WASM lookup engine. Packaging verifies 304 shared assets are byte-identical. Browser-specific code handles PDF opening, permissions and tab closing; rendering capability is detected at runtime, not selected by browser name. WebGL2 can be software-backed, and CPU fallback remains available. This release makes no new cross-browser performance superiority claim.

| Capability | Chromium | Firefox desktop | Safari |
| --- | --- | --- | --- |
| Shared reading UI, themes, keyboard and research tools | Tested | Tested | Packaged; runtime untested |
| Automatically open top-level HTTP PDF responses | DNR response-header rules | Blocking response-header listener | Not supported by this adapter |
| Inline attachment PDFs without saving first | Tested | Tested | Explicit opening only; runtime untested |
| Toolbar and PDF-link context menu | Available | Available | Authored; runtime untested |
| Local PDF picker | Available | Tested | Authored; runtime untested |
| Native file URL handoff | Chromium permission required | Not intercepted; use picker | Not implemented; use picker |
| Distributable | Unpacked ZIP | Unsigned development XPI | Source ZIP, not an installable app |

Embedded frames, POST responses, blob URLs, non-PDF MIME responses and browser-internal pages are not automatically intercepted. The exact query parameter `pipit-download=1` bypasses interception; legacy `paperterm-download=1` remains supported. Browser-managed downloads already started cannot be undone. Reading fetches PDF bytes but does not intentionally save a Downloads copy unless Download is selected.

## Build all targets

```sh
npm ci
npm test
npm run build
npm run package
node scripts/verification/extension-packages.mjs
```

Unpacked targets are under `artifacts/unpacked/chrome`, `artifacts/unpacked/firefox`, and `artifacts/unpacked/safari`. `dist/` remains the Chromium target for existing installations. Archives and SHA-256 companions are under `artifacts/`:

- `pipit-0.8.0-chrome.zip`
- `pipit-0.8.0-firefox.xpi` — unsigned, temporary development installation only.
- `pipit-0.8.0-safari-source.zip` — source payload, not a signed Safari app.

## Chromium

Load `dist/` or the extracted Chrome ZIP using Developer mode in `chrome://extensions`. Reload the extension after updates and reopen PDF tabs. Grant site access and, if needed, Allow access to file URLs. The declared minimum is Chrome 128. Other Chromium products have not been independently validated.

## Firefox

Use Firefox desktop 140 or newer. Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select the Firefox XPI or its unpacked `manifest.json`. Grant the requested website permissions. Temporary installations disappear on browser restart; normal release installation requires Mozilla signing. No AMO submission or signing has been performed.

Open a top-level HTTP(S) PDF link normally. The Firefox event-page backend redirects successful GET responses with PDF MIME type into the same reader, preserving queries and page fragments. Local `file://` tabs stay with Firefox's native viewer; press `o` inside Pipit to choose a local PDF instead. A PDF-link context menu is available for explicit opening.

## Safari

Safari source declares an 18.4 API baseline, not a tested minimum. It uses an event-page backend rather than a Chrome service worker. The toolbar checks the active HTTP(S) tab with a credentialed HEAD request and opens a confirmed PDF in Pipit; otherwise it opens the empty reader. Hosts that reject HEAD, permissions not yet granted, or unusual authentication can require the link context menu or local picker. A link-context action opens the selected HTTP(S) URL directly without guessing its extension.

**Safari is not an automatic default PDF viewer in this release.** Its current extension APIs lack the response-header DNR matching and blocking webRequest support used by the other targets. Identical reader assets do not imply identical browser-level integration. No download-sniffing workaround is used.

On a Mac with Xcode and command-line tools, build the targets, then run:

```sh
npm run safari:package -- com.yourorganization.Pipit
```

Use your own bundle identifier. The script creates a macOS Swift host project, detects Apple's newer `safari-web-extension-packager` or its older converter name, and refuses to overwrite an existing project. Open the generated project in Xcode, select your signing team, build/run the host app, and enable the extension in Safari Settings → Extensions. Grant website permissions there. Apple also documents an App Store Connect web packager. Native signing, distribution and Safari runtime testing remain separate work; this Windows build has done none of them. iOS/iPadOS and Firefox Android are not supported/tested targets.

## Privacy and limitations

Documents, lookup and rendering stay local. Host permissions enable fetching and opening requested PDFs; no telemetry or document upload is added. Remote reading still contacts the source website. Explicit Scholar/DOI actions retain their existing external-navigation behavior. Authentication, containers, enterprise policy, unusual PDFs and platform-reserved shortcuts need broader testing. Browser and OS shortcuts cannot all be overridden; the same keyboard guide describes reader actions, not a guarantee that every platform will deliver every keystroke.

## API references

- [Firefox background scripts and Chromium service workers](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
- [Blocking webRequest redirect responses](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/BlockingResponse)
- [Response-header DNR compatibility](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/declarativeNetRequest.json)
- [Browser permission compatibility](https://github.com/mdn/browser-compat-data/blob/main/webextensions/manifest/permissions.json)
- [Apple Safari extension packaging](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)
