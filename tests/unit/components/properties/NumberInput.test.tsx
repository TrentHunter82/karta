import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumberInput } from '../../../../src/components/properties/inputs/NumberInput';

describe('NumberInput', () => {
  const mockOnChange = vi.fn();
  const mockOnChangeEnd = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with value', () => {
    render(
      <NumberInput
        label="X"
        value={100}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders with unit', () => {
    render(
      <NumberInput
        label="Width"
        value={200}
        unit="px"
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText('200px')).toBeInTheDocument();
  });

  it('shows Mixed for mixed value', () => {
    render(
      <NumberInput
        label="X"
        value="mixed"
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText('Mixed')).toBeInTheDocument();
  });

  it('enters edit mode on click', () => {
    render(
      <NumberInput
        label="X"
        value={100}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByText('100'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls onChange on input change', () => {
    render(
      <NumberInput
        label="X"
        value={100}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByText('100'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '150' } });

    expect(mockOnChange).toHaveBeenCalledWith(150);
  });

  it('calls onChangeEnd on blur', () => {
    render(
      <NumberInput
        label="X"
        value={100}
        onChange={mockOnChange}
        onChangeEnd={mockOnChangeEnd}
      />
    );

    fireEvent.click(screen.getByText('100'));
    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    expect(mockOnChangeEnd).toHaveBeenCalled();
  });

  it('calls onChangeEnd on Enter key', () => {
    render(
      <NumberInput
        label="X"
        value={100}
        onChange={mockOnChange}
        onChangeEnd={mockOnChangeEnd}
      />
    );

    fireEvent.click(screen.getByText('100'));
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockOnChangeEnd).toHaveBeenCalled();
  });

  it('reverts on Escape key', () => {
    render(
      <NumberInput
        label="X"
        value={100}
        onChange={mockOnChange}
        onChangeEnd={mockOnChangeEnd}
      />
    );

    fireEvent.click(screen.getByText('100'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    // Should exit edit mode without calling onChangeEnd
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('clamps to min/max', () => {
    render(
      <NumberInput
        label="X"
        value={50}
        min={0}
        max={100}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByText('50'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '150' } });

    expect(mockOnChange).toHaveBeenCalledWith(100);
  });

  it('supports arrow key increment', () => {
    render(
      <NumberInput
        label="X"
        value={100}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByText('100'));
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(mockOnChange).toHaveBeenCalledWith(101);
  });

  it('supports shift+arrow for 10x increment', () => {
    render(
      <NumberInput
        label="X"
        value={100}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByText('100'));
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true });

    expect(mockOnChange).toHaveBeenCalledWith(110);
  });

  it('does not enter edit mode when disabled', () => {
    render(
      <NumberInput
        label="X"
        value={100}
        onChange={mockOnChange}
        disabled
      />
    );

    fireEvent.click(screen.getByText('100'));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
