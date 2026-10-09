import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { OutputStatus } from '../../../shared/protocol';
import {
  fixturesInUniverse,
  freeUniverseNumber,
  type StageBounds,
  type Universe,
  type VenuePatch,
  VIRTUAL_OUTPUT,
} from '../../../shared/venue-patch';
import { Badge, type BadgeTone } from '../ui/Badge';
import { Button, IconButton } from '../ui/Button';
import { InlineInput, NumberField, parseNumber, useInlineEdit } from '../ui/fields';
import { Select } from '../ui/Select';
import styles from './RigSetup.module.css';

// Arrow Up/Down step of the stage size, in metres.
const STAGE_STEP = 0.5;
// The smallest stage side, in metres.
const MIN_STAGE = 0.1;

interface RigSetupProps {
  patch: VenuePatch;
  outputs: OutputStatus[];
  onStage(stage: StageBounds): void;
  // Resolves to whether the Universe was added.
  onAddUniverse(universe: Universe): Promise<boolean>;
  onPutUniverse(universe: Universe): void;
  onRemoveUniverse(number: number): void;
}

// The stage size, and the Universes with the Output each is sent to.
export function RigSetup({
  patch,
  outputs,
  onStage,
  onAddUniverse,
  onPutUniverse,
  onRemoveUniverse,
}: RigSetupProps) {
  const { stage } = patch;
  return (
    <div className={styles.rig}>
      <section className={styles.section}>
        <h3 className={styles.heading}>Stage</h3>
        <div className={styles.stage}>
          <NumberField
            label="Width (m)"
            value={stage.width}
            min={MIN_STAGE}
            integer={false}
            step={STAGE_STEP}
            onCommit={(width) => onStage({ ...stage, width })}
          />
          <NumberField
            label="Depth (m)"
            value={stage.depth}
            min={MIN_STAGE}
            integer={false}
            step={STAGE_STEP}
            onCommit={(depth) => onStage({ ...stage, depth })}
          />
        </div>
      </section>
      <section className={styles.section}>
        <h3 className={styles.heading}>Universes and Outputs</h3>
        <table aria-label="Universes" className={styles.table}>
          <thead>
            <tr>
              <th>Universe</th>
              <th>Output</th>
              <th>Status</th>
              <th>Fixtures</th>
              <th>
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {patch.universes.map((universe) => (
              <tr key={universe.number}>
                <td className={styles.mono}>{universe.number}</td>
                <td>
                  <OutputSelect universe={universe} outputs={outputs} onPut={onPutUniverse} />
                </td>
                <td>
                  <OutputState output={outputs.find((o) => o.id === universe.output)} />
                  {universe.output === VIRTUAL_OUTPUT && (
                    <span className={styles.hint}>No hardware. See the channel monitor.</span>
                  )}
                </td>
                <td className={styles.mono}>{fixturesInUniverse(patch, universe.number).length}</td>
                <td className={styles.actions}>
                  <IconButton
                    icon={<Trash2 />}
                    label={`Remove Universe ${universe.number}`}
                    onClick={() => onRemoveUniverse(universe.number)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AddUniverse patch={patch} onAdd={onAddUniverse} />
      </section>
    </div>
  );
}

// A Universe number, the lowest free one until the user types another.
function AddUniverse({
  patch,
  onAdd,
}: {
  patch: VenuePatch;
  onAdd(universe: Universe): Promise<boolean>;
}) {
  const [typed, setTyped] = useState<number>();
  const number = useInlineEdit({
    value: typed ?? freeUniverseNumber(patch),
    format: String,
    parse: (text) => {
      const parsed = parseNumber(text, { min: 1 });
      if (parsed.ok && patch.universes.some((u) => u.number === parsed.value)) {
        return { ok: false, error: `Universe ${parsed.value} is already in the patch` };
      }
      return parsed;
    },
    onCommit: setTyped,
  });
  return (
    <form
      className={styles.add}
      onSubmit={(event) => {
        event.preventDefault();
        if (number.parsed === undefined) return;
        void onAdd({ number: number.parsed }).then((added) => added && setTyped(undefined));
      }}
    >
      <InlineInput label="Universe" mono edit={number} className={styles.number} />
      <Button type="submit" icon={<Plus />} disabled={number.parsed === undefined}>
        Add Universe
      </Button>
    </form>
  );
}

// A choice of the Outputs the engine found. The current Output stays listed
// while it is unplugged, and before the engine has reported Outputs.
function OutputSelect({
  universe,
  outputs,
  onPut,
}: {
  universe: Universe;
  outputs: OutputStatus[];
  onPut(universe: Universe): void;
}) {
  const current = universe.output;
  const unlisted =
    current !== undefined && !outputs.some((o) => o.id === current)
      ? [{ value: current, label: current }]
      : [];
  return (
    <Select
      label={`Output of Universe ${universe.number}`}
      hideLabel
      value={universe.output ?? ''}
      options={[
        { value: '', label: 'Unmapped' },
        ...unlisted,
        ...outputs.map((output) => ({ value: output.id, label: output.name })),
      ]}
      onChange={(output) =>
        onPut(output ? { number: universe.number, output } : { number: universe.number })
      }
    />
  );
}

const OUTPUT_STATES: Record<
  Exclude<OutputStatus['state'], 'unused'>,
  { tone: BadgeTone; label: string }
> = {
  connecting: { tone: 'warning', label: 'Connecting…' },
  sending: { tone: 'active', label: 'Sending' },
  failed: { tone: 'danger', label: 'Failed' },
  missing: { tone: 'warning', label: 'Not connected' },
};

function OutputState({ output }: { output: OutputStatus | undefined }) {
  // A mapped Output is never unused once the engine has caught up.
  if (!output || output.state === 'unused') return null;
  const { tone, label } = OUTPUT_STATES[output.state];
  return (
    <span className={styles.state}>
      <Badge tone={tone}>{label}</Badge>
      {output.state === 'failed' && (
        <span className={styles.error}>{output.error ?? 'Unknown error'}. Retrying…</span>
      )}
    </span>
  );
}
