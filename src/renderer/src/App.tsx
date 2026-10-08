import { useState } from 'react';
import { FallbackPanel } from './panel/FallbackPanel';
import { usePanelKeys } from './panel/usePanelKeys';
import { PerformView } from './perform/PerformView';
import { ProfileLibraryView } from './profiles/ProfileLibraryView';
import styles from './App.module.css';
import { Sidebar } from './shell/Sidebar';
import { TopBar } from './shell/TopBar';
import { useViewShortcuts } from './shell/useShortcuts';
import type { View } from './shell/views';
import { ShowView } from './show/ShowView';
import { useMidiInput } from './show/useMidiInput';
import { usePlayback } from './show/usePlayback';
import { useShow } from './show/useShow';
import { cx } from './ui/cx';
import { useVenuePatch } from './venue/useVenuePatch';
import { VenuePatchView } from './venue/VenuePatchView';

// The shell: sidebar, top bar, the current view and the Fallback Panel strip,
// which the Perform view replaces. Blackout frames the window red, Blind amber.
export function App() {
  const [view, setView] = useState<View>('venue');
  const show = useShow().show;
  const venue = useVenuePatch().venue;
  const playback = usePlayback();
  const midiInput = useMidiInput();
  useViewShortcuts(setView);
  usePanelKeys(show?.show, playback);

  return (
    <div
      className={cx(
        styles.app,
        playback?.blackout && styles.blackout,
        playback?.mode === 'blind' && styles.blind,
      )}
    >
      <Sidebar view={view} onView={setView} />
      <div className={styles.main}>
        <TopBar show={show} venue={venue} playback={playback} midiInput={midiInput} />
        {/* All stay mounted, so the Show and Venue Patch still guard the window close. */}
        <main className={styles.content}>
          <div hidden={view !== 'show'}>
            <ShowView active={view === 'show'} />
          </div>
          <div hidden={view !== 'venue'}>
            <VenuePatchView active={view === 'venue'} />
          </div>
          <div hidden={view !== 'profiles'}>
            <ProfileLibraryView active={view === 'profiles'} />
          </div>
          <div hidden={view !== 'perform'}>
            <PerformView
              active={view === 'perform'}
              show={show?.show}
              patch={venue?.patch}
              playback={playback}
            />
          </div>
        </main>
        {view !== 'perform' && <FallbackPanel show={show?.show} playback={playback} />}
      </div>
    </div>
  );
}
