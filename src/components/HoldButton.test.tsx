import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HoldButton } from './HoldButton';

describe('<HoldButton />', () => {
  it('confirms at once from the keyboard', () => {
    const onConfirm = vi.fn();
    render(<HoldButton onConfirm={onConfirm}>Confirm exchange</HoldButton>);
    // A keyboard-initiated click has detail 0.
    fireEvent.click(screen.getByRole('button', { name: 'Confirm exchange' }), { detail: 0 });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('ignores a quick pointer click', () => {
    const onConfirm = vi.fn();
    render(<HoldButton onConfirm={onConfirm}>Confirm exchange</HoldButton>);
    const button = screen.getByRole('button', { name: 'Confirm exchange' });
    fireEvent.pointerDown(button, { button: 0 });
    fireEvent.pointerUp(button);
    fireEvent.click(button, { detail: 1 });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const onConfirm = vi.fn();
    render(
      <HoldButton onConfirm={onConfirm} disabled>
        Confirm exchange
      </HoldButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm exchange' }), { detail: 0 });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
