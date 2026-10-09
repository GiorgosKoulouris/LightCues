import { _electron as electron, expect, test, type Page } from '@playwright/test';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DMX_CHANNELS } from '../src/shared/venue-patch';

// The real app, built in `out/`: Open example, fire a Fallback Panel Scene
// button and check the Virtual Output's frame in the channel monitor. Only
// the UI is used, so the app has no test-only hooks. Open example needs no
// file dialog: main grants the example paths itself (ADR 0010).

// The example's Front PARs: Universe 1, channels 1–16. Chorus lights them.
const FRONT_PAR_CHANNELS = 16;

test('a Scene reaches the Virtual Output and Blackout clears it', async () => {
  // A fresh userData folder: no recent files to reopen, no saved settings.
  const userData = mkdtempSync(join(tmpdir(), 'lightcues-e2e-'));
  const app = await electron.launch({
    args: [`--user-data-dir=${userData}`, '.'],
    env: inheritedEnv(),
  });
  try {
    // Real paths: Windows temp folders may come as 8.3 short names.
    const used = await app.evaluate(({ app }) => app.getPath('userData'));
    expect(realpathSync.native(used)).toBe(realpathSync.native(userData));
    const page = await app.firstWindow();
    const sidebar = page.getByRole('navigation', { name: 'Views' });
    const panel = page.getByRole('region', { name: 'Fallback Panel' });

    await sidebar.getByRole('button', { name: 'Open example' }).click();
    await page.getByRole('button', { name: 'Channel monitor' }).click();
    const chorus = panel.getByRole('button', { name: /Chorus: full red/ });
    await chorus.click();
    await expect(chorus).toHaveAttribute('aria-pressed', 'true');

    await expect
      .poll(async () => (await frontParValues(page)).some((value) => value > 0), {
        message: 'a Front PAR channel is non-zero',
      })
      .toBe(true);
    // The readout names the Fixture that owns the lit channel.
    const lit = (await frontParValues(page)).findIndex((value) => value > 0);
    await monitorCells(page).nth(lit).hover();
    await expect(page.getByTestId('channel-readout')).toContainText(
      `Channel ${lit + 1} · Front PAR`,
    );

    await panel.getByRole('button', { name: /Blackout/ }).click();
    await expect
      .poll(async () => monitorValues(page), { message: 'Universe 1 all zero' })
      .toEqual(new Array<number>(DMX_CHANNELS).fill(0));
  } finally {
    await app.close();
    rmSync(userData, { recursive: true, force: true });
  }
});

// This process's environment, without a dev server URL: the app loads the
// built renderer.
function inheritedEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).flatMap(([name, value]) =>
      value === undefined || name === 'ELECTRON_RENDERER_URL' ? [] : [[name, value]],
    ),
  );
}

// The channel monitor's cells for Universe 1, the example's first Universe.
function monitorCells(page: Page) {
  return page.getByRole('grid', { name: 'Universe 1 channels' }).getByRole('gridcell');
}

// The 512 values the channel monitor shows for Universe 1.
async function monitorValues(page: Page): Promise<number[]> {
  return (await monitorCells(page).allTextContents()).map(Number);
}

// The values of the Front PARs' channels.
async function frontParValues(page: Page): Promise<number[]> {
  return (await monitorValues(page)).slice(0, FRONT_PAR_CHANNELS);
}
