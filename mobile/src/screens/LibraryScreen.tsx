import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { soundcloudAdapter } from '../adapters/soundcloudAdapter';
import { usePlayerStore } from '../stores/playerStore';
import type { Track } from '../types';

type TabType = 'search' | 'likes' | 'playlists';

interface Playlist {
  id: string;
  title: string;
  trackCount: number;
  artworkUrl: string | null;
}

export function LibraryScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { track: currentTrack, load } = usePlayerStore();

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    try {
      const results = await soundcloudAdapter.searchTracks(searchQuery);
      setTracks(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  const loadLikes = useCallback(async () => {
    setIsLoading(true);
    try {
      const likes = await soundcloudAdapter.getLikes();
      setTracks(likes);
    } catch (error) {
      console.error('Failed to load likes:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPlaylists = useCallback(async () => {
    setIsLoading(true);
    try {
      const userPlaylists = await soundcloudAdapter.getPlaylists();
      setPlaylists(userPlaylists);
      setSelectedPlaylist(null);
      setTracks([]);
    } catch (error) {
      console.error('Failed to load playlists:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPlaylistTracks = useCallback(async (playlist: Playlist) => {
    setIsLoading(true);
    setSelectedPlaylist(playlist);
    try {
      const playlistTracks = await soundcloudAdapter.getPlaylistTracks(playlist.id);
      setTracks(playlistTracks);
    } catch (error) {
      console.error('Failed to load playlist tracks:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setTracks([]);
    setPlaylists([]);
    setSelectedPlaylist(null);
    if (tab === 'likes') {
      loadLikes();
    } else if (tab === 'playlists') {
      loadPlaylists();
    }
  };

  const handleBackToPlaylists = () => {
    setSelectedPlaylist(null);
    setTracks([]);
  };

  const handleTrackPress = async (track: Track) => {
    await load(track);
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderPlaylist = ({ item }: { item: Playlist }) => (
    <TouchableOpacity
      style={styles.playlistItem}
      onPress={() => loadPlaylistTracks(item)}
    >
      <Image
        source={{ uri: item.artworkUrl || 'https://placehold.co/100x100/1a1a2e/666666?text=Playlist' }}
        style={styles.playlistArtwork}
      />
      <View style={styles.playlistInfo}>
        <Text style={styles.playlistTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.playlistCount}>
          {item.trackCount} tracks
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  const renderTrack = ({ item }: { item: Track }) => {
    const isPlaying = currentTrack?.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.trackItem, isPlaying && styles.trackItemActive]}
        onPress={() => handleTrackPress(item)}
      >
        <Image
          source={{ uri: item.artworkUrl || 'https://placehold.co/100x100/1a1a2e/666666?text=No+Art' }}
          style={styles.artwork}
        />
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        <Text style={styles.duration}>{formatDuration(item.durationMs)}</Text>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff006e" />
        </View>
      );
    }

    if (activeTab === 'playlists' && !selectedPlaylist) {
      return (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          renderItem={renderPlaylist}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No playlists found</Text>
            </View>
          }
        />
      );
    }

    return (
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        renderItem={renderTrack}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {activeTab === 'search'
                ? 'Search for tracks to get started'
                : 'No tracks found'}
            </Text>
          </View>
        }
      />
    );
  };

  return (
    <LinearGradient colors={['#0a0a0a', '#1a1a2e']} style={styles.container}>
      <View style={styles.tabs}>
        {(['search', 'likes', 'playlists'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => handleTabChange(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'playlists' && selectedPlaylist && (
        <TouchableOpacity style={styles.backButton} onPress={handleBackToPlaylists}>
          <Text style={styles.backButtonText}>← {selectedPlaylist.title}</Text>
        </TouchableOpacity>
      )}

      {activeTab === 'search' && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search tracks..."
            placeholderTextColor="#666666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
      )}

      {renderContent()}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    gap: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
  },
  tabActive: {
    backgroundColor: '#ff006e',
  },
  tabText: {
    color: '#888888',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  backButton: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButtonText: {
    color: '#ff006e',
    fontSize: 16,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    color: '#ffffff',
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  playlistArtwork: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playlistTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  playlistCount: {
    color: '#888888',
    fontSize: 14,
    marginTop: 2,
  },
  chevron: {
    color: '#666666',
    fontSize: 24,
    marginLeft: 8,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  trackItemActive: {
    backgroundColor: 'rgba(255, 0, 110, 0.1)',
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  artwork: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
  },
  trackTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  trackArtist: {
    color: '#888888',
    fontSize: 14,
    marginTop: 2,
  },
  duration: {
    color: '#666666',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#666666',
    fontSize: 16,
  },
});
