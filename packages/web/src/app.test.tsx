import { render, screen, fireEvent } from '@testing-library/react';
import App from './app';
import { describe, it, expect, vi } from 'vitest';

// Mock child components to simplify App testing
vi.mock('./components/home', () => ({
  Home: ({ onSelect }: { onSelect: (v: string) => void }) => (
    <div>
      <div data-testid="home-view" />
      <button onClick={() => onSelect('ui')}>Go to UI</button>
      <button onClick={() => onSelect('upload')}>Go to Upload</button>
    </div>
  ),
}));

vi.mock('./components/sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar-view" />,
}));

vi.mock('./components/flow', () => ({
  default: () => <div data-testid="flow-view" />,
}));

vi.mock('./components/uploader', () => ({
  Uploader: ({ onBack }: { onBack: () => void }) => (
    <div>
      <div data-testid="uploader-view" />
      <button onClick={onBack}>Back from Uploader</button>
    </div>
  ),
}));

describe('App', () => {
  it('starts on home view', () => {
    render(<App />);
    expect(screen.getByTestId('home-view')).toBeInTheDocument();
  });

  it('navigates to UI view', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Go to UI'));
    expect(screen.getByTestId('sidebar-view')).toBeInTheDocument();
    expect(screen.getByTestId('flow-view')).toBeInTheDocument();
  });

  it('navigates to Upload view', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Go to Upload'));
    expect(screen.getByTestId('uploader-view')).toBeInTheDocument();
  });

  it('can navigate back from Uploader', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Go to Upload'));
    fireEvent.click(screen.getByText('Back from Uploader'));
    expect(screen.getByTestId('home-view')).toBeInTheDocument();
  });
});
