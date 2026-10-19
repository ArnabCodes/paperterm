# Pipit Alpha 01 — release dashboard

Version: 0.8.0. GitHub release tag: `v0.8.0-alpha.1`. Product rename: Paperterm → Pipit. This is an experimental desktop-browser reader, not production certification or full Sioyek parity.

## Release gates

- Repeatable local validation pipeline: `npm ci && npm run verify:alpha` (not bit-for-bit deterministic PDF/ZIP generation).
- Browser checks use isolated Chromium and Firefox profiles, not the user's profile. Cached evidence is retained under ignored `output/playwright/v080-*`.
- Three versioned packages and SHA-256 companions. Website metadata is generated from their actual bytes and fails on stale versions/checksums.
- Chromium and Firefox execute the same frontend, worker and WASM assets. Safari remains source-only and runtime-untested.
- No analytics scripts or document uploads. Landing-page detection is local, advisory, and never hides other targets. Downloads/setup work without JavaScript.
- New icon sizes are rendered from the SVG source. Pip's raster artwork is checked into `site/assets/pip.png`; only compositor-friendly decorative CSS motion is used, with reduced-motion support.
- Name choice is not a legal trademark clearance. Existing local storage keys, Rust crate name, Firefox add-on ID, and legacy download bypass are retained for upgrade compatibility. New `pipit-download=1` also bypasses interception.

## Website build and Cloudflare deployment

The `cloudflare`, `cloudflare-deploy`, and `wrangler` skills guided a static Cloudflare Pages Direct Upload site. It has no Functions/backend, external CDN assets, account database, or application telemetry. Hosting still exposes ordinary connection information to Cloudflare. Site and reader use separate CSPs; downloads are served as attachments. Only generated distributables and the intentional web reader are published, not the private Git checkout or cached test documents.

```sh
npm run verify:alpha
npx wrangler pages dev site-dist --ip 127.0.0.1 --port 4181
```

Before publishing, authenticate interactively with `npx wrangler login`, then verify `npx wrangler whoami`. If the project does not yet exist, create it once:

```sh
npx wrangler pages project create pipit-reader --production-branch=main
npm run site:deploy
```

Confirm the returned production URL, fetch all three packages and compare hashes to `site-dist/release.json`, verify security/download headers and 404 handling, and exercise `/reader/?demo=1` over HTTPS before calling deployment complete. No custom domain, paid resource, store submission, or signing is part of this release.

Cloudflare authentication was expired during the initial local build; renewal requires Arnab. Do not report the site as live until an authenticated deployment and public-URL checks succeed.

## GitHub

The repository stays private at `ArnabCodes/paperterm` to preserve history and existing links. The product, visible UI, package names and distribution page are Pipit. A private GitHub prerelease can hold the same three archives/checksums; public downloads are served from Cloudflare rather than private GitHub asset URLs. Store listings and public repository visibility are not authorized by this change.

## Known alpha gaps

Safari signing/Xcode compilation/native testing; macOS/Linux browser verification; Firefox permanent signing; mobile extensions; very large/complex PDFs, CJK/RTL and enterprise authentication. Search/reference resolution needs text; there is no built-in OCR. Citation graphs are within-document numeric heuristics. Themes recolor figures; disable recoloring for color-critical work. Export notes before changing origin/profile/extension identity. Broad API compatibility is not measured speed or stability parity with every browser.

## References

- [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Safari extension packaging](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)
