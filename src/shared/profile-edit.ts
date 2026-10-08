// Pure helpers for making and editing Fixture Profiles by hand. Shared so the
// OFL import and the editor derive ids the same way.
import {
  DMX_MAX_VALUE,
  type Capability,
  type CapabilityRange,
  type Channel,
  type FixtureMode,
  type FixtureProfile,
} from './fixture-profile';

// `<manufacturer-slug>/<model-slug>`, as used for imported Profiles.
export function profileId(manufacturer: string, model: string): string {
  return `${slug(manufacturer)}/${slug(model)}`;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Renames the channel at `index`. Fine channels link to their control
// channel by name, so the links follow a renamed control channel.
export function renameChannel(mode: FixtureMode, index: number, name: string): FixtureMode {
  const renamed = mode.channels[index];
  if (!renamed || renamed.kind === 'unused') return mode;
  const oldName = renamed.name;
  return {
    ...mode,
    channels: mode.channels.map((channel, i) => {
      if (i === index) return { ...renamed, name };
      if (renamed.kind === 'control' && channel.kind === 'fine' && channel.of === oldName) {
        return { ...channel, of: name };
      }
      return channel;
    }),
  };
}

export function blankProfile(): FixtureProfile {
  return {
    id: '',
    manufacturer: '',
    model: '',
    defaultRole: 'Wash',
    modes: [blankMode('1ch')],
  };
}

export function blankMode(name: string): FixtureMode {
  return { name, channels: [blankChannel('Dimmer')] };
}

export function blankChannel(name: string): Channel {
  return { kind: 'control', name, defaultValue: 0, ranges: [fullRange()] };
}

export function fullRange(capability: Capability = { type: 'intensity' }): CapabilityRange {
  return { from: 0, to: DMX_MAX_VALUE, capability };
}

// "Acme Par", as a Profile is named in messages.
export function profileName({ manufacturer, model }: FixtureProfile): string {
  return `${manufacturer} ${model}`.trim();
}
