import { render, screen, fireEvent } from '@testing-library/react';
import { Home } from './home';
import { describe, it, expect, vi } from 'vitest';

describe('Home', () => {
  it('renders correctly and handles selection', () => {
    const onSelect = vi.fn();
    render(<Home onSelect={onSelect} />);

    expect(screen.getByText('ADAC Diagram Generator')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Visual Designer'));
    expect(onSelect).toHaveBeenCalledWith('ui');

    fireEvent.click(screen.getByText('Upload YAML'));
    expect(onSelect).toHaveBeenCalledWith('upload');
  });
});
