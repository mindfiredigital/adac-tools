import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WarningBanner } from './warning-banner';

describe('WarningBanner', () => {
  it('shows each message in a status banner', () => {
    render(<WarningBanner messages={['first', 'second']} onClose={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Layout warning')).toBeInTheDocument();
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
  });

  it('is pinned to the bottom-right corner', () => {
    render(<WarningBanner messages={['x']} onClose={vi.fn()} />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveClass('fixed', 'bottom-4', 'right-4');
  });

  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(<WarningBanner messages={['x']} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss warning' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing without messages', () => {
    const { container } = render(
      <WarningBanner messages={[]} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
