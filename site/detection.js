export function detectEnvironment(environment) {
  const userAgent = environment.userAgent || '';
  const platform = environment.userAgentData?.platform || environment.platform || '';
  const touchMac = /Mac/i.test(platform) && (environment.maxTouchPoints || 0) > 1;
  const mobile = environment.userAgentData?.mobile === true || /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || touchMac;
  let os = /Windows|Win32|Win64/i.test(platform + userAgent) ? 'Windows' : /Mac/i.test(platform + userAgent) ? 'macOS' : /Linux|X11/i.test(platform + userAgent) ? 'Linux' : 'your platform';
  if (/Android/i.test(platform + userAgent)) os = 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgent) || touchMac) os = 'iOS / iPadOS';
  let browser = 'unknown';
  if (!mobile) {
    if (/Firefox\//i.test(userAgent)) browser = 'firefox';
    else if (/Edg\/|Chrome\/|Chromium\/|OPR\//i.test(userAgent)) browser = 'chromium';
    else if (/Safari\//i.test(userAgent) && /Version\//i.test(userAgent)) browser = 'safari';
    else if (environment.userAgentData?.brands?.some(brand => /Chromium|Google Chrome|Microsoft Edge/i.test(brand.brand))) browser = 'chromium';
  }
  return { browser, os, mobile };
}
