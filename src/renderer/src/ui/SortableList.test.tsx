import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubListLayout } from '../test-layout';
import { moveItem, SortableList } from './SortableList';

function Steps() {
  const [steps, setSteps] = useState(['Intro', 'Verse', 'Chorus']);
  return (
    <SortableList
      label="Steps"
      items={steps}
      getKey={(step) => step}
      itemLabel={(step) => step}
      onMove={(from, to) => setSteps(moveItem(steps, from, to))}
      renderItem={(step, _index, handle) => (
        <>
          {handle}
          <span>{step}</span>
        </>
      )}
    />
  );
}

const order = () => screen.getAllByRole('listitem').map((item) => item.textContent);

beforeEach(stubListLayout);
afterEach(() => vi.restoreAllMocks());

describe('SortableList', () => {
  it('moves an item with the keyboard: Space to pick up, arrows to move, Space to drop', async () => {
    render(<Steps />);
    screen.getByRole('button', { name: 'Move Intro' }).focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard(' ');
    await act(async () => {});
    expect(order()).toEqual(['Verse', 'Chorus', 'Intro']);
  });

  it('moves an item up', async () => {
    render(<Steps />);
    screen.getByRole('button', { name: 'Move Chorus' }).focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard(' ');
    await act(async () => {});
    expect(order()).toEqual(['Intro', 'Chorus', 'Verse']);
  });

  it('leaves the order on Esc', async () => {
    render(<Steps />);
    screen.getByRole('button', { name: 'Move Intro' }).focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Escape}');
    await act(async () => {});
    expect(order()).toEqual(['Intro', 'Verse', 'Chorus']);
  });

  it('is an ordered list named by its label', () => {
    render(<Steps />);
    expect(screen.getByRole('list', { name: 'Steps' }).tagName).toBe('OL');
  });
});

describe('moveItem', () => {
  it('moves an item down or up, leaving the input as it was', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(items, 2, 0)).toEqual(['c', 'a', 'b']);
    expect(items).toEqual(['a', 'b', 'c']);
  });
});
