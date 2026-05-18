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
  Sidebar: ({ setProvider }: { setProvider: (v: string) => void }) => (
    <div data-testid="sidebar-view">
      <button onClick={() => setProvider('gcp')}>Switch to GCP</button>
    </div>
  ),
}));

vi.mock('./components/flow', () => ({
  default: ({ onBack }: { onBack: () => void }) => (
    <div data-testid="flow-view">
      <button onClick={onBack}>Back from Flow</button>
    </div>
  ),
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

  it('can change provider', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Go to UI'));
    fireEvent.click(screen.getByText('Switch to GCP'));
  });

  it('can navigate back from Flow', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Go to UI'));
    fireEvent.click(screen.getByText('Back from Flow'));
    expect(screen.getByTestId('home-view')).toBeInTheDocument();
  });
});
