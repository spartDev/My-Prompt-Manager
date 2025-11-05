import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import ToggleSwitch from '../ToggleSwitch';

describe('ToggleSwitch', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('should render in unchecked state by default', () => {
    render(<ToggleSwitch checked={false} onChange={mockOnChange} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('should render in checked state when checked prop is true', () => {
    render(<ToggleSwitch checked={true} onChange={mockOnChange} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('should call onChange with opposite value when clicked', async () => {
    const user = userEvent.setup();
    render(<ToggleSwitch checked={false} onChange={mockOnChange} />);

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it('should call onChange with false when checked and clicked', async () => {
    const user = userEvent.setup();
    render(<ToggleSwitch checked={true} onChange={mockOnChange} />);

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    expect(mockOnChange).toHaveBeenCalledWith(false);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<ToggleSwitch checked={false} onChange={mockOnChange} disabled={true} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();
  });

  it('should not call onChange when disabled and clicked', async () => {
    const user = userEvent.setup();
    render(<ToggleSwitch checked={false} onChange={mockOnChange} disabled={true} />);

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should be accessible with aria-label when provided', () => {
    render(
      <ToggleSwitch
        checked={false}
        onChange={mockOnChange}
        ariaLabel="Enable feature"
      />
    );

    const toggle = screen.getByLabelText('Enable feature');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('role', 'switch');
  });
});
