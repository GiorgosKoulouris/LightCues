// Whether `url` is the app's own page, the one the window loaded as `appUrl`.
// A `file:` page must be the same file; query and hash may differ. A dev
// server page may be any path on the same origin, so Vite reloads work.
export function isAppPage(url: string, appUrl: string): boolean {
  if (!URL.canParse(url) || !URL.canParse(appUrl)) return false;
  const target = new URL(url);
  const appPage = new URL(appUrl);
  if (appPage.protocol === 'file:') {
    return (
      target.protocol === 'file:' &&
      target.host === appPage.host &&
      target.pathname === appPage.pathname
    );
  }
  // Opaque origins (`javascript:`, `data:`) are all 'null'.
  return appPage.origin !== 'null' && target.origin === appPage.origin;
}
