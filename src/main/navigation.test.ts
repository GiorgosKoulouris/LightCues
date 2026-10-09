import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isAppPage } from './navigation';

describe('isAppPage', () => {
  describe('packaged build', () => {
    const appPage =
      'file:///C:/Program%20Files/LightCues/resources/app.asar/out/renderer/index.html';

    it('allows the renderer page', () => {
      expect(isAppPage(appPage, appPage)).toBe(true);
    });

    it('allows the page as main builds it', () => {
      const page = pathToFileURL('/opt/Light Cues/app.asar/out/renderer/index.html').href;
      expect(isAppPage(page, page)).toBe(true);
    });

    it('allows the renderer page with a query or hash', () => {
      expect(isAppPage(`${appPage}?x=1#top`, appPage)).toBe(true);
    });

    it('denies another file', () => {
      expect(isAppPage('file:///C:/Users/me/evil.html', appPage)).toBe(false);
      expect(isAppPage('file:///C:/Windows/System32/', appPage)).toBe(false);
    });

    it('denies a web page', () => {
      expect(isAppPage('https://example.com/', appPage)).toBe(false);
    });
  });

  describe('dev server', () => {
    const appPage = 'http://localhost:5173/';

    it('allows any page on the dev server origin', () => {
      expect(isAppPage('http://localhost:5173/', appPage)).toBe(true);
      expect(isAppPage('http://localhost:5173/index.html?t=1', appPage)).toBe(true);
    });

    it('denies another port, host or scheme', () => {
      expect(isAppPage('http://localhost:5174/', appPage)).toBe(false);
      expect(isAppPage('http://localhost.example.com:5173/', appPage)).toBe(false);
      expect(isAppPage('https://localhost:5173/', appPage)).toBe(false);
    });

    it('denies a file URL', () => {
      expect(isAppPage('file:///C:/Users/me/evil.html', appPage)).toBe(false);
    });
  });

  it('denies a javascript: URL', () => {
    expect(isAppPage('javascript:alert(1)', 'http://localhost:5173/')).toBe(false);
    expect(isAppPage('javascript:alert(1)', 'file:///C:/app/index.html')).toBe(false);
  });

  it('denies a URL that does not parse', () => {
    expect(isAppPage('not a url', 'http://localhost:5173/')).toBe(false);
  });
});
