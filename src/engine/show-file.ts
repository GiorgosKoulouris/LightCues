import { validateShow, type Show } from '../shared/show';

// The .lcshow file: a Show as versioned JSON.

const VERSION = 1;

interface ShowFile extends Show {
  version: number;
}

// Throws when the Show is invalid, so every saved file loads.
export function saveShowFile(show: Show): string {
  throwIfInvalid(validateShow(show));
  const file: ShowFile = { version: VERSION, ...show };
  return JSON.stringify(file);
}

// Throws when the file is of an unknown version, malformed, has fields the
// model lacks (such as Fixture ids or DMX values) or its Show is invalid.
export function loadShowFile(json: string): Show {
  const file = parse(json);
  if (typeof file !== 'object' || file === null) throw new Error('Invalid Show: not an object');
  const { version, ...show } = file as ShowFile;
  if (version !== VERSION) throw new Error(`Unsupported Show version: ${version}`);
  if (!hasParts(show)) {
    throw new Error('Invalid Show: layers, scenes and triggers are required');
  }
  throwIfInvalid(checkMalformed(() => [...unknownFields(file as ShowFile), ...validateShow(show)]));
  return show;
}

function throwIfInvalid(errors: string[]): void {
  if (errors.length > 0) throw new Error(['Invalid Show:', ...errors].join('\n'));
}

function parse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`Invalid Show: ${(error as Error).message}`, { cause: error });
  }
}

// The checks assume every part has its fields; a file need not.
function checkMalformed(check: () => string[]): string[] {
  try {
    return check();
  } catch {
    return ['a Layer, Scene, Rule or Trigger is missing fields'];
  }
}

function hasParts(show: Partial<Show>): boolean {
  const { layers, scenes, triggers } = show;
  return [layers, scenes, triggers].every(Array.isArray);
}

// Every field in the file that the Show model does not have, by path.
function unknownFields(file: ShowFile): string[] {
  const found: string[] = [];
  const allow = (value: object, fields: string[], path: string) => {
    for (const key of Object.keys(value)) {
      if (!fields.includes(key)) found.push(`unknown field "${path}${key}"`);
    }
  };
  allow(file, ['version', 'layers', 'scenes', 'triggers', 'baseLook'], '');
  file.layers.forEach((layer, i) => allow(layer, ['id', 'name'], `layers[${i}].`));
  file.scenes.forEach((scene, i) => {
    allow(scene, ['id', 'name', 'tags', 'layer', 'fadeIn', 'rules'], `scenes[${i}].`);
    scene.rules.forEach(({ target, colour, ...rest }, j) => {
      const at = `scenes[${i}].rules[${j}].`;
      allow(rest, ['intensity'], at);
      allow(target, ['zones', 'roles'], `${at}target.`);
      target.zones?.forEach((zone, k) => {
        allow(zone, ['row', 'column', 'level'], `${at}target.zones[${k}].`);
      });
      if (colour === undefined) return;
      allow(colour, 'swatch' in colour ? ['swatch'] : ['hue', 'saturation'], `${at}colour.`);
    });
  });
  file.triggers.forEach((trigger, i) => {
    allow(trigger, ['channel', 'note', 'scene', 'mode'], `triggers[${i}].`);
  });
  return found;
}
