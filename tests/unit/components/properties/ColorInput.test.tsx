import { render, screen, fireEvent } from '@testing-library/react';
import { ColorInput } from '../../../../src/components/properties/inputs/ColorInput';

describe('ColorInput', () => {
  const mockOnChange = vi.fn();
  const mockOnChangeEnd = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders color swatch', () => {
    render(
      <ColorInput
        label="Fill"
        value="#ff0000"
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText('Fill')).toBeInTheDocument();
    const swatch = screen.getByRole('button');
    expect(swatch).toHaveStyle({ backgroundColor: '#ff0000' });
  });

  it('opens picker on click', () => {
    render(
      <ColorInput
        label="Fill"
        value="#ff0000"
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(document.querySelector('.color-input-popup')).toBeInTheDocument();
  });

  it('closes picker on outside click', () => {
    const { container } = render(
      <div>
        <div data-testid="outside">Outside</div>
        <ColorInput
          label="Fill"
          value="#ff0000"
          onChange={mockOnChange}
          onChangeEnd={mockOnChangeEnd}
        />
      </div>
    );

    // Open picker
    fireEvent.click(screen.getByRole('button'));
    expect(document.querySelector('.color-input-popup')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(document.querySelector('.color-input-popup')).not.toBeInTheDocument();
    expect(mockOnChangeEnd).toHaveBeenCalled();
  });

  it('shows mixed indicator for mixed value', () => {
    render(
      <ColorInput
        label="Fill"
        value="mixed"
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('shows none option when allowNone is true', () => {
    render(
      <ColorInput
        label="Stroke"
        value="#ff0000"
        onChange={mockOnChange}
        onChangeEnd={mockOnChangeEnd}
        allowNone
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('No stroke')).toBeInTheDocument();
  });

  it('calls onChange with none when no stroke clicked', () => {
    render(
      <ColorInput
        label="Stroke"
        value="#ff0000"
        onChange={mockOnChange}
        onChangeEnd={mockOnChangeEnd}
        allowNone
      />
    );

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('No stroke'));

    expect(mockOnChange).toHaveBeenCalledWith('none');
    expect(mockOnChangeEnd).toHaveBeenCalled();
  });
});
