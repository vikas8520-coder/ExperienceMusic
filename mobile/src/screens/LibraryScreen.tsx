import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { soundcloudAdapter } from '../adapters/soundcloudAdapter';
import { usePlayerStore } from '../stores/playerStore';
import { useDownloadStore } from '../stores/downloadStore';
import type { Track } from '../types';

type TabType = 'search' | 'likes' | 'playlists' | 'downloads';

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
  const { track: currentTrack, setQueue, addToQueue } = usePlayerStore();
  const { 
    downloadedTracks, 
    isDownloaded, 
    downloadTrack, 
    deleteDownload,
    getDownloadProgress,
    activeDownloads,
    initialize: initializeDownloads,
    getTotalStorageUsed,
  } = useDownloadStore();

  useEffect(() => {
    initializeDownloads();
  }, []);

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
    } else if (tab === 'downloads') {
      setTracks(downloadedTracks);
    }
  };

  const handleBackToPlaylists = () => {
    setSelectedPlaylist(null);
    setTracks([]);
  };

  const handleTrackPress = async (track: Track, index: number) => {
    const tracksToPlay = activeTab === 'downloads' ? downloadedTracks : tracks;
    await setQueue(tracksToPlay, index);
  };

  const handleAddToQueue = (track: Track) => {
    addToQueue(track);
    Alert.alert('Added to Queue', `"${track.title}" has been added to the queue.`);
  };

  const handleDownload = async (track: Track) => {
    try {
      const streamUrl = await soundcloudAdapter.getTrackStreamUrl(track.sourceId);
      await downloadTrack(track, streamUrl);
      Alert.alert('Download Complete', `"${track.title}" is now available offline.`);
    } catch (error) {
      Alert.alert('Download Failed', 'Could not download this track. Please try again.');
    }
  };

  const handleDeleteDownload = (track: Track) => {
    Alert.alert(
      'Delete Download',
      `Remove "${track.title}" from offline storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteDownload(track.id),
        },
      ]
    );
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

  const renderTrack = ({ item, index }: { item: Track; index: number }) => {
    const isPlaying = currentTrack?.id === item.id;
    const downloaded = isDownloaded(item.id);
    const downloadProgress = getDownloadProgress(item.id);
    const isDownloading = downloadProgress !== null;

    return (
      <TouchableOpacity
        style={[styles.trackItem, isPlaying && styles.trackItemActive]}
        onPress={() => handleTrackPress(item, index)}
        onLongPress={() => handleAddToQueue(item)}
      >
        <Image
          source={{ uri: item.artworkUrl || 'https://placehold.co/100x100/1a1a2e/666666?text=No+Art' }}
          style={styles.artwork}
        />
        <View style={styles.trackInfo}>
          <Text style={[styles.trackTitle, isPlaying && styles.trackTitleActive]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.trackMeta}>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {item.artist}
            </Text>
            {downloaded && (
              <View style={styles.downloadedBadge}>
                <Text style={styles.downloadedText}>↓</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.trackActions}>
          <TouchableOpacity
            style={styles.addQueueButton}
            onPress={() => handleAddToQueue(item)}
          >
            <Text style={styles.addQueueIcon}>+</Text>
          </TouchableOpacity>
          
          {activeTab === 'downloads' ? (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteDownload(item)}
            >
              <Text style={styles.deleteIcon}>×</Text>
            </TouchableOpacity>
          ) : isDownloading ? (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="small" color="#ff006e" />
              <Text style={styles.progressText}>{Math.round(downloadProgress * 100)}%</Text>
            </View>
          ) : downloaded ? (
            <View style={styles.downloadedIcon}>
              <Text style={styles.downloadedCheckmark}>✓</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => handleDownload(item)}
            >
              <Text style={styles.downloadIcon}>↓</Text>
            </TouchableOpacity>
          )}
          
          <Text style={styles.duration}>{formatDuration(item.durationMs)}</Text>
        </View>
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

    if (activeTab === 'downloads') {
      return (
        <FlatList
          data={downloadedTracks}
          keyExtractor={(item) => item.id}
          renderItem={renderTrack}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            downloadedTracks.length > 0 ? (
              <View style={styles.storageInfo}>
                <Text style={styles.storageText}>
                  {downloadedTracks.length} tracks • {formatBytes(getTotalStorageUsed())}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No downloaded tracks</Text>
              <Text style={styles.emptySubtext}>Download tracks to listen offline</Text>
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
        {(['search', 'likes', 'playlists', 'downloads'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => handleTabChange(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'downloads' ? '↓' : tab.charAt(0).toUpperCase() + tab.slice(1)}
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
      
      <View style={styles.hint}>
        <Text style={styles.hintText}>Tap to play • Long press to add to queue • ↓ to download</Text>
      </View>
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
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
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
    paddingBottom: 140,
  },
  storageInfo: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
    marginBottom: 8,
  },
  storageText: {
    color: '#888888',
    fontSize: 14,
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
  trackTitleActive: {
    color: '#ff006e',
  },
  trackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  trackArtist: {
    color: '#888888',
    fontSize: 14,
    flex: 1,
  },
  downloadedBadge: {
    backgroundColor: '#06ffa5',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadedText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  trackActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addQueueButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333344',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addQueueIcon: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
    marginTop: -2,
  },
  downloadButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#ff006e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadIcon: {
    color: '#ff006e',
    fontSize: 16,
    fontWeight: 'bold',
  },
  downloadedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#06ffa5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadedCheckmark: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIcon: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '300',
    marginTop: -2,
  },
  progressContainer: {
    width: 28,
    alignItems: 'center',
  },
  progressText: {
    color: '#ff006e',
    fontSize: 8,
    marginTop: 2,
  },
  duration: {
    color: '#666666',
    fontSize: 12,
    minWidth: 40,
    textAlign: 'right',
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
  emptySubtext: {
    color: '#444444',
    fontSize: 14,
    marginTop: 8,
  },
  hint: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: '#444444',
    fontSize: 11,
  },
});
