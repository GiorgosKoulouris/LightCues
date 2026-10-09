import { useState } from 'react';
import type { OutputStatus } from '../../../shared/protocol';
import { fixtureMode, type VenuePatch } from '../../../shared/venue-patch';
import { cx } from '../ui/cx';
import { Select } from '../ui/Select';
import styles from './ChannelMonitor.module.css';
import { universeOptions } from './fixtures';
import { useDmxFrame } from './useDmxFrame';

// 32 × 16 = 512 channels.
const COLUMNS = 32;

// The Fixture and channel name that own a DMX channel.
interface Owner {
  fixture: string;
  channel: string;
}

// What the Outputs send for one Universe, real or virtual, in Blind too.
// Hovering a channel names the Fixture that owns it.
export function ChannelMonitor({ patch, outputs }: { patch: VenuePatch; outputs: OutputStatus[] }) {
  const [picked, setPicked] = useState<number>();
  const [hovered, setHovered] = useState<number>();
  // The picked Universe, or the first one if it was removed.
  const universe = patch.universes.find((u) => u.number === picked) ?? patch.universes[0];

  if (!universe) {
    return (
      <section aria-label="Channel monitor" className={styles.monitor}>
        <p className={styles.note}>Add a Universe in Rig setup to monitor it.</p>
      </section>
    );
  }

  const owners = channelOwners(patch, universe.number);
  const owner = hovered === undefined ? undefined : owners.get(hovered);
  const output = outputs.find((o) => o.id === universe.output);

  let notSent: string | undefined;
  if (universe.output === undefined) notSent = `Universe ${universe.number} has no Output`;
  else if (output?.state !== 'sending')
    notSent = `${output?.name ?? universe.output} is not sending`;

  return (
    <section aria-label="Channel monitor" className={styles.monitor}>
      <div className={styles.header}>
        <Select
          label="Universe"
          value={String(universe.number)}
          options={universeOptions(patch)}
          onChange={(value) => setPicked(Number(value))}
        />
        <p className={styles.note} data-testid="channel-readout">
          {hovered === undefined
            ? 'Hover a channel to see its Fixture.'
            : [
                `Channel ${hovered}`,
                ...(owner ? [owner.fixture, owner.channel] : ['No Fixture']),
              ].join(' · ')}
        </p>
        {notSent && <p className={cx(styles.note, styles.warning)}>{notSent}: nothing is sent.</p>}
      </div>
      <Grid universe={universe.number} onHover={setHovered} />
    </section>
  );
}

// The 512 values of the monitored Universe, 32 to a row.
function Grid({
  universe,
  onHover,
}: {
  universe: number;
  onHover: (channel: number | undefined) => void;
}) {
  const values = useDmxFrame(universe);
  const rows = Array.from({ length: values.length / COLUMNS }, (_, row) =>
    values.slice(row * COLUMNS, (row + 1) * COLUMNS),
  );

  return (
    <div
      role="grid"
      aria-label={`Universe ${universe} channels`}
      className={styles.grid}
      onMouseLeave={() => onHover(undefined)}
    >
      {rows.map((row, r) => (
        <div role="row" key={r} className={styles.row}>
          {row.map((value, c) => {
            const channel = r * COLUMNS + c + 1;
            return (
              <div
                role="gridcell"
                key={channel}
                className={styles.cell}
                data-zero={value === 0 || undefined}
                onMouseEnter={() => onHover(channel)}
              >
                {value}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Each patched channel of the Universe, by DMX channel.
function channelOwners(patch: VenuePatch, universe: number): Map<number, Owner> {
  const owners = new Map<number, Owner>();
  for (const fixture of patch.fixtures) {
    if (fixture.universe !== universe) continue;
    fixtureMode(patch, fixture).channels.forEach((channel, offset) => {
      const name = channel.kind === 'unused' ? 'Unused' : channel.name;
      owners.set(fixture.address + offset, { fixture: fixture.name, channel: name });
    });
  }
  return owners;
}
