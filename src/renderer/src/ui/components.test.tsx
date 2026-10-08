import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Trash2 } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { Badge } from './Badge';
import { Button, IconButton } from './Button';
import { Checkbox } from './Checkbox';
import { Menu } from './Menu';
import { Popover } from './Popover';
import { Select } from './Select';
import { TooltipProvider } from './Tooltip';

describe('base components', () => {
  it('Button and IconButton are buttons with names; the icon label shows as a tooltip on focus', async () => {
    const onClick = vi.fn();
    render(
      <TooltipProvider delayDuration={0}>
        <Button variant="primary" onClick={onClick}>
          Save
        </Button>
        <IconButton icon={<Trash2 />} label="Remove Scene" variant="danger" />
      </TooltipProvider>,
    );
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Remove Scene' })).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Remove Scene');
  });

  it('Checkbox toggles with Space', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Fallback Panel" checked={false} onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('checkbox', { name: 'Fallback Panel' })).toBeInTheDocument();
  });

  it('Select is labelled and reports the chosen value', async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Role"
        value="wash"
        options={[
          { value: 'wash', label: 'Wash' },
          { value: 'spot', label: 'Spot' },
        ]}
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Role' }), 'Spot');
    expect(onChange).toHaveBeenCalledWith('spot');
  });

  it('Popover opens from its trigger, closes on Esc and returns focus', async () => {
    render(
      <Popover label="Show settings" trigger={<Button>Settings</Button>}>
        <Button>Inside</Button>
      </Popover>,
    );
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Show settings' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
  });

  it('Menu opens from the keyboard and runs the chosen item', async () => {
    const onRename = vi.fn();
    render(
      <Menu
        trigger={<Button>More</Button>}
        items={[
          { label: 'Rename', onSelect: onRename },
          { label: 'Remove', onSelect: () => {}, danger: true },
        ]}
      />,
    );
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(onRename).toHaveBeenCalledOnce();
  });

  it('Badge renders its text', () => {
    render(<Badge tone="active">Layer 2</Badge>);
    expect(screen.getByText('Layer 2')).toBeInTheDocument();
  });
});
