import { useId, useState } from 'react';
import type { Show } from '../../../shared/show';
import type { VenuePatch } from '../../../shared/venue-patch';
import {
  BaseLookButton,
  BlackoutButton,
  FreezeButton,
  GrandMasterFader,
  Key,
  TapTempoButton,
} from '../panel/controls';
import type { TempoState } from '../panel/useTempo';
import { ActiveDot } from '../show/ActiveDot';
import { ClearLayerButton } from '../show/ClearLayerButton';
import { ModeSwitch } from '../show/ModeSwitch';
import { Preview } from '../show/Preview';
import { isActive, pressScene } from '../show/scenes';
import type { PlaybackState } from '../show/usePlayback';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import { SidePanel, SidePanelToggle } from '../ui/SidePanel';
import { layerGroups, type LayerGroup } from './perform';
import styles from './PerformView.module.css';

interface PerformViewProps {
  // Shown now. The Preview is mounted only then, so the engine is not kept
  // sending it for nothing.
  active: boolean;
  show: Show | undefined;
  patch: VenuePatch | undefined;
  playback: PlaybackState | undefined;
  tempo: TempoState | undefined;
}

// The gig view: Blackout, the Base Look, the Grand Master, Tap Tempo and Freeze along the top,
// every Scene as a button grouped by Layer, each Layer with a small Clear, and
// the Preview with Monitor/Blind. Nothing is edited here. It replaces the Fallback Panel strip,
// whose keys still work.
export function PerformView({ active, show, patch, playback, tempo }: PerformViewProps) {
  // The Preview column, below 1280px where it is hidden by default.
  const [sideOpen, setSideOpen] = useState(false);

  if (!show || !patch || !playback) {
    return <p className={styles.loading}>Loading Perform…</p>;
  }
  const groups = layerGroups(show);

  return (
    <div className={styles.view}>
      <div className={styles.controls}>
        <BlackoutButton show={show} playback={playback} className={styles.control} />
        <BaseLookButton
          show={show}
          playback={playback}
          className={cx(styles.control, styles.baseLook)}
        />
        <GrandMasterFader playback={playback} className={styles.grandMaster} />
        <TapTempoButton tempo={tempo} className={styles.control} />
        <FreezeButton show={show} playback={playback} className={styles.control} />
        <div className={styles.toggle}>
          <SidePanelToggle
            label="Preview"
            open={sideOpen}
            onToggle={() => setSideOpen(!sideOpen)}
          />
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.groups}>
          {show.scenes.length === 0 ? (
            <p className={styles.empty}>No Scenes: add them in the Show view.</p>
          ) : (
            groups.map((group) => (
              <LayerSection key={group.layer.id} group={group} playback={playback} />
            ))
          )}
        </div>
        <SidePanel
          label="Preview"
          open={sideOpen}
          onClose={() => setSideOpen(false)}
          className={styles.side}
        >
          <div className={styles.previewBar}>
            <h3 className={styles.heading}>Preview</h3>
            <ModeSwitch mode={playback.mode} />
          </div>
          {active && <Preview patch={patch} />}
        </SidePanel>
      </div>
    </div>
  );
}

// A Layer's Scene buttons, with Clear, enabled while one of them is active.
function LayerSection({ group, playback }: { group: LayerGroup; playback: PlaybackState }) {
  const headingId = useId();
  const { layer, scenes } = group;

  return (
    <section aria-labelledby={headingId} className={styles.layer}>
      <div className={styles.bar}>
        <h3 id={headingId} className={styles.heading}>
          {layer.name}
        </h3>
        <ClearLayerButton layer={layer} active={playback.active} />
      </div>
      {scenes.length === 0 ? (
        <p className={styles.empty}>No Scenes on this Layer.</p>
      ) : (
        <div className={styles.scenes}>
          {scenes.map(({ scene, key }) => (
            <Button
              key={scene.id}
              size="lg"
              className={styles.scene}
              aria-pressed={isActive(playback.active, scene)}
              onClick={() => window.engine.send(pressScene(playback.active, scene))}
            >
              <span className={styles.name}>
                <ActiveDot on={isActive(playback.active, scene)} />
                {scene.name}
              </span>
              {key !== undefined && <Key>{key}</Key>}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
