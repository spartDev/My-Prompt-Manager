
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import ColorPicker from '../ColorPicker';

describe('ColorPicker', () => {
  const mockOnChange = vi.fn();
  const defaultProps = {
    value: '#DC2626', // Red from preset colors
    onChange: mockOnChange,
    label: 'Select Color'
  };

  it('renders color picker with label and current color', () => {
    render(<ColorPicker {...defaultProps} />);

    // Verify the label is present
    const label = screen.getByText('Select Color');
    expect(label).toBeInTheDocument();

    // The trigger button should display the color name (for the known preset color)
    const trigger = screen.getByRole('button');
    expect(trigger).toBeInTheDocument();

    // In non-compact mode, the color name should be visible
    expect(trigger).toHaveTextContent('Red');
  });

  it('renders compact mode correctly', () => {
    render(<ColorPicker {...defaultProps} compact={true} />);

    // The label prop should still render above in compact mode
    expect(screen.getByText('Select Color')).toBeInTheDocument();

    // Trigger button should exist with only the swatch (no text)
    const trigger = screen.getByRole('button');
    expect(trigger).toBeInTheDocument();

    // In compact mode, the button should have a title attribute with color name
    expect(trigger).toHaveAttribute('title', 'Red');
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

    // Wait for dropdown to open and show preset colors
    expect(await screen.findByText('Preset Colors')).toBeInTheDocument();

    // Select a different color by its accessible title
    const colorButton = screen.getByTitle('Ocean Blue');
    await userEvent.click(colorButton);

    // Verify onChange was called with the new color value
    expect(mockOnChange).toHaveBeenCalledWith('#2563EB');
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

    // Initially displays Red
    expect(screen.getByRole('button')).toHaveTextContent('Red');

    // Update prop to a different color
    rerender(<ColorPicker {...defaultProps} value="#1E40AF" />);

    // Check if displayed color name updated to Navy
    expect(screen.getByRole('button')).toHaveTextContent('Navy');
  });

  it('disables the picker when disabled prop is true', () => {
    render(<ColorPicker {...defaultProps} disabled={true} />);

    const trigger = screen.getByRole('button');
    expect(trigger).toBeDisabled();
  });

  it('shows custom color picker interface', async () => {
     render(<ColorPicker {...defaultProps} />);

     await userEvent.click(screen.getByRole('button'));

     // Wait for dropdown to open
     expect(await screen.findByText('Custom Color')).toBeInTheDocument();

     // Verify "Pick Custom Color" label exists
     const customColorButton = screen.getByText('Pick Custom Color');
     expect(customColorButton).toBeInTheDocument();

     // Verify the label is properly structured as a clickable element
     const label = customColorButton.closest('label');
     expect(label).not.toBeNull();
     expect(label).toHaveAttribute('aria-label', 'Pick custom color');
  });

  it('shows checkmark on currently selected preset color', async () => {
    render(<ColorPicker {...defaultProps} value="#DC2626" />); // Red

    // Open dropdown using the accessible button
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveTextContent('Red');
    await userEvent.click(trigger);

    // Wait for dropdown to open
    expect(await screen.findByText('Preset Colors')).toBeInTheDocument();

    // Find the Red option and verify it's marked as current selection
    const redOption = screen.getByTitle('Red');
    expect(redOption).toHaveAttribute('aria-current', 'true');

    // Verify checkmark is visible using accessible query
    expect(within(redOption).getByRole('img', { name: 'Selected' })).toBeInTheDocument();
  });

  it('updates checkmark when selected color changes', async () => {
    const { rerender } = render(<ColorPicker {...defaultProps} value="#DC2626" />); // Red

    // Open dropdown
    const trigger = screen.getByRole('button');
    await userEvent.click(trigger);

    // Wait for dropdown to open
    expect(await screen.findByText('Preset Colors')).toBeInTheDocument();

    // Change to Ocean Blue
    rerender(<ColorPicker {...defaultProps} value="#2563EB" />);

    // Verify checkmark moved from Red to Ocean Blue
    const redBtn = screen.getByTitle('Red');
    const blueBtn = screen.getByTitle('Ocean Blue');

    // Red button should not be marked as current
    expect(redBtn).not.toHaveAttribute('aria-current', 'true');
    expect(within(redBtn).queryByRole('img', { name: 'Selected' })).not.toBeInTheDocument();

    // Ocean Blue button should be marked as current with checkmark
    expect(blueBtn).toHaveAttribute('aria-current', 'true');
    expect(within(blueBtn).getByRole('img', { name: 'Selected' })).toBeInTheDocument();
  });

  it('handles custom color input changes', async () => {
    render(<ColorPicker {...defaultProps} />);

    await userEvent.click(screen.getByRole('button'));

    // Wait for dropdown to open
    expect(await screen.findByText('Custom Color')).toBeInTheDocument();

    // Get the label element and find its associated input via htmlFor
    const label = screen.getByText('Pick Custom Color').closest('label');
    expect(label).not.toBeNull();
    const inputId = label?.getAttribute('for');
    expect(inputId).toBeTruthy();

    // Query the input by its ID
    expect(inputId).toBeTruthy();
    const colorInput = document.getElementById(inputId as string);
    expect(colorInput).toBeInstanceOf(HTMLInputElement);
    expect(colorInput).toBeInTheDocument();
    expect(colorInput).toHaveAttribute('type', 'color');

    // Simulate change event directly on the input
    fireEvent.change(colorInput as HTMLElement, { target: { value: '#123456' } });

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

    // Wait for dropdown to open
    expect(await screen.findByText('Custom Color')).toBeInTheDocument();

    // Get the label and verify it has proper htmlFor attribute
    const label = screen.getByText('Pick Custom Color').closest('label');
    expect(label).not.toBeNull();
    expect(label).toHaveAttribute('aria-label', 'Pick custom color');

    const inputId = label?.getAttribute('for');
    expect(inputId).toBeTruthy();

    // Verify the input exists and has the matching ID
    expect(inputId).toBeTruthy();
    const colorInput = document.getElementById(inputId as string);
    expect(colorInput).toBeInstanceOf(HTMLInputElement);
    expect(colorInput).toBeInTheDocument();
    expect(colorInput?.id).toBe(inputId);
  });
});
