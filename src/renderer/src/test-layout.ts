// jsdom lays nothing out. This gives each list item a box by its place in its
// list, so dnd-kit's keyboard sensor finds the item above and below.
import { vi } from 'vitest';

const ITEM_WIDTH = 200;
const ITEM_HEIGHT = 40;
const ITEM_GAP = 4;

export function stubListLayout(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const item = this.closest('li');
    const index = item?.parentElement ? [...item.parentElement.children].indexOf(item) : 0;
    return DOMRect.fromRect({
      x: 0,
      y: index * ITEM_HEIGHT,
      width: ITEM_WIDTH,
      height: ITEM_HEIGHT - ITEM_GAP,
    });
  });
}
