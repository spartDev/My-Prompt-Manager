import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import ToggleSwitch from '../ToggleSwitch';

describe('ToggleSwitch', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders in unchecked state by default', () => {
    render(<ToggleSwitch checked={false} onChange={mockOnChange} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('renders in checked state when checked prop is true', () => {
    render(<ToggleSwitch checked={true} onChange={mockOnChange} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with opposite value when clicked', () => {
    render(<ToggleSwitch checked={false} onChange={mockOnChange} />);

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with false when checked and clicked', () => {
    render(<ToggleSwitch checked={true} onChange={mockOnChange} />);

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(mockOnChange).toHaveBeenCalledWith(false);
  });

  it('applies disabled attribute when disabled prop is true', () => {
    render(<ToggleSwitch checked={false} onChange={mockOnChange} disabled={true} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();
  });

  it('does not call onChange when disabled and clicked', () => {
    render(<ToggleSwitch checked={false} onChange={mockOnChange} disabled={true} />);

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('applies aria-label when provided', () => {
    render(
      <ToggleSwitch
        checked={false}
        onChange={mockOnChange}
        ariaLabel="Enable feature"
      />
    );

    const toggle = screen.getByLabelText('Enable feature');
    expect(toggle).toBeInTheDocument();
  });

  it('renders with medium size by default', () => {
    const { container } = render(
      <ToggleSwitch checked={false} onChange={mockOnChange} />
    );

    const toggle = container.querySelector('.w-11.h-6');
    expect(toggle).toBeInTheDocument();
  });

  it('renders with small size when size prop is small', () => {
    const { container } = render(
      <ToggleSwitch checked={false} onChange={mockOnChange} size="small" />
    );

    const toggle = container.querySelector('.w-9.h-5');
    expect(toggle).toBeInTheDocument();
  });

  it('applies gradient background when checked', () => {
    render(<ToggleSwitch checked={true} onChange={mockOnChange} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass('bg-gradient-to-r', 'from-purple-600', 'to-indigo-600');
  });

  it('applies gray background when unchecked', () => {
    render(<ToggleSwitch checked={false} onChange={mockOnChange} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass('bg-gray-200');
  });

  it('applies opacity when disabled', () => {
    render(<ToggleSwitch checked={false} onChange={mockOnChange} disabled={true} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass('opacity-50', 'cursor-not-allowed');
  });

  it('translates knob to right when checked (medium size)', () => {
    const { container } = render(
      <ToggleSwitch checked={true} onChange={mockOnChange} size="medium" />
    );

    const knob = container.querySelector('.translate-x-6');
    expect(knob).toBeInTheDocument();
  });

  it('translates knob to right when checked (small size)', () => {
    const { container } = render(
      <ToggleSwitch checked={true} onChange={mockOnChange} size="small" />
    );

    const knob = container.querySelector('.translate-x-5');
    expect(knob).toBeInTheDocument();
  });

  it('positions knob at start when unchecked', () => {
    const { container } = render(
      <ToggleSwitch checked={false} onChange={mockOnChange} />
    );

    const knob = container.querySelector('.translate-x-\\[2px\\]');
    expect(knob).toBeInTheDocument();
  });

  it('applies focus ring styles', () => {
    render(<ToggleSwitch checked={false} onChange={mockOnChange} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass('focus:outline-none', 'focus:ring-4');
  });

  it('has smooth transition animation', () => {
    render(<ToggleSwitch checked={false} onChange={mockOnChange} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass('transition-all', 'duration-200');
  });
});