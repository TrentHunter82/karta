import { render, screen, fireEvent } from '@testing-library/react';
import { SliderInput } from '../../../../src/components/properties/inputs/SliderInput';

describe('SliderInput', () => {
  const mockOnChange = vi.fn();
  const mockOnChangeEnd = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders with label and value', () => {
      render(
        <SliderInput
          label="Opacity"
          value={50}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('Opacity')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('renders with unit', () => {
      render(
        <SliderInput
          label="Opacity"
          value={75}
          unit="%"
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('shows Mixed for mixed value', () => {
      render(
        <SliderInput
          label="Opacity"
          value="mixed"
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('Mixed')).toBeInTheDocument();
    });

    it('shows --- when disabled', () => {
      render(
        <SliderInput
          label="Opacity"
          value={50}
          onChange={mockOnChange}
          disabled
        />
      );
      expect(screen.getByText('---')).toBeInTheDocument();
    });

    it('renders slider fill at correct percentage', () => {
      const { container } = render(
        <SliderInput
          label="Opacity"
          value={75}
          min={0}
          max={100}
          onChange={mockOnChange}
        />
      );
      const fill = container.querySelector('.slider-input-fill');
      expect(fill).toHaveStyle({ width: '75%' });
    });
  });

  describe('text input editing', () => {
    it('enters edit mode on click', () => {
      render(
        <SliderInput
          label="Opacity"
          value={50}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByText('50'));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('does not enter edit mode when disabled', () => {
      render(
        <SliderInput
          label="Opacity"
          value={50}
          onChange={mockOnChange}
          disabled
        />
      );

      fireEvent.click(screen.getByText('---'));
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('calls onChange on commit (Enter), not on every keystroke', () => {
      render(
        <SliderInput
          label="Opacity"
          value={50}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByText('50'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '75' } });

      // Should not be called on input change - only on commit
      expect(mockOnChange).not.toHaveBeenCalled();

      // Commit with Enter key
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith(75);
    });

    it('commits on Enter key', () => {
      render(
        <SliderInput
          label="Opacity"
          value={50}
          onChange={mockOnChange}
          onChangeEnd={mockOnChangeEnd}
        />
      );

      fireEvent.click(screen.getByText('50'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '75' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith(75);
      expect(mockOnChangeEnd).toHaveBeenCalled();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('reverts on Escape key', () => {
      render(
        <SliderInput
          label="Opacity"
          value={50}
          onChange={mockOnChange}
          onChangeEnd={mockOnChangeEnd}
        />
      );

      fireEvent.click(screen.getByText('50'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '99' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      // Should exit edit mode without calling onChangeEnd
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(mockOnChangeEnd).not.toHaveBeenCalled();
    });

    it('commits on blur', () => {
      render(
        <SliderInput
          label="Opacity"
          value={50}
          onChange={mockOnChange}
          onChangeEnd={mockOnChangeEnd}
        />
      );

      fireEvent.click(screen.getByText('50'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '60' } });
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith(60);
      expect(mockOnChangeEnd).toHaveBeenCalled();
    });

    it('clamps value to min/max on commit', () => {
      render(
        <SliderInput
          label="Opacity"
          value={50}
          min={0}
          max={100}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByText('50'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '150' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith(100);
    });

    it('clamps below min on commit', () => {
      render(
        <SliderInput
          label="Opacity"
          value={50}
          min={10}
          max={100}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByText('50'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith(10);
    });
  });

  describe('slider drag behavior', () => {
    it('updates value on slider mousedown', () => {
      const { container } = render(
        <SliderInput
          label="Opacity"
          value={50}
          min={0}
          max={100}
          onChange={mockOnChange}
        />
      );

      const track = container.querySelector('.slider-input-track-container');
      expect(track).toBeInTheDocument();

      // Mock getBoundingClientRect
      Object.defineProperty(track, 'getBoundingClientRect', {
        value: () => ({ left: 0, width: 100, top: 0, height: 20 }),
      });

      fireEvent.mouseDown(track!, { clientX: 75 });

      expect(mockOnChange).toHaveBeenCalledWith(75);
    });

    it('does not respond to drag when disabled', () => {
      const { container } = render(
        <SliderInput
          label="Opacity"
          value={50}
          min={0}
          max={100}
          onChange={mockOnChange}
          disabled
        />
      );

      const track = container.querySelector('.slider-input-track-container');
      fireEvent.mouseDown(track!, { clientX: 75 });

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('calls onChangeEnd on mouseup after drag', () => {
      const { container } = render(
        <SliderInput
          label="Opacity"
          value={50}
          min={0}
          max={100}
          onChange={mockOnChange}
          onChangeEnd={mockOnChangeEnd}
        />
      );

      const track = container.querySelector('.slider-input-track-container');
      Object.defineProperty(track, 'getBoundingClientRect', {
        value: () => ({ left: 0, width: 100, top: 0, height: 20 }),
      });

      fireEvent.mouseDown(track!, { clientX: 50 });
      fireEvent.mouseUp(window);

      expect(mockOnChangeEnd).toHaveBeenCalled();
    });

    it('respects step value', () => {
      const { container } = render(
        <SliderInput
          label="Opacity"
          value={50}
          min={0}
          max={100}
          step={10}
          onChange={mockOnChange}
        />
      );

      const track = container.querySelector('.slider-input-track-container');
      Object.defineProperty(track, 'getBoundingClientRect', {
        value: () => ({ left: 0, width: 100, top: 0, height: 20 }),
      });

      fireEvent.mouseDown(track!, { clientX: 27 });

      // 27% should round to 30 with step=10
      expect(mockOnChange).toHaveBeenCalledWith(30);
    });
  });

  describe('edge cases', () => {
    it('handles non-numeric input gracefully', () => {
      render(
        <SliderInput
          label="Opacity"
          value={50}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByText('50'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should not call onChange with invalid value (NaN check in component)
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('handles empty string input', () => {
      render(
        <SliderInput
          label="Opacity"
          value={50}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByText('50'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should not call onChange with empty value (NaN check in component)
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('handles float values on commit', () => {
      render(
        <SliderInput
          label="Opacity"
          value={0.5}
          min={0}
          max={1}
          step={0.1}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByText('0.5'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '0.7' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith(0.7);
    });

    it('handles negative values on commit', () => {
      render(
        <SliderInput
          label="Position"
          value={0}
          min={-100}
          max={100}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByText('0'));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '-50' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith(-50);
    });
  });
});
