import { create } from 'zustand';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { soundcloudAdapter } from '@/adapters/soundcloudAdapter';
import type { Track, PlaybackState } from '@/types';

interface PlayerStore extends PlaybackState {
  sound: Audio.Sound | null;
  isLoading: boolean;
  error: string | null;
  load: (track: Track) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  unload: () => Promise<void>;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  track: null,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  volume: 1,
  sound: null,
  isLoading: false,
  error: null,

  load: async (track: Track) => {
    const { sound: currentSound } = get();
    
    if (currentSound) {
      await currentSound.unloadAsync();
    }

    set({ isLoading: true, error: null, track });

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      let streamUrl = track.streamUrl;
      if (!streamUrl) {
        streamUrl = await soundcloudAdapter.getTrackStreamUrl(track.sourceId);
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: streamUrl },
        { shouldPlay: true, volume: get().volume },
        (status: AVPlaybackStatus) => {
          if (status.isLoaded) {
            set({
              positionMs: status.positionMillis,
              durationMs: status.durationMillis || 0,
              isPlaying: status.isPlaying,
            });
          }
        }
      );

      set({ sound, isLoading: false, isPlaying: true });
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load track' 
      });
    }
  },

  play: async () => {
    const { sound } = get();
    if (sound) {
      await sound.playAsync();
      set({ isPlaying: true });
    }
  },

  pause: async () => {
    const { sound } = get();
    if (sound) {
      await sound.pauseAsync();
      set({ isPlaying: false });
    }
  },

  togglePlayPause: async () => {
    const { isPlaying, play, pause } = get();
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  },

  seek: async (positionMs: number) => {
    const { sound } = get();
    if (sound) {
      await sound.setPositionAsync(positionMs);
      set({ positionMs });
    }
  },

  setVolume: async (volume: number) => {
    const { sound } = get();
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (sound) {
      await sound.setVolumeAsync(clampedVolume);
    }
    set({ volume: clampedVolume });
  },

  unload: async () => {
    const { sound } = get();
    if (sound) {
      await sound.unloadAsync();
    }
    set({
      sound: null,
      track: null,
      isPlaying: false,
      positionMs: 0,
      durationMs: 0,
    });
  },
}));
