import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Tabs } from './Tabs';

const TABS = [
  { value: 'scenes', label: 'Scenes' },
  { value: 'triggers', label: 'Triggers' },
] as const;

function ShowTabs() {
  const [tab, setTab] = useState<'scenes' | 'triggers'>('scenes');
  return (
    <Tabs label="Show" tabs={TABS} value={tab} onChange={setTab}>
      {tab === 'scenes' ? 'Scene list' : 'Trigger table'}
    </Tabs>
  );
}

describe('Tabs', () => {
  it('shows the selected tab panel, labelled by its tab', () => {
    render(<ShowTabs />);
    expect(screen.getByRole('tab', { name: 'Scenes' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Scenes' })).toHaveTextContent('Scene list');
  });

  it('is one tab stop; the arrow keys move between tabs and wrap', async () => {
    render(<ShowTabs />);
    await userEvent.tab();
    expect(screen.getByRole('tab', { name: 'Scenes' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    const triggers = screen.getByRole('tab', { name: 'Triggers' });
    expect(triggers).toHaveFocus();
    expect(triggers).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Trigger table');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Scenes' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(triggers).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('tabpanel')).toHaveFocus();
  });

  it('selects on click', async () => {
    render(<ShowTabs />);
    await userEvent.click(screen.getByRole('tab', { name: 'Triggers' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Trigger table');
  });
});
