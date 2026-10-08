import { plural } from './plural';

// The toast after a removal, naming what went with it: "Removed Warm, its 1
// Trigger and the Base Look".
export function removedMessage(name: string, also: string[] = []): string {
  return `Removed ${andList([name, ...also])}`;
}

// "2 Scenes: Warm, Blue".
export function namedCount(noun: string, names: string[]): string {
  return `${plural(names.length, noun)}: ${names.join(', ')}`;
}

// "a", "a and b", "a, b and c".
function andList(items: string[]): string {
  return items.length < 2
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
