import { describe, expect, it } from 'vitest';
import type {
  Capability,
  CapabilityRange,
  Channel,
  FixtureProfile,
  Span,
} from '../shared/fixture-profile';
import { validateProfile } from './validate-profile';

// Profiles reach the validator from the Profile Editor and from library files
// (`readLibraryFile`). It trusts the Profile type: a library file's top-level
// shape is checked first, and a throw on malformed nested data is caught there
// and the Profile skipped. These tests pin what it does now with bad data:
// an error, a pass or a throw.

function control(name: string, capability: Capability = { type: 'intensity' }): Channel {
  return { kind: 'control', name, defaultValue: 0, ranges: [{ from: 0, to: 255, capability }] };
}

// A control channel "Dimmer" with exactly these ranges.
function dimmer(...ranges: CapabilityRange[]): Channel {
  return { kind: 'control', name: 'Dimmer', defaultValue: 0, ranges };
}

function range(from: number, to: number, type: 'none' | 'intensity' | 'strobe' = 'intensity') {
  return { from, to, capability: { type } };
}

function fine(name: string, of: string, byte = 1): Channel {
  return { kind: 'fine', name, of, byte, defaultValue: 0 };
}

// A minimal valid Profile with one mode of the given channels.
function profile(channels: Channel[] = [control('Dimmer')], name = 'Standard'): FixtureProfile {
  return {
    id: 'acme/spot',
    manufacturer: 'Acme',
    model: 'Spot',
    defaultRole: 'Spot/Beam',
    modes: [{ name, channels }],
  };
}

// `data` with its first mode twice.
function twice(data: FixtureProfile): FixtureProfile {
  return { ...data, modes: [data.modes[0]!, data.modes[0]!] };
}

// Five channels: one of each kind, and the capabilities with fields the
// validator reads.
const FULL: Channel[] = [
  control('Dimmer'),
  control('Pan', { type: 'pan', degrees: [-270, 270] }),
  fine('Pan fine', 'Pan'),
  { kind: 'unused' },
  control('Colour', { type: 'wheelSlot', slot: { name: 'Open', colour: '#ffffff' } }),
];

// Keys from a Profile down to one of its fields.
type Path = (string | number)[];

// `FULL` as plain data with the value at `path` set, as a library file could
// hold it. `undefined` removes the field.
function malformed(path: Path, value: unknown): FixtureProfile {
  const data = structuredClone(profile(FULL)) as unknown as Record<string, unknown>;
  const parent = path
    .slice(0, -1)
    .reduce<Record<string, unknown>>((at, key) => at[key] as Record<string, unknown>, data);
  const key = path.at(-1)!;
  if (!(key in parent)) throw new Error(`FULL has no ${path.join('.')}`);
  if (value === undefined) delete parent[key];
  else parent[key] = value;
  return data as unknown as FixtureProfile;
}

// Validates `profile` when called, for `toThrow`.
const validating = (profile: FixtureProfile) => () => validateProfile(profile);

// Paths to channel `n` of `FULL` (from 1), its first range and that range's
// capability.
const channelPath = (n: number): Path => ['modes', 0, 'channels', n - 1];
const rangePath = (n: number): Path => [...channelPath(n), 'ranges', 0];
const capabilityPath = (n: number): Path => [...rangePath(n), 'capability'];

describe('valid Profiles', () => {
  it('passes a minimal valid Profile', () => {
    expect(validateProfile(profile())).toEqual([]);
    expect(validateProfile(profile(FULL))).toEqual([]);
  });
});

describe('required fields', () => {
  it.each([
    ['id', 'Id is required'],
    ['manufacturer', 'Manufacturer is required'],
    ['model', 'Model is required'],
  ])('fails a blank %s with an error naming it', (field, error) => {
    expect(validateProfile({ ...profile(), [field]: '' })).toEqual([error]);
    expect(validateProfile({ ...profile(), [field]: ' \t\n' })).toEqual([error]);
  });

  it('fails a Profile with no modes', () => {
    expect(validateProfile({ ...profile(), modes: [] })).toEqual(['At least one mode is required']);
  });

  it('fails a mode without a name', () => {
    expect(validateProfile(profile(undefined, ' '))).toEqual(['Every mode needs a name']);
  });

  it('fails a control or fine channel without a name, naming the channel by number', () => {
    expect(validateProfile(profile([control(' ')]))).toEqual([
      'Mode "Standard", channel 1 " ": name is required',
    ]);
    expect(validateProfile(profile([control('Pan'), fine('', 'Pan')]))).toEqual([
      'Mode "Standard", channel 2 "": name is required',
    ]);
  });

  it('fails a control channel without ranges', () => {
    expect(validateProfile(profile([dimmer()]))).toEqual([
      'Mode "Standard", channel 1 "Dimmer": at least one range is required',
    ]);
  });

  it('throws on a missing string field: callers check the top-level shape first', () => {
    for (const field of ['id', 'manufacturer', 'model']) {
      expect(validating(malformed([field], undefined))).toThrow(TypeError);
    }
    expect(validating(malformed(['modes', 0, 'name'], undefined))).toThrow(TypeError);
    expect(validating(malformed([...channelPath(1), 'name'], undefined))).toThrow(TypeError);
  });

  it('does not check defaultRole; readLibraryFile does', () => {
    expect(validateProfile(malformed(['defaultRole'], undefined))).toEqual([]);
    expect(validateProfile(malformed(['defaultRole'], 'Disco ball'))).toEqual([]);
  });
});

describe('wrong types', () => {
  // [field, path, value, what happens]. A string is the error it gives.
  const cases: [string, Path, unknown, 'throws' | 'passes' | string][] = [
    // Strings the validator trims throw on anything else.
    ['id', ['id'], 5, 'throws'],
    ['id', ['id'], null, 'throws'],
    ['manufacturer', ['manufacturer'], {}, 'throws'],
    ['model', ['model'], ['Spot'], 'throws'],
    ['mode name', ['modes', 0, 'name'], 5, 'throws'],
    ['channel name', [...channelPath(1), 'name'], null, 'throws'],
    // Arrays: an object, null or a string throws.
    ['modes', ['modes'], {}, 'throws'],
    ['modes', ['modes'], null, 'throws'],
    ['modes', ['modes'], 'Standard', 'throws'],
    ['mode', ['modes', 0], null, 'throws'],
    ['channels', ['modes', 0, 'channels'], {}, 'throws'],
    ['channels', ['modes', 0, 'channels'], null, 'throws'],
    ['channel', channelPath(1), null, 'throws'],
    ['ranges', [...channelPath(1), 'ranges'], {}, 'throws'],
    ['ranges', [...channelPath(1), 'ranges'], null, 'throws'],
    ['ranges', [...channelPath(1), 'ranges'], 'abc', 'throws'],
    ['range', rangePath(1), null, 'throws'],
    ['capability', capabilityPath(1), null, 'throws'],
    ['wheel slot', [...capabilityPath(5), 'slot'], null, 'throws'],
    // Numbers: a string or null is not a DMX value.
    [
      'default value',
      [...channelPath(1), 'defaultValue'],
      '0',
      'Mode "Standard", channel 1 "Dimmer": default value must be a whole number from 0 to 255',
    ],
    [
      'default value',
      [...channelPath(3), 'defaultValue'],
      null,
      'Mode "Standard", channel 3 "Pan fine": default value must be a whole number from 0 to 255',
    ],
    [
      'range start',
      [...rangePath(1), 'from'],
      '0',
      'Mode "Standard", channel 1 "Dimmer": range 0–255 must run from low to high within 0–255',
    ],
    [
      'range end',
      [...rangePath(1), 'to'],
      null,
      'Mode "Standard", channel 1 "Dimmer": range 0–null must run from low to high within 0–255',
    ],
    [
      'fine byte',
      [...channelPath(3), 'byte'],
      '1',
      'Mode "Standard", channel 3 "Pan fine": fine byte must be 1 or 2',
    ],
    [
      'fine of',
      [...channelPath(3), 'of'],
      null,
      'Mode "Standard", channel 3 "Pan fine": fine channel of "null", which is not in this mode',
    ],
    [
      'wheel slot colour',
      [...capabilityPath(5), 'slot', 'colour'],
      0xffffff,
      'Mode "Standard", channel 5 "Colour": wheel slot "Open" colour must be #rrggbb',
    ],
    // Not checked here.
    [
      'pan degrees',
      [...capabilityPath(2), 'degrees'],
      'wide',
      'Mode "Standard", channel 2 "Pan": pan degrees must be two finite numbers',
    ],
    ['capability', capabilityPath(1), {}, 'passes'],
    ['capability type', [...capabilityPath(1), 'type'], 'laser', 'passes'],
    ['emitter', capabilityPath(1), { type: 'emitter', emitter: 'infrared' }, 'passes'],
    ['channel kind', [...channelPath(1), 'kind'], 'dimmer', 'passes'],
  ];

  it.each(cases)('%s at %j set to %j: %s', (_, path, value, outcome) => {
    const run = validating(malformed(path, value));
    if (outcome === 'throws') expect(run).toThrow(TypeError);
    else expect(run()).toEqual(outcome === 'passes' ? [] : [outcome]);
  });

  it('treats a channel of unknown kind as a control channel', () => {
    expect(validateProfile(malformed([...channelPath(1), 'kind'], undefined))).toEqual([]);
    expect(
      validating(malformed(channelPath(1), { kind: 'dimmer', name: 'X', defaultValue: 0 })),
    ).toThrow(TypeError);
  });

  it('passes extra unknown fields everywhere', () => {
    const extra = { notes: 'hi', dmx: [1, 2, 3], nested: { deep: true } };
    const data = profile(FULL);
    const withExtra = {
      ...data,
      ...extra,
      modes: data.modes.map((mode) => ({
        ...mode,
        ...extra,
        channels: mode.channels.map((channel) =>
          channel.kind === 'control'
            ? {
                ...channel,
                ...extra,
                ranges: channel.ranges.map((range) => ({
                  ...range,
                  ...extra,
                  capability: { ...range.capability, ...extra },
                })),
              }
            : { ...channel, ...extra },
        ),
      })),
    };
    expect(validateProfile(withExtra)).toEqual([]);
  });
});

describe('modes', () => {
  it('fails an empty mode', () => {
    expect(validateProfile(profile([]))).toEqual(['Mode "Standard" has no channels']);
  });

  it('fails a mode name used twice', () => {
    expect(validateProfile(twice(profile()))).toEqual(['Mode name "Standard" is used twice']);
  });

  it('fails a channel name used twice, once per name, across control and fine channels', () => {
    const channels = [control('Pan'), control('Pan'), control('Pan'), fine('Pan', 'Pan')];
    expect(validateProfile(profile(channels))).toEqual([
      'Mode "Standard": channel name "Pan" is used twice',
    ]);
  });

  it('allows any number of unused channels', () => {
    const unused: Channel = { kind: 'unused' };
    expect(validateProfile(profile([unused, control('Dimmer'), unused, unused]))).toEqual([]);
  });

  it('passes a mode over 512 channels: the Venue Patch checks the Universe end', () => {
    const channels = Array.from({ length: 600 }, (_, i) => control(`Channel ${i + 1}`));
    expect(validateProfile(profile(channels))).toEqual([]);
  });

  it('fails a fine channel of a channel not in this mode, or of another fine channel', () => {
    const data = profile([control('Pan'), fine('Pan fine', 'Pan')]);
    data.modes.push({ name: 'Basic', channels: [control('Tilt'), fine('Pan fine', 'Pan')] });
    expect(validateProfile(data)).toEqual([
      'Mode "Basic", channel 2 "Pan fine": fine channel of "Pan", which is not in this mode',
    ]);
    expect(
      validateProfile(profile([control('Pan'), fine('Pan fine', 'Pan'), fine('X', 'Pan fine')])),
    ).toEqual([
      'Mode "Standard", channel 3 "X": fine channel of "Pan fine", which is not in this mode',
    ]);
  });

  it('fails a fine byte other than 1 or 2', () => {
    for (const byte of [0, 3, -1, 1.5, NaN]) {
      expect(validateProfile(profile([control('Pan'), fine('Pan fine', 'Pan', byte)]))).toEqual([
        'Mode "Standard", channel 2 "Pan fine": fine byte must be 1 or 2',
      ]);
    }
  });

  it('passes overlapping fine channels: two for the same byte, or byte 2 without byte 1', () => {
    expect(
      validateProfile(profile([control('Pan'), fine('Pan fine', 'Pan'), fine('Pan low', 'Pan')])),
    ).toEqual([]);
    expect(validateProfile(profile([control('Pan'), fine('Pan fine^2', 'Pan', 2)]))).toEqual([]);
  });

  it('does not parse Cell names: any "(Cell N)" spelling passes, duplicates still fail', () => {
    const names = ['Dimmer (Cell 1)', 'Dimmer (Cell)', 'Dimmer (Cell -1)', '(Cell 1)', 'Cell 1)'];
    expect(validateProfile(profile(names.map((name) => control(name))))).toEqual([]);
    expect(
      validateProfile(profile([control('Dimmer (Cell 1)'), control('Dimmer (Cell 1)')])),
    ).toEqual(['Mode "Standard": channel name "Dimmer (Cell 1)" is used twice']);
  });

  it('lists every error in every mode', () => {
    const data = profile([control('Dimmer'), control('Dimmer')]);
    data.modes.push({ name: 'Empty', channels: [] });
    expect(validateProfile({ ...data, id: '' })).toEqual([
      'Id is required',
      'Mode "Standard": channel name "Dimmer" is used twice',
      'Mode "Empty" has no channels',
    ]);
  });
});

describe('numbers', () => {
  const BAD = [-1, 256, 1.5, NaN, Infinity, -Infinity];

  it('fails a default value that is not a whole number from 0 to 255', () => {
    const error =
      'Mode "Standard", channel 1 "Dimmer": default value must be a whole number from 0 to 255';
    for (const defaultValue of [...BAD, 0, 255]) {
      const channel = { ...dimmer(range(0, 255)), defaultValue } as Channel;
      expect(validateProfile(profile([channel]))).toEqual(
        BAD.includes(defaultValue) ? [error] : [],
      );
    }
  });

  it('fails a range end that is not a whole number from 0 to 255', () => {
    for (const value of BAD) {
      expect(validateProfile(profile([dimmer(range(value, 255))]))).toEqual([
        `Mode "Standard", channel 1 "Dimmer": range ${value}–255 must run from low to high within 0–255`,
      ]);
      expect(validateProfile(profile([dimmer(range(0, value))]))).toEqual([
        `Mode "Standard", channel 1 "Dimmer": range 0–${value} must run from low to high within 0–255`,
      ]);
    }
  });

  it('fails a range that runs high to low, and ranges that overlap', () => {
    const channel = dimmer(range(100, 50, 'none'), range(0, 120), range(121, 255, 'strobe'));
    expect(validateProfile(profile([channel]))).toEqual([
      'Mode "Standard", channel 1 "Dimmer": range 100–50 must run from low to high within 0–255',
      'Mode "Standard", channel 1 "Dimmer": ranges 0–120 and 100–50 overlap',
    ]);
  });

  it('fails ranges that share an end value', () => {
    const channel = dimmer(range(0, 127), range(127, 255, 'strobe'));
    expect(validateProfile(profile([channel]))).toEqual([
      'Mode "Standard", channel 1 "Dimmer": ranges 0–127 and 127–255 overlap',
    ]);
  });

  it('passes ranges given out of order that do not overlap', () => {
    const channel = dimmer(range(128, 255, 'strobe'), range(0, 127));
    expect(validateProfile(profile([channel]))).toEqual([]);
  });

  it('passes zero and reversed pan or tilt degree spans', () => {
    for (const degrees of [
      [0, 0],
      [270, -270],
      [-10, -20],
    ] as Span[]) {
      const channels = [
        control('Pan', { type: 'pan', degrees }),
        control('Tilt', { type: 'tilt', degrees }),
      ];
      expect(validateProfile(profile(channels))).toEqual([]);
    }
  });

  // Fixed in this issue: such a span made the pan or tilt DMX value, or the
  // intensity, NaN, which the Output sends as 0.
  it('fails a span that is not two finite numbers', () => {
    const spans: unknown[] = [
      [NaN, 540],
      [0, Infinity],
      [-Infinity, 0],
      [0],
      [0, 1, 2],
      ['0', 1],
      'wide',
      {},
    ];
    for (const span of spans) {
      const capabilities = [
        { type: 'pan', degrees: span },
        { type: 'tilt', degrees: span },
        { type: 'intensity', level: span },
        { type: 'emitter', emitter: 'red', level: span },
        { type: 'strobe', hz: span },
        { type: 'strobeSpeed', hz: span },
      ] as Capability[];
      const channels = capabilities.map((capability, i) => control(`C${i + 1}`, capability));
      expect(validateProfile(profile(channels))).toEqual([
        'Mode "Standard", channel 1 "C1": pan degrees must be two finite numbers',
        'Mode "Standard", channel 2 "C2": tilt degrees must be two finite numbers',
        'Mode "Standard", channel 3 "C3": intensity level must be two finite numbers',
        'Mode "Standard", channel 4 "C4": emitter level must be two finite numbers',
        'Mode "Standard", channel 5 "C5": strobe hz must be two finite numbers',
        'Mode "Standard", channel 6 "C6": strobeSpeed hz must be two finite numbers',
      ]);
    }
  });

  it('passes a span left out or null, which reads as not given', () => {
    for (const degrees of [undefined, null]) {
      const pan = { type: 'pan', degrees } as Capability;
      expect(validateProfile(profile([control('Pan', pan)]))).toEqual([]);
    }
  });
});

describe('strings', () => {
  const MEGABYTE = 'x'.repeat(1024 * 1024);

  it('passes 1 MB names', () => {
    const data = profile([control(MEGABYTE), control(`${MEGABYTE}y`)], MEGABYTE);
    expect(
      validateProfile({ ...data, id: MEGABYTE, manufacturer: MEGABYTE, model: MEGABYTE }),
    ).toEqual([]);
  });

  it('fails a 1 MB blank id and 1 MB duplicate names, quoting the name in full', () => {
    expect(validateProfile({ ...profile(), id: ' '.repeat(1024 * 1024) })).toEqual([
      'Id is required',
    ]);
    const [error] = validateProfile(profile([control(MEGABYTE), control(MEGABYTE)]));
    expect(error).toBe(`Mode "Standard": channel name "${MEGABYTE}" is used twice`);
  });

  it('passes names with control characters', () => {
    const name = 'Dim\u0000mer\u0007\u001b[31m\r\n ';
    const data = profile([control(name)], name);
    expect(validateProfile({ ...data, manufacturer: name, model: name })).toEqual([]);
  });

  it('fails a wheel slot colour that is not exactly #rrggbb', () => {
    for (const colour of ['#fff', 'ffffff', '#ffffff\n', '#gggggg', '#ffffff00', '']) {
      const channel = control('Colour', { type: 'wheelSlot', slot: { name: 'Open', colour } });
      expect(validateProfile(profile([channel]))).toEqual([
        'Mode "Standard", channel 1 "Colour": wheel slot "Open" colour must be #rrggbb',
      ]);
    }
    const upper = control('Colour', {
      type: 'wheelSlot',
      slot: { name: 'Red', colour: '#FF0000' },
    });
    expect(validateProfile(profile([upper]))).toEqual([]);
  });
});

describe('prototype keys', () => {
  // As a library file brings them: JSON.parse makes `__proto__` an own key.
  const hostile = JSON.parse(`{
    "id": "acme/spot", "manufacturer": "Acme", "model": "Spot", "defaultRole": "Wash",
    "__proto__": { "polluted": true },
    "constructor": { "prototype": { "polluted": true } },
    "prototype": { "polluted": true },
    "modes": [{
      "name": "__proto__",
      "__proto__": { "polluted": true },
      "channels": [
        { "kind": "control", "name": "constructor", "defaultValue": 0,
          "__proto__": { "kind": "fine" },
          "ranges": [{ "from": 0, "to": 255, "__proto__": { "polluted": true },
            "capability": { "type": "wheelSlot", "__proto__": { "polluted": true },
              "slot": { "name": "prototype", "colour": "#ffffff", "__proto__": { "polluted": true } } } }] },
        { "kind": "fine", "name": "__proto__", "of": "constructor", "byte": 1, "defaultValue": 0 },
        { "kind": "fine", "name": "prototype", "of": "hasOwnProperty", "byte": 1, "defaultValue": 0 }
      ]
    }]
  }`) as FixtureProfile;

  it('treats them as plain names and leaves Object.prototype alone', () => {
    expect(validateProfile(hostile)).toEqual([
      'Mode "__proto__", channel 3 "prototype": fine channel of "hasOwnProperty", which is not in this mode',
    ]);
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('counts a mode or channel named __proto__ twice as a duplicate', () => {
    const channels = [control('__proto__'), control('__proto__')];
    expect(validateProfile(twice(profile(channels, '__proto__')))).toEqual([
      'Mode name "__proto__" is used twice',
      'Mode "__proto__": channel name "__proto__" is used twice',
      'Mode "__proto__": channel name "__proto__" is used twice',
    ]);
  });
});
