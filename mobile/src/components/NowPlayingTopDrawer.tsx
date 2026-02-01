import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  FlatList,
  Animated,
} from 'react-native';
import { usePlayerStore } from '../stores/playerStore';
import type { Track } from '../types';

const { width } = Dimensions.get('window');

export function NowPlayingTopDrawer() {
  const { 
    track, 
    isPlaying, 
    positionMs, 
    durationMs, 
    togglePlayPause, 
    seek,
    playNext,
    playPrevious,
    queue,
    queueIndex,
    repeatMode,
    shuffleEnabled,
    toggleRepeat,
    toggleShuffle,
    removeFromQueue,
    setQueue,
  } = usePlayerStore();

  const [showQueue, setShowQueue] = useState(false);

  if (!track) return null;

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressPress = (event: { nativeEvent: { locationX: number } }) => {
    const progressBarWidth = width - 32;
    const newProgress = event.nativeEvent.locationX / progressBarWidth;
    const newPosition = newProgress * durationMs;
    seek(newPosition);
  };

  const getRepeatIcon = () => {
    switch (repeatMode) {
      case 'one': return '1';
      case 'all': return 'A';
      default: return 'R';
    }
  };

  const renderQueueItem = ({ item, index }: { item: Track; index: number }) => {
    const isCurrentTrack = index === queueIndex;
    
    return (
      <TouchableOpacity
        style={[styles.queueItem, isCurrentTrack && styles.queueItemActive]}
        onPress={() => setQueue(queue, index)}
      >
        <Image
          source={{ uri: item.artworkUrl || 'https://placehold.co/40x40/1a1a2e/666666?text=Art' }}
          style={styles.queueArtwork}
        />
        <View style={styles.queueInfo}>
          <Text style={[styles.queueTitle, isCurrentTrack && styles.queueTitleActive]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.queueArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeFromQueue(index)}
        >
          <Text style={styles.removeIcon}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.content}>
          <Image
            source={{ uri: track.artworkUrl || 'https://placehold.co/60x60/1a1a2e/666666?text=Art' }}
            style={styles.artwork}
          />
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {track.artist}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.controlButton, shuffleEnabled && styles.controlButtonActive]} 
            onPress={toggleShuffle}
          >
            <Text style={styles.controlIcon}>⇄</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton} onPress={playPrevious}>
            <Text style={styles.controlIcon}>⏮</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
            <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton} onPress={playNext}>
            <Text style={styles.controlIcon}>⏭</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, repeatMode !== 'off' && styles.controlButtonActive]} 
            onPress={toggleRepeat}
          >
            <Text style={styles.controlIcon}>{getRepeatIcon()}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.progressContainer} onPress={handleProgressPress} activeOpacity={0.8}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.time}>{formatTime(positionMs)}</Text>
            <TouchableOpacity onPress={() => setShowQueue(true)}>
              <Text style={styles.queueButton}>Queue ({queue.length})</Text>
            </TouchableOpacity>
            <Text style={styles.time}>{formatTime(durationMs)}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showQueue}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowQueue(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Queue</Text>
              <TouchableOpacity onPress={() => setShowQueue(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>
            
            {queue.length === 0 ? (
              <View style={styles.emptyQueue}>
                <Text style={styles.emptyText}>Queue is empty</Text>
                <Text style={styles.emptySubtext}>Add tracks from your library</Text>
              </View>
            ) : (
              <FlatList
                data={queue}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                renderItem={renderQueueItem}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333344',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#1a1a2e',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    color: '#888888',
    fontSize: 12,
    marginTop: 2,
  },
  controlButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 0, 110, 0.3)',
    borderRadius: 16,
  },
  controlIcon: {
    fontSize: 16,
    color: '#ffffff',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ff006e',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  playIcon: {
    fontSize: 16,
    color: '#ffffff',
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333344',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff006e',
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  time: {
    color: '#666666',
    fontSize: 12,
  },
  queueButton: {
    color: '#ff006e',
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333344',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    color: '#888888',
    fontSize: 28,
    fontWeight: '300',
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222233',
  },
  queueItemActive: {
    backgroundColor: 'rgba(255, 0, 110, 0.15)',
  },
  queueArtwork: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: '#333344',
  },
  queueInfo: {
    flex: 1,
    marginLeft: 12,
  },
  queueTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  queueTitleActive: {
    color: '#ff006e',
  },
  queueArtist: {
    color: '#888888',
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIcon: {
    color: '#666666',
    fontSize: 24,
  },
  emptyQueue: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888888',
    fontSize: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    color: '#555555',
    fontSize: 14,
    marginTop: 8,
  },
});
