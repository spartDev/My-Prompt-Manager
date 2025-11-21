
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { PRESET_COLORS } from '../../constants/colors';
import ColorPicker from '../ColorPicker';

describe('ColorPicker', () => {
  const mockOnChange = vi.fn();
  const defaultProps = {
    value: '#FF0000',
    onChange: mockOnChange,
    label: 'Select Color'
  };

  it('renders color picker with label and current color', () => {
    render(<ColorPicker {...defaultProps} />);

    expect(screen.getByText('Select Color')).toBeInTheDocument();

    // The trigger button shows the color name if available
    const currentColorName = PRESET_COLORS.find(c => c.value === '#FF0000')?.name;
    if (currentColorName) {
      expect(screen.getByText(currentColorName)).toBeInTheDocument();
    }
  });

  it('renders compact mode correctly', () => {
    render(<ColorPicker {...defaultProps} compact={true} />);

    // Should not show label text inside the button in compact mode
    const currentColorName = PRESET_COLORS.find(c => c.value === '#FF0000')?.name;
    if (currentColorName) {
      expect(screen.queryByText(currentColorName)).not.toBeInTheDocument();
    }

    // But the label prop should still render above if provided
    expect(screen.getByText('Select Color')).toBeInTheDocument();
  });

  it('opens dropdown on click', async () => {
    render(<ColorPicker {...defaultProps} />);

    const trigger = screen.getByRole('button');
    await userEvent.click(trigger);

    expect(screen.getByText('Preset Colors')).toBeInTheDocument();
    expect(screen.getByText('Custom Color')).toBeInTheDocument();
  });

  it('selects a preset color', async () => {
    render(<ColorPicker {...defaultProps} />);

    // Open dropdown
    await userEvent.click(screen.getByRole('button'));

    // Find a different preset color
    const targetColor = PRESET_COLORS.find(c => c.value !== '#FF0000');
    expect(targetColor).toBeDefined();

    if (targetColor) {
      const colorButton = screen.getByTitle(targetColor.name);
      await userEvent.click(colorButton);

      expect(mockOnChange).toHaveBeenCalledWith(targetColor.value);
    }
  });

  it('allows entering hex code manually', async () => {
    render(<ColorPicker {...defaultProps} />);

    // Open dropdown
    await userEvent.click(screen.getByRole('button'));

    // Click "Enter Hex Code"
    await userEvent.click(screen.getByText('Enter Hex Code'));

    // Input new hex
    const input = screen.getByPlaceholderText('#000000');
    await userEvent.clear(input);
    await userEvent.type(input, '#00FF00');

    // Click Apply
    const applyButton = screen.getByTitle('Apply');
    await userEvent.click(applyButton);

    expect(mockOnChange).toHaveBeenCalledWith('#00FF00');
  });

  it('validates hex input', async () => {
    render(<ColorPicker {...defaultProps} />);

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('Enter Hex Code'));

    const input = screen.getByPlaceholderText('#000000');
    await userEvent.clear(input);
    await userEvent.type(input, 'invalid');

    const applyButton = screen.getByTitle('Apply');
    expect(applyButton).toBeDisabled();
  });

  it('syncs internal state when value prop changes', () => {
    const { rerender } = render(<ColorPicker {...defaultProps} />);

    // Update prop
    rerender(<ColorPicker {...defaultProps} value="#0000FF" />);

    // Check if displayed color name updated
    const newColorName = PRESET_COLORS.find(c => c.value === '#0000FF')?.name;
    if (newColorName) {
      expect(screen.getByText(newColorName)).toBeInTheDocument();
    }
  });

  it('disables the picker when disabled prop is true', () => {
    render(<ColorPicker {...defaultProps} disabled={true} />);

    const trigger = screen.getByRole('button');
    expect(trigger).toBeDisabled();
  });

  it('shows custom color picker interface', async () => {
     render(<ColorPicker {...defaultProps} />);

     await userEvent.click(screen.getByRole('button'));

     // Check for color input (it's hidden but accessible via label)
     const colorInput = document.querySelector('input[type="color"]');
     expect(colorInput).toBeInTheDocument();

     // Verify "Pick Custom Color" label exists
     expect(screen.getAllByText('Pick Custom Color')[0]).toBeInTheDocument();
  });

  it('shows checkmark on currently selected preset color', async () => {
    render(<ColorPicker {...defaultProps} value="#DC2626" />); // Red

    // Open dropdown
    const trigger = screen.getByText('Red').closest('button');
    expect(trigger).not.toBeNull();
    if (trigger) {
      await userEvent.click(trigger);
    }

    // Find the Red option and verify it has the checkmark
    const redOption = screen.getByTitle('Red');
    expect(redOption.querySelector('svg')).toBeInTheDocument();
  });

  it('updates checkmark when selected color changes', async () => {
    const { rerender } = render(<ColorPicker {...defaultProps} value="#DC2626" />); // Red

    // Open dropdown
    const trigger = screen.getByText('Red').closest('button');
    if (trigger) {
      await userEvent.click(trigger);
    }

    // Change to Ocean Blue
    rerender(<ColorPicker {...defaultProps} value="#2563EB" />);

    // Verify checkmark moved from Red to Blue
    const redBtn = screen.getByTitle('Red');
    const blueBtn = screen.getByTitle('Ocean Blue');

    expect(redBtn.querySelector('svg')).not.toBeInTheDocument();
    expect(blueBtn.querySelector('svg')).toBeInTheDocument();
  });

  it('handles custom color input changes', async () => {
    render(<ColorPicker {...defaultProps} />);

    await userEvent.click(screen.getByRole('button'));

    // Find hidden color input
    const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement;
    expect(colorInput).toBeInTheDocument();

    // Simulate change event directly on the input
    fireEvent.change(colorInput, { target: { value: '#123456' } });

    // Should call onChange immediately for custom color picker
    expect(mockOnChange).toHaveBeenCalledWith('#123456');
  });

  it('cancels manual hex input', async () => {
    render(<ColorPicker {...defaultProps} />);

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('Enter Hex Code'));

    const input = screen.getByPlaceholderText('#000000');
    await userEvent.type(input, '#ABCDEF');

    // Click cancel button (the X icon)
    const cancelButton = screen.getByTitle('Cancel');
    await userEvent.click(cancelButton);

    // Should revert to showing the button to enter hex code
    expect(screen.getByText('Enter Hex Code')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('#000000')).not.toBeInTheDocument();
  });

  it('custom color picker is properly labeled for accessibility', async () => {
    render(<ColorPicker {...defaultProps} />);

    await userEvent.click(screen.getByRole('button'));

    // Verify the label exists and is associated with the color input
    const label = screen.getAllByText('Pick Custom Color')[0].closest('label');
    expect(label).toBeDefined();

    if (label) {
      const forAttr = label.getAttribute('for');
      expect(forAttr).not.toBeNull();

      // Verify the input exists and has matching ID
      const colorInput = document.querySelector('input[type="color"]');
      expect(colorInput).toBeInTheDocument();
      expect(colorInput?.id).toBe(forAttr);
    }
  });
});
