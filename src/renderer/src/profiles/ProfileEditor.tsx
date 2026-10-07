import { useState } from 'react';
import {
  EMITTERS,
  ROLES,
  type Capability,
  type CapabilityRange,
  type Channel,
  type Emitter,
  type FixtureMode,
  type FixtureProfile,
  type Role,
  type Span,
} from '../../../shared/fixture-profile';
import {
  blankChannel,
  blankMode,
  fullRange,
  profileId,
  renameChannel,
} from '../../../shared/profile-edit';

interface ProfileEditorProps {
  initial: FixtureProfile;
  // Resolves to validation errors; an empty list means it was saved.
  onSave(profile: FixtureProfile): Promise<string[]>;
  onClose(): void;
}

// Edits one Fixture Profile: identity, default Role, modes and their
// channels, and the capability of each DMX range.
export function ProfileEditor({ initial, onSave, onClose }: ProfileEditorProps) {
  const [profile, setProfile] = useState(initial);
  const [modeIndex, setModeIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const mode = profile.modes[modeIndex];

  function setIdentity(change: Partial<Pick<FixtureProfile, 'manufacturer' | 'model'>>) {
    setProfile((p) => {
      const next = { ...p, ...change };
      return { ...next, id: profileId(next.manufacturer, next.model) };
    });
  }

  function setModes(modes: FixtureMode[]) {
    setProfile((p) => ({ ...p, modes }));
  }

  function setMode(next: FixtureMode) {
    setModes(profile.modes.map((m, i) => (i === modeIndex ? next : m)));
  }

  function addMode(base: FixtureMode) {
    setModes([...profile.modes, base]);
    setModeIndex(profile.modes.length);
  }

  function removeMode() {
    setModes(profile.modes.filter((_, i) => i !== modeIndex));
    setModeIndex(Math.max(0, modeIndex - 1));
  }

  async function save() {
    let result: string[];
    try {
      result = await onSave(profile);
    } catch (error) {
      result = [`Save failed: ${(error as Error).message}`];
    }
    setErrors(result);
    if (result.length === 0) onClose();
  }

  return (
    <section>
      <h2>{initial.id ? `Edit ${initial.manufacturer} ${initial.model}` : 'New Profile'}</h2>
      <p>
        <label>
          Manufacturer{' '}
          <input
            value={profile.manufacturer}
            onChange={(e) => setIdentity({ manufacturer: e.target.value })}
          />
        </label>{' '}
        <label>
          Model{' '}
          <input value={profile.model} onChange={(e) => setIdentity({ model: e.target.value })} />
        </label>{' '}
        <label>
          Default Role{' '}
          <select
            value={profile.defaultRole}
            onChange={(e) => setProfile({ ...profile, defaultRole: e.target.value as Role })}
          >
            {ROLES.map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
        </label>{' '}
        <small>Id: {profile.id || '—'}</small>
      </p>

      <h3>Modes</h3>
      <p>
        {profile.modes.map((m, i) => (
          <button key={i} type="button" disabled={i === modeIndex} onClick={() => setModeIndex(i)}>
            {m.name || '(unnamed)'} · {m.channels.length}ch
          </button>
        ))}{' '}
        <button
          type="button"
          onClick={() => addMode(blankMode(`Mode ${profile.modes.length + 1}`))}
        >
          Add mode
        </button>
        {mode && (
          <button type="button" onClick={() => addMode({ ...mode, name: `${mode.name} copy` })}>
            Duplicate mode
          </button>
        )}
      </p>

      {mode && (
        <ModeEditor
          mode={mode}
          onChange={setMode}
          onRemove={profile.modes.length > 1 ? removeMode : undefined}
        />
      )}

      {errors.length > 0 && (
        <ul role="alert">
          {errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      )}
      <p>
        <button type="button" onClick={() => void save()}>
          Save to library
        </button>{' '}
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </p>
    </section>
  );
}

function ModeEditor({
  mode,
  onChange,
  onRemove,
}: {
  mode: FixtureMode;
  onChange(mode: FixtureMode): void;
  onRemove?: () => void;
}) {
  const controlNames = mode.channels.flatMap((c) => (c.kind === 'control' ? [c.name] : []));

  function setChannel(index: number, channel: Channel) {
    onChange({ ...mode, channels: mode.channels.map((c, i) => (i === index ? channel : c)) });
  }

  function moveChannel(index: number, by: -1 | 1) {
    const channels = [...mode.channels];
    const [moved] = channels.splice(index, 1);
    if (!moved) return;
    channels.splice(index + by, 0, moved);
    onChange({ ...mode, channels });
  }

  return (
    <div>
      <p>
        <label>
          Mode name{' '}
          <input value={mode.name} onChange={(e) => onChange({ ...mode, name: e.target.value })} />
        </label>{' '}
        {onRemove && (
          <button type="button" onClick={onRemove}>
            Remove mode
          </button>
        )}
      </p>
      <table>
        <thead>
          <tr>
            <th>DMX</th>
            <th>Kind</th>
            <th>Name</th>
            <th>Default</th>
            <th>Details</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {mode.channels.map((channel, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>
                <select
                  value={channel.kind}
                  onChange={(e) =>
                    setChannel(
                      index,
                      changeKind(
                        channel,
                        e.target.value as Channel['kind'],
                        otherControlNames(mode, index),
                      ),
                    )
                  }
                >
                  <option value="control">Control</option>
                  <option value="fine">Fine</option>
                  <option value="unused">Unused</option>
                </select>
              </td>
              {channel.kind === 'unused' ? (
                <td colSpan={3} />
              ) : (
                <>
                  <td>
                    <input
                      value={channel.name}
                      onChange={(e) => onChange(renameChannel(mode, index, e.target.value))}
                    />
                  </td>
                  <td>
                    <NumberInput
                      value={channel.defaultValue}
                      onChange={(defaultValue) => setChannel(index, { ...channel, defaultValue })}
                    />
                  </td>
                  <td>
                    {channel.kind === 'fine' ? (
                      <>
                        <label>
                          Of{' '}
                          <select
                            value={channel.of}
                            onChange={(e) => setChannel(index, { ...channel, of: e.target.value })}
                          >
                            {!controlNames.includes(channel.of) && <option>{channel.of}</option>}
                            {controlNames.map((name) => (
                              <option key={name}>{name}</option>
                            ))}
                          </select>
                        </label>{' '}
                        <label>
                          Byte{' '}
                          <select
                            value={channel.byte}
                            onChange={(e) =>
                              setChannel(index, { ...channel, byte: Number(e.target.value) })
                            }
                          >
                            <option value={1}>1 (16-bit)</option>
                            <option value={2}>2 (24-bit)</option>
                          </select>
                        </label>
                      </>
                    ) : (
                      <RangesEditor
                        ranges={channel.ranges}
                        onChange={(ranges) => setChannel(index, { ...channel, ranges })}
                      />
                    )}
                  </td>
                </>
              )}
              <td>
                <button type="button" disabled={index === 0} onClick={() => moveChannel(index, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === mode.channels.length - 1}
                  onClick={() => moveChannel(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...mode, channels: mode.channels.filter((_, i) => i !== index) })
                  }
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={() =>
          onChange({
            ...mode,
            channels: [...mode.channels, blankChannel(`Channel ${mode.channels.length + 1}`)],
          })
        }
      >
        Add channel
      </button>
    </div>
  );
}

// Control channels a fine channel at `index` may belong to: never itself.
function otherControlNames(mode: FixtureMode, index: number): string[] {
  return mode.channels.flatMap((c, i) => (i !== index && c.kind === 'control' ? [c.name] : []));
}

function changeKind(channel: Channel, kind: Channel['kind'], controlNames: string[]): Channel {
  if (kind === channel.kind) return channel;
  const name = channel.kind === 'unused' ? 'Channel' : channel.name;
  switch (kind) {
    case 'unused':
      return { kind };
    case 'control':
      return blankChannel(name);
    case 'fine':
      return { kind, name, of: controlNames[0] ?? '', byte: 1, defaultValue: 0 };
  }
}

function RangesEditor({
  ranges,
  onChange,
}: {
  ranges: CapabilityRange[];
  onChange(ranges: CapabilityRange[]): void;
}) {
  function setRange(index: number, range: CapabilityRange) {
    onChange(ranges.map((r, i) => (i === index ? range : r)));
  }

  return (
    <div>
      {ranges.map((range, index) => (
        <div key={index}>
          <NumberInput
            value={range.from}
            onChange={(from) => setRange(index, { ...range, from })}
          />
          –
          <NumberInput value={range.to} onChange={(to) => setRange(index, { ...range, to })} />{' '}
          <CapabilityEditor
            capability={range.capability}
            onChange={(capability) => setRange(index, { ...range, capability })}
          />{' '}
          <button type="button" onClick={() => onChange(ranges.filter((_, i) => i !== index))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...ranges, fullRange()])}>
        Add range
      </button>
    </div>
  );
}

// `unsupported` only comes from OFL import, so it is not offered here.
const CAPABILITY_TYPES: Capability['type'][] = [
  'intensity',
  'emitter',
  'wheelSlot',
  'pan',
  'tilt',
  'shutter',
  'strobe',
  'strobeSpeed',
  'none',
];

function defaultCapability(type: Capability['type']): Capability {
  switch (type) {
    case 'emitter':
      return { type, emitter: 'red' };
    case 'wheelSlot':
      return { type, slot: { name: 'Open', colour: '#ffffff' } };
    case 'shutter':
      return { type, effect: 'open' };
    case 'unsupported':
      return { type, feature: '' };
    default:
      return { type };
  }
}

function CapabilityEditor({
  capability,
  onChange,
}: {
  capability: Capability;
  onChange(capability: Capability): void;
}) {
  return (
    <>
      <select
        value={capability.type}
        onChange={(e) => onChange(defaultCapability(e.target.value as Capability['type']))}
      >
        {CAPABILITY_TYPES.map((type) => (
          <option key={type}>{type}</option>
        ))}
        {capability.type === 'unsupported' && <option>unsupported</option>}
      </select>{' '}
      <CapabilityFields capability={capability} onChange={onChange} />
    </>
  );
}

function CapabilityFields({
  capability,
  onChange,
}: {
  capability: Capability;
  onChange(capability: Capability): void;
}) {
  switch (capability.type) {
    case 'intensity':
      return (
        <SpanInput
          label="level"
          span={capability.level}
          onChange={(level) => onChange({ ...capability, level })}
        />
      );
    case 'emitter':
      return (
        <>
          <select
            value={capability.emitter}
            onChange={(e) => onChange({ ...capability, emitter: e.target.value as Emitter })}
          >
            {EMITTERS.map((emitter) => (
              <option key={emitter}>{emitter}</option>
            ))}
          </select>{' '}
          <SpanInput
            label="level"
            span={capability.level}
            onChange={(level) => onChange({ ...capability, level })}
          />
        </>
      );
    case 'wheelSlot':
      return (
        <>
          <input
            aria-label="Slot name"
            value={capability.slot.name}
            onChange={(e) =>
              onChange({ ...capability, slot: { ...capability.slot, name: e.target.value } })
            }
          />
          <input
            type="color"
            aria-label="Slot colour"
            value={capability.slot.colour}
            onChange={(e) =>
              onChange({ ...capability, slot: { ...capability.slot, colour: e.target.value } })
            }
          />
        </>
      );
    case 'pan':
    case 'tilt':
      return (
        <SpanInput
          label="degrees"
          span={capability.degrees}
          onChange={(degrees) => onChange({ ...capability, degrees })}
        />
      );
    case 'shutter':
      return (
        <select
          value={capability.effect}
          onChange={(e) => onChange({ ...capability, effect: e.target.value as 'open' | 'closed' })}
        >
          <option value="open">open</option>
          <option value="closed">closed</option>
        </select>
      );
    case 'strobe':
    case 'strobeSpeed':
      return (
        <SpanInput
          label="Hz"
          span={capability.hz}
          onChange={(hz) => onChange({ ...capability, hz })}
        />
      );
    case 'unsupported':
      return (
        <input
          aria-label="Feature"
          value={capability.feature}
          onChange={(e) => onChange({ ...capability, feature: e.target.value })}
        />
      );
    case 'none':
      return null;
  }
}

// An optional [start, end] pair. Clearing either end removes the span.
function SpanInput({
  label,
  span,
  onChange,
}: {
  label: string;
  span: Span | undefined;
  onChange(span: Span | undefined): void;
}) {
  const [start, end] = span ?? [undefined, undefined];
  function set(next: [number | undefined, number | undefined]) {
    const [s, e] = next;
    onChange(s === undefined || e === undefined ? undefined : [s, e]);
  }
  return (
    <small>
      {label} <OptionalNumberInput value={start} onChange={(s) => set([s, end ?? s])} />–
      <OptionalNumberInput value={end} onChange={(e) => set([start ?? e, e])} />
    </small>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange(value: number): void }) {
  return (
    <input
      type="number"
      style={{ width: '4em' }}
      value={value}
      onChange={(e) => {
        if (!Number.isNaN(e.target.valueAsNumber)) onChange(e.target.valueAsNumber);
      }}
    />
  );
}

function OptionalNumberInput({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange(value: number | undefined): void;
}) {
  return (
    <input
      type="number"
      step="any"
      style={{ width: '4em' }}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
    />
  );
}
