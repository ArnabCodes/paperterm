import assert from 'node:assert/strict';
import { detectEnvironment } from '../../site/detection.js';

const cases = [
  [{ userAgent: 'Mozilla Windows NT 10.0 Chrome/144.0 Safari/537.36', platform: 'Win32' }, 'chromium', 'Windows', false],
  [{ userAgent: 'Mozilla Windows NT 10.0 Chrome/144.0 Safari/537.36 Edg/144.0', platform: 'Win32' }, 'chromium', 'Windows', false],
  [{ userAgent: 'Mozilla X11 Linux x86_64 Firefox/158.0', platform: 'Linux x86_64' }, 'firefox', 'Linux', false],
  [{ userAgent: 'Mozilla Macintosh Version/18.4 Safari/605.1.15', platform: 'MacIntel' }, 'safari', 'macOS', false],
  [{ userAgent: 'Mozilla iPhone Version/18 Mobile Safari/604.1' }, 'unknown', 'iOS / iPadOS', true],
  [{ userAgent: 'Mozilla Macintosh Version/18 Safari/605.1', platform: 'MacIntel', maxTouchPoints: 5 }, 'unknown', 'iOS / iPadOS', true],
  [{ userAgent: 'Mozilla Android Chrome/144 Mobile Safari/537.36' }, 'unknown', 'Android', true],
  [{ userAgent: 'Mozilla iPhone FxiOS/144 Mobile Safari/605' }, 'unknown', 'iOS / iPadOS', true],
  [{ userAgent: 'Mozilla iPhone CriOS/144 Mobile Safari/605' }, 'unknown', 'iOS / iPadOS', true],
  [{ userAgentData: { brands: [{ brand: 'Not/A Brand' }, { brand: 'Chromium' }], platform: 'Windows', mobile: false } }, 'chromium', 'Windows', false],
  [{ userAgentData: { brands: [{ brand: 'Chromium' }], platform: 'Android', mobile: true } }, 'unknown', 'Android', true],
  [{ userAgent: 'unknown' }, 'unknown', 'your platform', false],
];
for (const [environment, browser, os, mobile] of cases) assert.deepEqual(detectEnvironment(environment), { browser, os, mobile });
console.log(`${cases.length} browser/platform detection cases passed`);
