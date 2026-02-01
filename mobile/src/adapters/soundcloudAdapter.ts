import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import type { Track, User } from '../types';

const SOUNDCLOUD_API_BASE = 'https://api.soundcloud.com';
const TOKEN_KEY = 'soundcloud_access_token';
const REFRESH_TOKEN_KEY = 'soundcloud_refresh_token';

export const SOUNDCLOUD_CLIENT_ID = process.env.EXPO_PUBLIC_SOUNDCLOUD_CLIENT_ID || '';
export const SOUNDCLOUD_REDIRECT_URI = 'psychvisuals://auth/soundcloud';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://your-app-url.replit.app';

class SoundCloudAdapter {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  async initialize(): Promise<boolean> {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const refresh = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (token) {
      this.accessToken = token;
      this.refreshToken = refresh;
      return true;
    }
    return false;
  }

  async exchangeCodeForToken(code: string): Promise<{ accessToken: string; refreshToken?: string }> {
    const response = await axios.post(`${API_BASE_URL}/api/auth/soundcloud/token`, {
      code,
      redirect_uri: SOUNDCLOUD_REDIRECT_URI,
    });

    const { access_token, refresh_token } = response.data;
    await this.setTokens(access_token, refresh_token);
    return { accessToken: access_token, refreshToken: refresh_token };
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/soundcloud/refresh`, {
        refresh_token: this.refreshToken,
      });

      const { access_token, refresh_token } = response.data;
      await this.setTokens(access_token, refresh_token);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  async setTokens(accessToken: string, refreshToken?: string): Promise<void> {
    this.accessToken = accessToken;
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    if (refreshToken) {
      this.refreshToken = refreshToken;
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await axios.get(`${SOUNDCLOUD_API_BASE}${endpoint}`, {
        headers: {
          Authorization: `OAuth ${this.accessToken}`,
        },
        params: {
          ...params,
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401 && this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this.request(endpoint, params);
        }
      }
      throw error;
    }
  }

  async getMe(): Promise<User> {
    const data = await this.request<{
      id: number;
      username: string;
      avatar_url: string;
      full_name: string;
    }>('/me');

    return {
      id: String(data.id),
      username: data.username,
      avatarUrl: data.avatar_url,
      fullName: data.full_name || data.username,
    };
  }

  async searchTracks(query: string, limit = 20): Promise<Track[]> {
    const data = await this.request<{
      collection: Array<{
        id: number;
        title: string;
        user: { username: string };
        artwork_url: string | null;
        duration: number;
        stream_url?: string;
        streamable: boolean;
      }>;
    }>('/tracks', {
      q: query,
      limit: String(limit),
      linked_partitioning: '1',
    });

    return data.collection
      .filter((track) => track.streamable)
      .map((track) => this.mapTrack(track));
  }

  async getLikes(limit = 50): Promise<Track[]> {
    const data = await this.request<{
      collection: Array<{
        track: {
          id: number;
          title: string;
          user: { username: string };
          artwork_url: string | null;
          duration: number;
          stream_url?: string;
          streamable: boolean;
        };
      }>;
    }>('/me/likes/tracks', { limit: String(limit), linked_partitioning: '1' });

    return data.collection
      .filter((item) => item.track?.streamable)
      .map((item) => this.mapTrack(item.track));
  }

  async getPlaylists(): Promise<
    Array<{ id: string; title: string; trackCount: number; artworkUrl: string | null }>
  > {
    const data = await this.request<
      Array<{
        id: number;
        title: string;
        track_count: number;
        artwork_url: string | null;
      }>
    >('/me/playlists');

    return data.map((playlist) => ({
      id: String(playlist.id),
      title: playlist.title,
      trackCount: playlist.track_count,
      artworkUrl: playlist.artwork_url,
    }));
  }

  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    const data = await this.request<{
      tracks: Array<{
        id: number;
        title: string;
        user: { username: string };
        artwork_url: string | null;
        duration: number;
        stream_url?: string;
        streamable: boolean;
      }>;
    }>(`/playlists/${playlistId}`);

    return data.tracks.filter((track) => track.streamable).map((track) => this.mapTrack(track));
  }

  async getTrackStreamUrl(trackId: string): Promise<string> {
    const data = await this.request<{ url: string }>(`/tracks/${trackId}/stream`);
    return data.url;
  }

  private mapTrack(track: {
    id: number;
    title: string;
    user: { username: string };
    artwork_url: string | null;
    duration: number;
    stream_url?: string;
  }): Track {
    return {
      id: `sc-${track.id}`,
      title: track.title,
      artist: track.user.username,
      artworkUrl: track.artwork_url?.replace('-large', '-t500x500') || null,
      durationMs: track.duration,
      streamUrl: track.stream_url || null,
      source: 'soundcloud',
      sourceId: String(track.id),
    };
  }
}

export const soundcloudAdapter = new SoundCloudAdapter();
