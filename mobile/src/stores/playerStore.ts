import { create } from 'zustand';
import { Audio, AVPlaybackStatus, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { soundcloudAdapter } from '../adapters/soundcloudAdapter';
import { useDownloadStore } from './downloadStore';
import type { Track, PlaybackState } from '../types';

interface PlayerStore extends PlaybackState {
  sound: Audio.Sound | null;
  isLoading: boolean;
  error: string | null;
  queue: Track[];
  queueIndex: number;
  repeatMode: 'off' | 'one' | 'all';
  shuffleEnabled: boolean;
  load: (track: Track) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  unload: () => Promise<void>;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  setQueue: (tracks: Track[], startIndex?: number) => Promise<void>;
  moveInQueue: (fromIndex: number, toIndex: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
}

let audioInitialized = false;

async function initializeAudio() {
  if (audioInitialized) return;
  
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
  
  audioInitialized = true;
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
  queue: [],
  queueIndex: -1,
  repeatMode: 'off',
  shuffleEnabled: false,

  load: async (track: Track) => {
    const { sound: currentSound, volume } = get();
    
    await initializeAudio();
    
    if (currentSound) {
      await currentSound.unloadAsync();
    }

    set({ isLoading: true, error: null, track });

    try {
      const downloadStore = useDownloadStore.getState();
      const localPath = downloadStore.getLocalPath(track.id);
      
      let streamUrl: string;
      if (localPath) {
        streamUrl = localPath;
      } else if (track.streamUrl) {
        streamUrl = track.streamUrl;
      } else if (track.sourceId) {
        streamUrl = await soundcloudAdapter.getTrackStreamUrl(track.sourceId);
      } else {
        throw new Error('No stream URL available');
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: streamUrl },
        { shouldPlay: true, volume, progressUpdateIntervalMillis: 500 },
        (status: AVPlaybackStatus) => {
          if (status.isLoaded) {
            set({
              positionMs: status.positionMillis,
              durationMs: status.durationMillis || 0,
              isPlaying: status.isPlaying,
            });
            
            if (status.didJustFinish) {
              get().playNext();
            }
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

  addToQueue: (track: Track) => {
    set((state) => ({
      queue: [...state.queue, track],
    }));
  },

  removeFromQueue: (index: number) => {
    set((state) => {
      const newQueue = [...state.queue];
      newQueue.splice(index, 1);
      
      let newIndex = state.queueIndex;
      if (index < state.queueIndex) {
        newIndex = state.queueIndex - 1;
      } else if (index === state.queueIndex && newIndex >= newQueue.length) {
        newIndex = newQueue.length - 1;
      }
      
      return { queue: newQueue, queueIndex: newIndex };
    });
  },

  clearQueue: () => {
    set({ queue: [], queueIndex: -1 });
  },

  setQueue: async (tracks: Track[], startIndex = 0) => {
    set({ queue: tracks, queueIndex: startIndex });
    if (tracks.length > 0 && startIndex < tracks.length) {
      await get().load(tracks[startIndex]);
    }
  },

  moveInQueue: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const newQueue = [...state.queue];
      const [moved] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, moved);
      
      let newIndex = state.queueIndex;
      if (fromIndex === state.queueIndex) {
        newIndex = toIndex;
      } else if (fromIndex < state.queueIndex && toIndex >= state.queueIndex) {
        newIndex = state.queueIndex - 1;
      } else if (fromIndex > state.queueIndex && toIndex <= state.queueIndex) {
        newIndex = state.queueIndex + 1;
      }
      
      return { queue: newQueue, queueIndex: newIndex };
    });
  },

  playNext: async () => {
    const { queue, queueIndex, repeatMode, shuffleEnabled, load } = get();
    
    if (queue.length === 0) return;
    
    if (repeatMode === 'one') {
      const currentTrack = queue[queueIndex];
      if (currentTrack) {
        await load(currentTrack);
      }
      return;
    }
    
    let nextIndex: number;
    
    if (shuffleEnabled) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = queueIndex + 1;
    }
    
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        set({ isPlaying: false });
        return;
      }
    }
    
    set({ queueIndex: nextIndex });
    await load(queue[nextIndex]);
  },

  playPrevious: async () => {
    const { queue, queueIndex, positionMs, load, seek } = get();
    
    if (queue.length === 0) return;
    
    if (positionMs > 3000) {
      await seek(0);
      return;
    }
    
    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }
    
    set({ queueIndex: prevIndex });
    await load(queue[prevIndex]);
  },

  toggleRepeat: () => {
    set((state) => {
      const modes: Array<'off' | 'one' | 'all'> = ['off', 'one', 'all'];
      const currentIndex = modes.indexOf(state.repeatMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      return { repeatMode: modes[nextIndex] };
    });
  },

  toggleShuffle: () => {
    set((state) => ({ shuffleEnabled: !state.shuffleEnabled }));
  },
}));
