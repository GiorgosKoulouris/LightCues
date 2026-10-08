import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { List } from './List';

const SCENES = [
  { id: 'a', name: 'Intro' },
  { id: 'b', name: 'Verse' },
  { id: 'c', name: 'Chorus' },
];

function Scenes(props: { initial?: string; onActivate?: (id: string) => void }) {
  const [selected, setSelected] = useState(props.initial);
  return (
    <List
      label="Scenes"
      items={SCENES}
      getKey={(scene) => scene.id}
      selectedKey={selected}
      onSelect={setSelected}
      onActivate={props.onActivate}
      renderItem={(scene) => scene.name}
      empty="No Scenes"
    />
  );
}

const selectedName = () => screen.getByRole('option', { selected: true }).textContent;

describe('List', () => {
  it('is one tab stop that exposes its items as options', async () => {
    render(<Scenes initial="b" />);
    await userEvent.tab();
    const list = screen.getByRole('listbox', { name: 'Scenes' });
    expect(list).toHaveFocus();
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(list).toHaveAttribute('aria-activedescendant', screen.getByText('Verse').id);
  });

  it('moves the selection with the arrow keys, Home and End, stopping at the ends', async () => {
    render(<Scenes initial="a" />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    expect(selectedName()).toBe('Verse');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(selectedName()).toBe('Chorus');
    await userEvent.keyboard('{ArrowUp}');
    expect(selectedName()).toBe('Verse');
    await userEvent.keyboard('{Home}');
    expect(selectedName()).toBe('Intro');
    await userEvent.keyboard('{ArrowUp}');
    expect(selectedName()).toBe('Intro');
    await userEvent.keyboard('{End}');
    expect(selectedName()).toBe('Chorus');
  });

  it('selects the first item on Arrow Down and the last on Arrow Up when nothing is selected', async () => {
    const { unmount } = render(<Scenes />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    expect(selectedName()).toBe('Intro');
    unmount();
    render(<Scenes />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowUp}');
    expect(selectedName()).toBe('Chorus');
  });

  it('selects on click and activates on Enter or double-click', async () => {
    const onActivate = vi.fn();
    render(<Scenes onActivate={onActivate} />);
    await userEvent.click(screen.getByText('Chorus'));
    expect(selectedName()).toBe('Chorus');
    expect(screen.getByRole('listbox')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onActivate).toHaveBeenLastCalledWith('c');
    await userEvent.dblClick(screen.getByText('Intro'));
    expect(onActivate).toHaveBeenLastCalledWith('a');
  });

  it('passes other keys on, so a view can remove the selected item with Del', async () => {
    const onKeyDown = vi.fn();
    render(
      <List
        label="Scenes"
        items={SCENES}
        getKey={(scene) => scene.id}
        selectedKey="a"
        onSelect={() => {}}
        renderItem={(scene) => scene.name}
        onKeyDown={(event) => onKeyDown(event.key)}
      />,
    );
    await userEvent.tab();
    await userEvent.keyboard('{Delete}');
    expect(onKeyDown).toHaveBeenCalledWith('Delete');
  });

  describe('Del', () => {
    function renderList(props: { selectedKey?: string; selectedKeys?: string[] }) {
      const onDelete = vi.fn();
      render(
        <List
          label="Scenes"
          // Chorus is hidden, as by a search.
          items={SCENES.slice(0, 2)}
          getKey={(scene) => scene.id}
          onSelect={() => {}}
          renderItem={(scene) => scene.name}
          onDelete={onDelete}
          {...props}
        />,
      );
      return onDelete;
    }

    it('deletes the selected item', async () => {
      const onDelete = renderList({ selectedKey: 'b' });
      await userEvent.tab();
      await userEvent.keyboard('{Delete}');
      expect(onDelete).toHaveBeenCalledOnce();
    });

    it('does nothing while the selected item is not listed', async () => {
      const onDelete = renderList({ selectedKey: 'c' });
      await userEvent.tab();
      await userEvent.keyboard('{Delete}');
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('deletes when any of several selected items is listed', async () => {
      const listed = renderList({ selectedKeys: ['b', 'c'] });
      await userEvent.tab();
      await userEvent.keyboard('{Delete}');
      expect(listed).toHaveBeenCalledOnce();
      cleanup();

      const hidden = renderList({ selectedKeys: ['c'] });
      await userEvent.tab();
      await userEvent.keyboard('{Delete}');
      expect(hidden).not.toHaveBeenCalled();
    });
  });

  it('shows the empty message when there are no items', () => {
    render(
      <List
        label="Scenes"
        items={[]}
        getKey={() => ''}
        onSelect={() => {}}
        renderItem={() => null}
        empty="No Scenes"
      />,
    );
    expect(screen.getByText('No Scenes')).toBeInTheDocument();
  });
});

describe('List with several selected', () => {
  function Multi({ onSelect }: { onSelect: (key: string, modifiers: object) => void }) {
    return (
      <List
        label="Scenes"
        items={SCENES}
        getKey={(scene) => scene.id}
        selectedKey="a"
        selectedKeys={['a', 'c']}
        onSelect={onSelect}
        group={(scene) => (scene.id === 'a' ? 'Start' : 'Song')}
        renderItem={(scene) => scene.name}
      />
    );
  }

  it('marks every selected item and groups items under headings', () => {
    render(<Multi onSelect={vi.fn()} />);
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
    expect(screen.getAllByRole('option', { selected: true }).map((o) => o.textContent)).toEqual([
      'Intro',
      'Chorus',
    ]);
    expect(screen.getByRole('group', { name: 'Song' })).toHaveTextContent('VerseChorus');
  });

  it('passes Shift and Ctrl from clicks and Shift from the arrow keys', async () => {
    const onSelect = vi.fn();
    render(<Multi onSelect={onSelect} />);
    const user = userEvent.setup();

    await user.keyboard('{Shift>}');
    await user.click(screen.getByText('Verse'));
    await user.keyboard('{/Shift}{Control>}');
    await user.click(screen.getByText('Chorus'));
    await user.keyboard('{/Control}{Shift>}{ArrowDown}{/Shift}');

    expect(onSelect.mock.calls).toEqual([
      ['b', { range: true, toggle: false }],
      ['c', { range: false, toggle: true }],
      ['b', { range: true, toggle: false }],
    ]);
  });
});
