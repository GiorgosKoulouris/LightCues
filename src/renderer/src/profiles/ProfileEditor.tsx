import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import {
  DMX_MAX_VALUE,
  EMITTERS,
  ROLES,
  type Capability,
  type CapabilityRange,
  type Channel,
  type FixtureMode,
  type FixtureProfile,
  type Span,
} from '../../../shared/fixture-profile';
import {
  blankChannel,
  blankMode,
  fullRange,
  profileId,
  renameChannel,
} from '../../../shared/profile-edit';
import { Badge } from '../ui/Badge';
import { Button, IconButton } from '../ui/Button';
import { NumberField, parseNumber, parseRequired, TextField } from '../ui/fields';
import { Select } from '../ui/Select';
import { Tabs } from '../ui/Tabs';
import styles from './ProfileEditor.module.css';

interface ProfileEditorProps {
  // The Profile with any unsaved edits.
  profile: FixtureProfile;
  title: string;
  unsaved: boolean;
  // Cancel is offered without edits, to close a new Profile.
  isNew: boolean;
  // Why the engine refused the last save.
  errors: string[];
  // While a save is on its way, Save is disabled.
  saving: boolean;
  onChange(profile: FixtureProfile): void;
  onSave(): void;
  onCancel(): void;
  onDelete?: () => void;
}

// Edits one Fixture Profile: identity and default Role in a header, then a
// tab per mode with its channel table. Edits stay a draft until Save (ADR
// 0004); a field that is not valid shows its error and is not taken.
export function ProfileEditor({
  profile,
  title,
  unsaved,
  isNew,
  errors,
  saving,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: ProfileEditorProps) {
  const [modeIndex, setModeIndex] = useState(0);
  // Modes can go away on Cancel.
  const index = Math.min(modeIndex, profile.modes.length - 1);
  const mode = profile.modes[index];

  function setIdentity(change: Partial<Pick<FixtureProfile, 'manufacturer' | 'model'>>) {
    const next = { ...profile, ...change };
    onChange({ ...next, id: profileId(next.manufacturer, next.model) });
  }

  const setModes = (modes: FixtureMode[]) => onChange({ ...profile, modes });

  function addMode(added: FixtureMode) {
    setModes([...profile.modes, added]);
    setModeIndex(profile.modes.length);
  }

  return (
    <section aria-label="Profile editor" className={styles.editor}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{title}</h2>
          {unsaved && <Badge tone="warning">Unsaved changes</Badge>}
          <div className={styles.actions}>
            {onDelete && <IconButton icon={<Trash2 />} label="Delete Profile" onClick={onDelete} />}
            <Button disabled={!unsaved && !isNew} onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!unsaved || saving} onClick={onSave}>
              Save
            </Button>
          </div>
        </div>
        <div className={styles.fields}>
          <TextField
            label="Manufacturer"
            value={profile.manufacturer}
            parse={parseRequired('Manufacturer')}
            onCommit={(manufacturer) => setIdentity({ manufacturer })}
          />
          <TextField
            label="Model"
            value={profile.model}
            parse={parseRequired('Model')}
            onCommit={(model) => setIdentity({ model })}
          />
          <Select
            label="Default Role"
            value={profile.defaultRole}
            options={ROLES.map((role) => ({ value: role, label: role }))}
            onChange={(defaultRole) => onChange({ ...profile, defaultRole })}
          />
        </div>
        <p className={styles.id}>
          Id <span className={styles.mono}>{profile.id || '—'}</span>
        </p>
        {errors.length > 0 && (
          <ul role="alert" className={styles.errors}>
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        )}
      </header>
      <Tabs
        label="Modes"
        tabs={profile.modes.map((m, i) => ({
          value: String(i),
          label: `${m.name || '(unnamed)'} · ${m.channels.length}ch`,
        }))}
        value={String(index)}
        onChange={(value) => setModeIndex(Number(value))}
        className={styles.modes}
        actions={
          <>
            <Button
              icon={<Plus />}
              onClick={() => addMode(blankMode(`Mode ${profile.modes.length + 1}`))}
            >
              Add mode
            </Button>
            {mode && (
              <Button
                icon={<Copy />}
                onClick={() => addMode({ ...mode, name: `${mode.name} copy` })}
              >
                Duplicate mode
              </Button>
            )}
          </>
        }
      >
        {mode && (
          <ModeEditor
            mode={mode}
            onChange={(next) => setModes(profile.modes.map((m, i) => (i === index ? next : m)))}
            onRemove={
              profile.modes.length > 1
                ? () => setModes(profile.modes.filter((_, i) => i !== index))
                : undefined
            }
          />
        )}
      </Tabs>
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
  const setChannels = (channels: Channel[]) => onChange({ ...mode, channels });

  function setChannel(index: number, channel: Channel) {
    setChannels(mode.channels.map((c, i) => (i === index ? channel : c)));
  }

  function moveChannel(index: number, by: -1 | 1) {
    const channels = [...mode.channels];
    const [moved] = channels.splice(index, 1);
    if (!moved) return;
    channels.splice(index + by, 0, moved);
    setChannels(channels);
  }

  return (
    <div className={styles.mode}>
      <div className={styles.modeBar}>
        <TextField
          label="Mode name"
          value={mode.name}
          parse={parseRequired('Mode name')}
          onCommit={(name) => onChange({ ...mode, name })}
          className={styles.modeName}
        />
        {onRemove && (
          <Button icon={<Trash2 />} onClick={onRemove} className={styles.removeMode}>
            Remove mode
          </Button>
        )}
      </div>
      <div className={styles.tableScroll}>
        <table aria-label="Channels" className={styles.table}>
          <thead>
            <tr>
              <th className={styles.dmx}>DMX</th>
              <th>Kind</th>
              <th>Name</th>
              <th>Default</th>
              <th>Details</th>
              <th>
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {mode.channels.map((channel, index) => {
              const n = index + 1;
              return (
                <tr key={index}>
                  <td className={styles.dmx}>{n}</td>
                  <td className={styles.kind}>
                    <Select
                      label={`Kind of channel ${n}`}
                      hideLabel
                      value={channel.kind}
                      options={KINDS}
                      onChange={(kind) =>
                        setChannel(index, changeKind(channel, kind, otherControlNames(mode, index)))
                      }
                    />
                  </td>
                  {channel.kind === 'unused' ? (
                    <td colSpan={3} />
                  ) : (
                    <>
                      <td className={styles.name}>
                        <TextField
                          label={`Name of channel ${n}`}
                          hideLabel
                          value={channel.name}
                          parse={parseRequired('Name')}
                          onCommit={(name) => onChange(renameChannel(mode, index, name))}
                        />
                      </td>
                      <td className={styles.number}>
                        <NumberField
                          label={`Default of channel ${n}`}
                          hideLabel
                          value={channel.defaultValue}
                          min={0}
                          max={DMX_MAX_VALUE}
                          onCommit={(defaultValue) =>
                            setChannel(index, { ...channel, defaultValue })
                          }
                        />
                      </td>
                      <td>
                        {channel.kind === 'fine' ? (
                          <div className={styles.inline}>
                            <Select
                              label={`Coarse channel of channel ${n}`}
                              hideLabel
                              value={channel.of}
                              options={[
                                ...(controlNames.includes(channel.of)
                                  ? []
                                  : [{ value: channel.of, label: channel.of || '(none)' }]),
                                ...controlNames.map((name) => ({ value: name, label: name })),
                              ]}
                              onChange={(of) => setChannel(index, { ...channel, of })}
                            />
                            <Select
                              label={`Byte of channel ${n}`}
                              hideLabel
                              value={String(channel.byte)}
                              options={BYTES}
                              onChange={(byte) =>
                                setChannel(index, { ...channel, byte: Number(byte) })
                              }
                            />
                          </div>
                        ) : (
                          <RangesEditor
                            channel={n}
                            ranges={channel.ranges}
                            onChange={(ranges) => setChannel(index, { ...channel, ranges })}
                          />
                        )}
                      </td>
                    </>
                  )}
                  <td className={styles.actions}>
                    <IconButton
                      icon={<ArrowUp />}
                      label={`Move channel ${n} up`}
                      disabled={index === 0}
                      onClick={() => moveChannel(index, -1)}
                    />
                    <IconButton
                      icon={<ArrowDown />}
                      label={`Move channel ${n} down`}
                      disabled={index === mode.channels.length - 1}
                      onClick={() => moveChannel(index, 1)}
                    />
                    <IconButton
                      icon={<Trash2 />}
                      label={`Remove channel ${n}`}
                      onClick={() => setChannels(mode.channels.filter((_, i) => i !== index))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button
        icon={<Plus />}
        className={styles.addChannel}
        onClick={() =>
          setChannels([...mode.channels, blankChannel(`Channel ${mode.channels.length + 1}`)])
        }
      >
        Add channel
      </Button>
    </div>
  );
}

const KINDS: { value: Channel['kind']; label: string }[] = [
  { value: 'control', label: 'Control' },
  { value: 'fine', label: 'Fine' },
  { value: 'unused', label: 'Unused' },
];

const BYTES = [
  { value: '1', label: '1 (16-bit)' },
  { value: '2', label: '2 (24-bit)' },
];

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

// The DMX ranges of control channel `channel` and what each does.
function RangesEditor({
  channel,
  ranges,
  onChange,
}: {
  channel: number;
  ranges: CapabilityRange[];
  onChange(ranges: CapabilityRange[]): void;
}) {
  function setRange(index: number, range: CapabilityRange) {
    onChange(ranges.map((r, i) => (i === index ? range : r)));
  }

  return (
    <div className={styles.ranges}>
      {ranges.map((range, index) => {
        const name = `channel ${channel} range ${index + 1}`;
        return (
          <div key={index} className={styles.inline}>
            <NumberField
              label={`Start of ${name}`}
              hideLabel
              value={range.from}
              min={0}
              max={DMX_MAX_VALUE}
              className={styles.dmxValue}
              onCommit={(from) => setRange(index, { ...range, from })}
            />
            <span className={styles.dash}>–</span>
            <NumberField
              label={`End of ${name}`}
              hideLabel
              value={range.to}
              min={0}
              max={DMX_MAX_VALUE}
              className={styles.dmxValue}
              onCommit={(to) => setRange(index, { ...range, to })}
            />
            <CapabilityEditor
              name={name}
              capability={range.capability}
              onChange={(capability) => setRange(index, { ...range, capability })}
            />
            <IconButton
              icon={<X />}
              label={`Remove ${name}`}
              onClick={() => onChange(ranges.filter((_, i) => i !== index))}
            />
          </div>
        );
      })}
      <Button
        variant="ghost"
        icon={<Plus />}
        className={styles.addRange}
        onClick={() => onChange([...ranges, fullRange()])}
      >
        Add range
      </Button>
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

interface CapabilityProps {
  // The range, as in "channel 2 range 1".
  name: string;
  capability: Capability;
  onChange(capability: Capability): void;
}

function CapabilityEditor({ name, capability, onChange }: CapabilityProps) {
  const types =
    capability.type === 'unsupported' ? [...CAPABILITY_TYPES, capability.type] : CAPABILITY_TYPES;
  return (
    <>
      <Select
        label={`Capability of ${name}`}
        hideLabel
        value={capability.type}
        options={types.map((type) => ({ value: type, label: type }))}
        onChange={(type) => onChange(defaultCapability(type))}
      />
      <CapabilityFields name={name} capability={capability} onChange={onChange} />
    </>
  );
}

function CapabilityFields({ name, capability, onChange }: CapabilityProps) {
  switch (capability.type) {
    case 'intensity':
      return (
        <SpanInput
          label={`Level of ${name}`}
          unit="level"
          span={capability.level}
          onChange={(level) => onChange({ ...capability, level })}
        />
      );
    case 'emitter':
      return (
        <>
          <Select
            label={`Emitter of ${name}`}
            hideLabel
            value={capability.emitter}
            options={EMITTERS.map((emitter) => ({ value: emitter, label: emitter }))}
            onChange={(emitter) => onChange({ ...capability, emitter })}
          />
          <SpanInput
            label={`Level of ${name}`}
            unit="level"
            span={capability.level}
            onChange={(level) => onChange({ ...capability, level })}
          />
        </>
      );
    case 'wheelSlot':
      return (
        <>
          <TextField
            label={`Slot name of ${name}`}
            hideLabel
            value={capability.slot.name}
            parse={parseRequired('Slot name')}
            onCommit={(slotName) =>
              onChange({ ...capability, slot: { ...capability.slot, name: slotName } })
            }
          />
          <input
            type="color"
            aria-label={`Slot colour of ${name}`}
            className={styles.colour}
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
          label={`Degrees of ${name}`}
          unit="°"
          span={capability.degrees}
          onChange={(degrees) => onChange({ ...capability, degrees })}
        />
      );
    case 'shutter':
      return (
        <Select
          label={`Shutter of ${name}`}
          hideLabel
          value={capability.effect}
          options={[
            { value: 'open', label: 'open' },
            { value: 'closed', label: 'closed' },
          ]}
          onChange={(effect) => onChange({ ...capability, effect })}
        />
      );
    case 'strobe':
    case 'strobeSpeed':
      return (
        <SpanInput
          label={`Hz of ${name}`}
          unit="Hz"
          span={capability.hz}
          onChange={(hz) => onChange({ ...capability, hz })}
        />
      );
    case 'unsupported':
      return (
        <TextField
          label={`Feature of ${name}`}
          hideLabel
          value={capability.feature}
          parse={(text) => ({ ok: true, value: text })}
          onCommit={(feature) => onChange({ ...capability, feature })}
        />
      );
    case 'none':
      return null;
  }
}

// An optional [start, end] pair. Clearing either end removes the span.
function SpanInput({
  label,
  unit,
  span,
  onChange,
}: {
  label: string;
  unit: string;
  span: Span | undefined;
  onChange(span: Span | undefined): void;
}) {
  const [start, end] = span ?? [undefined, undefined];
  function set(s: number | undefined, e: number | undefined) {
    onChange(s === undefined || e === undefined ? undefined : [s, e]);
  }
  return (
    <span className={styles.inline}>
      <OptionalNumberField
        label={`${label}, start`}
        value={start}
        onCommit={(s) => set(s, end ?? s)}
      />
      <span className={styles.dash}>–</span>
      <OptionalNumberField
        label={`${label}, end`}
        value={end}
        onCommit={(e) => set(start ?? e, e)}
      />
      <span className={styles.unit}>{unit}</span>
    </span>
  );
}

// A number that may be left empty.
function OptionalNumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  onCommit(value: number | undefined): void;
}) {
  return (
    <TextField
      label={label}
      hideLabel
      mono
      inputMode="decimal"
      className={styles.spanValue}
      value={value}
      format={(v) => (v === undefined ? '' : String(v))}
      parse={(text) =>
        text.trim() === '' ? { ok: true, value: undefined } : parseNumber(text, { integer: false })
      }
      onCommit={onCommit}
    />
  );
}
