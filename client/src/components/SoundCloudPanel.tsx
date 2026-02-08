import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  X, 
  Search, 
  Heart, 
  ListMusic, 
  Play, 
  Loader2, 
  LogOut,
  Music2,
  User,
  Cloud
} from 'lucide-react';
import { 
  useSoundCloudStore, 
  fetchSoundCloudConfig,
  searchTracks,
  fetchUserLikes,
  fetchUserPlaylists,
  getStreamUrl,
  fetchUserInfo,
  SoundCloudTrack,
} from '@/stores/soundcloudStore';

interface SoundCloudPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayTrack: (url: string, title: string, artworkUrl?: string) => void;
}

export function SoundCloudPanel({ isOpen, onClose, onPlayTrack }: SoundCloudPanelProps) {
  const {
    auth,
    user,
    clientId,
    isLoading,
    error,
    tracks,
    likes,
    playlists,
    searchQuery,
    activeTab,
    setClientId,
    setUser,
    logout,
    setSearchQuery,
    setActiveTab,
    setTracks,
    setLikes,
    setPlaylists,
    setLoading,
    setError,
    isAuthenticated,
    getAuthHeader,
    refreshTokenIfNeeded,
    initiateLogin,
    handleTokenFromHash,
  } = useSoundCloudStore();

  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [loadingTrackId, setLoadingTrackId] = useState<number | null>(null);

  useEffect(() => {
    async function loadConfig() {
      const id = await fetchSoundCloudConfig();
      if (id) setClientId(id);
    }
    if (!clientId) loadConfig();
  }, [clientId, setClientId]);

  // Check for OAuth token in URL hash (from backend callback redirect)
  useEffect(() => {
    handleTokenFromHash();
  }, [handleTokenFromHash]);

  useEffect(() => {
    if (isAuthenticated() && !user) {
      loadUserInfo();
    }
  }, [auth, user]);

  const loadUserInfo = async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    
    try {
      const userInfo = await fetchUserInfo(authHeader);
      if (userInfo) setUser(userInfo);
    } catch (err) {
      console.error('Failed to load user info:', err);
    }
  };

  const handleLogin = () => {
    initiateLogin();
  };

  const handleSearch = useCallback(async () => {
    if (!localSearchQuery.trim()) return;
    
    const valid = await refreshTokenIfNeeded();
    if (!valid) return;
    
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    
    setLoading(true);
    setError(null);
    setSearchQuery(localSearchQuery);
    
    try {
      const results = await searchTracks(localSearchQuery, authHeader);
      setTracks(results);
    } catch (err) {
      setError('Failed to search tracks');
    } finally {
      setLoading(false);
    }
  }, [localSearchQuery, refreshTokenIfNeeded, getAuthHeader, setSearchQuery, setTracks, setLoading, setError]);

  const loadLikes = useCallback(async () => {
    const valid = await refreshTokenIfNeeded();
    if (!valid) return;
    
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const userLikes = await fetchUserLikes(authHeader);
      setLikes(userLikes);
    } catch (err) {
      setError('Failed to load likes');
    } finally {
      setLoading(false);
    }
  }, [refreshTokenIfNeeded, getAuthHeader, setLikes, setLoading, setError]);

  const loadPlaylists = useCallback(async () => {
    const valid = await refreshTokenIfNeeded();
    if (!valid) return;
    
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const userPlaylists = await fetchUserPlaylists(authHeader);
      setPlaylists(userPlaylists);
    } catch (err) {
      setError('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  }, [refreshTokenIfNeeded, getAuthHeader, setPlaylists, setLoading, setError]);

  useEffect(() => {
    if (isAuthenticated() && isOpen) {
      if (activeTab === 'likes' && likes.length === 0) {
        loadLikes();
      } else if (activeTab === 'playlists' && playlists.length === 0) {
        loadPlaylists();
      }
    }
  }, [activeTab, isAuthenticated, isOpen, likes.length, playlists.length, loadLikes, loadPlaylists]);

  const handlePlayTrack = async (track: SoundCloudTrack) => {
    const valid = await refreshTokenIfNeeded();
    if (!valid) return;
    
    const authHeader = getAuthHeader();
    if (!authHeader) return;
    
    setLoadingTrackId(track.id);
    
    try {
      const streamUrl = await getStreamUrl(track.id, authHeader);
      if (streamUrl) {
        const artworkUrl = track.artwork_url?.replace('-large', '-t500x500');
        onPlayTrack(streamUrl, `${track.title} - ${track.user.username}`, artworkUrl);
        onClose();
      } else {
        setError('This track is not available for streaming');
      }
    } catch (err) {
      setError('Failed to get stream URL');
    } finally {
      setLoadingTrackId(null);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      data-testid="soundcloud-panel-overlay"
    >
      <div 
        className="fixed right-0 top-0 h-full w-full max-w-md bg-background/95 backdrop-blur-xl border-l border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="soundcloud-panel"
        data-ui-root="true"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-orange-500" />
            <span className="font-semibold">SoundCloud</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            data-testid="button-close-soundcloud"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {!isAuthenticated() ? (
          <div className="flex flex-col items-center justify-center h-[calc(100%-4rem)] p-6 gap-6">
            <Cloud className="w-16 h-16 text-orange-500" />
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Connect to SoundCloud</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Sign in to search and play music from SoundCloud
              </p>
            </div>
            <Button 
              onClick={handleLogin}
              disabled={!clientId || isLoading}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="button-soundcloud-login"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4 mr-2" />
              )}
              Connect with SoundCloud
            </Button>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {!clientId && (
              <p className="text-xs text-muted-foreground text-center">
                SoundCloud integration requires configuration. Contact the administrator.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100%-4rem)]">
            {user && (
              <div className="flex items-center justify-between p-3 bg-muted/50 border-b">
                <div className="flex items-center gap-2">
                  {user.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.username}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <User className="w-8 h-8 p-1.5 bg-muted rounded-full" />
                  )}
                  <span className="text-sm font-medium">{user.username}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={logout}
                  data-testid="button-soundcloud-logout"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Logout
                </Button>
              </div>
            )}

            <Tabs 
              value={activeTab} 
              onValueChange={(v) => setActiveTab(v as 'search' | 'likes' | 'playlists')}
              className="flex-1 flex flex-col"
            >
              <TabsList className="w-full grid grid-cols-3 m-2 mr-4">
                <TabsTrigger value="search" className="gap-1" data-testid="tab-search">
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Search</span>
                </TabsTrigger>
                <TabsTrigger value="likes" className="gap-1" data-testid="tab-likes">
                  <Heart className="w-4 h-4" />
                  <span className="hidden sm:inline">Likes</span>
                </TabsTrigger>
                <TabsTrigger value="playlists" className="gap-1" data-testid="tab-playlists">
                  <ListMusic className="w-4 h-4" />
                  <span className="hidden sm:inline">Playlists</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="flex-1 flex flex-col m-0 px-2">
                <div className="flex gap-2 p-2">
                  <Input
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search tracks..."
                    className="flex-1"
                    data-testid="input-search"
                  />
                  <Button 
                    onClick={handleSearch}
                    disabled={isLoading || !localSearchQuery.trim()}
                    size="icon"
                    data-testid="button-search"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <TrackList 
                    tracks={tracks}
                    onPlay={handlePlayTrack}
                    loadingTrackId={loadingTrackId}
                    formatDuration={formatDuration}
                  />
                </ScrollArea>
              </TabsContent>

              <TabsContent value="likes" className="flex-1 flex flex-col m-0 px-2">
                <ScrollArea className="flex-1">
                  {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : (
                    <TrackList 
                      tracks={likes}
                      onPlay={handlePlayTrack}
                      loadingTrackId={loadingTrackId}
                      formatDuration={formatDuration}
                    />
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="playlists" className="flex-1 flex flex-col m-0 px-2">
                <ScrollArea className="flex-1">
                  {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : playlists.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                      <ListMusic className="w-12 h-12 mb-2 opacity-50" />
                      <p>No playlists found</p>
                    </div>
                  ) : (
                    <div className="space-y-2 p-2">
                      {playlists.map((playlist) => (
                        <div 
                          key={playlist.id}
                          className="p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            {playlist.artwork_url ? (
                              <img 
                                src={playlist.artwork_url}
                                alt={playlist.title}
                                className="w-12 h-12 rounded object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                                <ListMusic className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{playlist.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {playlist.track_count} tracks
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {error && (
              <div className="p-2 mx-2 mb-2 rounded bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TrackList({ 
  tracks, 
  onPlay, 
  loadingTrackId,
  formatDuration 
}: { 
  tracks: SoundCloudTrack[];
  onPlay: (track: SoundCloudTrack) => void;
  loadingTrackId: number | null;
  formatDuration: (ms: number) => string;
}) {
  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
        <Music2 className="w-12 h-12 mb-2 opacity-50" />
        <p>No tracks to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {tracks.map((track) => (
        <div 
          key={track.id}
          className="flex items-center gap-3 p-2 rounded-lg hover-elevate cursor-pointer group"
          onClick={() => onPlay(track)}
          data-testid={`track-${track.id}`}
        >
          <div className="relative w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
            {track.artwork_url ? (
              <img 
                src={track.artwork_url}
                alt={track.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music2 className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {loadingTrackId === track.id ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm">{track.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {track.user.username} • {formatDuration(track.duration)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
