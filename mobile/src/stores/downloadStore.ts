import { create } from 'zustand';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import type { Track } from '../types';

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}downloads/`;
const DOWNLOADS_METADATA_KEY = 'downloaded_tracks';

interface DownloadedTrack extends Track {
  localPath: string;
  downloadedAt: number;
  fileSize: number;
}

interface DownloadProgress {
  trackId: string;
  progress: number;
}

interface DownloadStore {
  downloadedTracks: DownloadedTrack[];
  activeDownloads: Map<string, DownloadProgress>;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  downloadTrack: (track: Track, streamUrl: string) => Promise<void>;
  deleteDownload: (trackId: string) => Promise<void>;
  isDownloaded: (trackId: string) => boolean;
  getLocalPath: (trackId: string) => string | null;
  getDownloadProgress: (trackId: string) => number | null;
  clearAllDownloads: () => Promise<void>;
  getTotalStorageUsed: () => number;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  downloadedTracks: [],
  activeDownloads: new Map(),
  isInitialized: false,

  initialize: async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
      }

      const storedMetadata = await SecureStore.getItemAsync(DOWNLOADS_METADATA_KEY);
      if (storedMetadata) {
        const tracks: DownloadedTrack[] = JSON.parse(storedMetadata);
        
        const validTracks: DownloadedTrack[] = [];
        for (const track of tracks) {
          const fileInfo = await FileSystem.getInfoAsync(track.localPath);
          if (fileInfo.exists) {
            validTracks.push(track);
          }
        }
        
        if (validTracks.length !== tracks.length) {
          await SecureStore.setItemAsync(DOWNLOADS_METADATA_KEY, JSON.stringify(validTracks));
        }
        
        set({ downloadedTracks: validTracks, isInitialized: true });
      } else {
        set({ isInitialized: true });
      }
    } catch (error) {
      console.error('Failed to initialize download store:', error);
      set({ isInitialized: true });
    }
  },

  downloadTrack: async (track: Track, streamUrl: string) => {
    const { activeDownloads, downloadedTracks } = get();
    
    if (activeDownloads.has(track.id)) {
      return;
    }

    if (downloadedTracks.some(t => t.id === track.id)) {
      return;
    }

    const newActiveDownloads = new Map(activeDownloads);
    newActiveDownloads.set(track.id, { trackId: track.id, progress: 0 });
    set({ activeDownloads: newActiveDownloads });

    const filename = `${track.id.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
    const localPath = `${DOWNLOADS_DIR}${filename}`;

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        streamUrl,
        localPath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          const updatedDownloads = new Map(get().activeDownloads);
          updatedDownloads.set(track.id, { trackId: track.id, progress });
          set({ activeDownloads: updatedDownloads });
        }
      );

      const result = await downloadResumable.downloadAsync();
      
      if (!result) {
        throw new Error('Download failed');
      }

      const fileInfo = await FileSystem.getInfoAsync(localPath);
      const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

      const downloadedTrack: DownloadedTrack = {
        ...track,
        localPath,
        downloadedAt: Date.now(),
        fileSize,
      };

      const updatedTracks = [...get().downloadedTracks, downloadedTrack];
      await SecureStore.setItemAsync(DOWNLOADS_METADATA_KEY, JSON.stringify(updatedTracks));
      
      const finalActiveDownloads = new Map(get().activeDownloads);
      finalActiveDownloads.delete(track.id);
      
      set({ 
        downloadedTracks: updatedTracks,
        activeDownloads: finalActiveDownloads,
      });
    } catch (error) {
      console.error('Download failed:', error);
      const errorActiveDownloads = new Map(get().activeDownloads);
      errorActiveDownloads.delete(track.id);
      set({ activeDownloads: errorActiveDownloads });
      throw error;
    }
  },

  deleteDownload: async (trackId: string) => {
    const { downloadedTracks } = get();
    const track = downloadedTracks.find(t => t.id === trackId);
    
    if (!track) return;

    try {
      await FileSystem.deleteAsync(track.localPath, { idempotent: true });
      
      const updatedTracks = downloadedTracks.filter(t => t.id !== trackId);
      await SecureStore.setItemAsync(DOWNLOADS_METADATA_KEY, JSON.stringify(updatedTracks));
      
      set({ downloadedTracks: updatedTracks });
    } catch (error) {
      console.error('Failed to delete download:', error);
    }
  },

  isDownloaded: (trackId: string) => {
    return get().downloadedTracks.some(t => t.id === trackId);
  },

  getLocalPath: (trackId: string) => {
    const track = get().downloadedTracks.find(t => t.id === trackId);
    return track?.localPath || null;
  },

  getDownloadProgress: (trackId: string) => {
    const progress = get().activeDownloads.get(trackId);
    return progress?.progress ?? null;
  },

  clearAllDownloads: async () => {
    try {
      await FileSystem.deleteAsync(DOWNLOADS_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
      await SecureStore.deleteItemAsync(DOWNLOADS_METADATA_KEY);
      set({ downloadedTracks: [] });
    } catch (error) {
      console.error('Failed to clear downloads:', error);
    }
  },

  getTotalStorageUsed: () => {
    return get().downloadedTracks.reduce((total, track) => total + track.fileSize, 0);
  },
}));
