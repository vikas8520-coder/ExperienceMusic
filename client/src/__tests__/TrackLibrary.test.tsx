import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackLibrary } from '../components/TrackLibrary';
import type { SavedTrack } from '../pages/Home';

const mockTracks: SavedTrack[] = [
  {
    id: 'track-1',
    name: 'Midnight Groove',
    audioUrl: 'blob:http://localhost/audio1',
    theme: 'Electronic',
    createdAt: new Date('2026-01-15T10:30:00'),
  },
  {
    id: 'track-2',
    name: 'Sunset Chill',
    audioUrl: 'blob:http://localhost/audio2',
    theme: 'Ambient',
    createdAt: new Date('2026-01-16T14:00:00'),
  },
];

describe('TrackLibrary', () => {
  it('renders track items with delete buttons', () => {
    const onLoadTrack = vi.fn();
    const onDeleteTrack = vi.fn();
    const onClose = vi.fn();

    render(
      <TrackLibrary
        tracks={mockTracks}
        onLoadTrack={onLoadTrack}
        onDeleteTrack={onDeleteTrack}
        onClose={onClose}
      />
    );

    expect(screen.getByTestId('track-item-track-1')).toBeInTheDocument();
    expect(screen.getByTestId('track-item-track-2')).toBeInTheDocument();
    expect(screen.getByTestId('button-delete-track-track-1')).toBeInTheDocument();
    expect(screen.getByTestId('button-delete-track-track-2')).toBeInTheDocument();
  });

  it('calls onDeleteTrack with correct id when delete button is clicked', async () => {
    const user = userEvent.setup();
    const onLoadTrack = vi.fn();
    const onDeleteTrack = vi.fn();
    const onClose = vi.fn();

    render(
      <TrackLibrary
        tracks={mockTracks}
        onLoadTrack={onLoadTrack}
        onDeleteTrack={onDeleteTrack}
        onClose={onClose}
      />
    );

    await user.click(screen.getByTestId('button-delete-track-track-1'));
    expect(onDeleteTrack).toHaveBeenCalledWith('track-1');
  });

  it('delete click does NOT trigger onLoadTrack (stopPropagation)', async () => {
    const user = userEvent.setup();
    const onLoadTrack = vi.fn();
    const onDeleteTrack = vi.fn();
    const onClose = vi.fn();

    render(
      <TrackLibrary
        tracks={mockTracks}
        onLoadTrack={onLoadTrack}
        onDeleteTrack={onDeleteTrack}
        onClose={onClose}
      />
    );

    await user.click(screen.getByTestId('button-delete-track-track-1'));
    expect(onDeleteTrack).toHaveBeenCalledTimes(1);
    expect(onLoadTrack).not.toHaveBeenCalled();
  });

  it('displays track names and times correctly', () => {
    render(
      <TrackLibrary
        tracks={mockTracks}
        onLoadTrack={vi.fn()}
        onDeleteTrack={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('text-track-name-track-1')).toHaveTextContent('Midnight Groove');
    expect(screen.getByTestId('text-track-name-track-2')).toHaveTextContent('Sunset Chill');
  });

  it('renders empty state when no tracks', () => {
    render(
      <TrackLibrary
        tracks={[]}
        onLoadTrack={vi.fn()}
        onDeleteTrack={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('No tracks saved yet')).toBeInTheDocument();
  });
});
