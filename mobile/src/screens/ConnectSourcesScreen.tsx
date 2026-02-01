import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../stores/authStore';
import {
  SOUNDCLOUD_CLIENT_ID,
  SOUNDCLOUD_REDIRECT_URI,
  soundcloudAdapter,
} from '../adapters/soundcloudAdapter';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://api.soundcloud.com/connect',
  tokenEndpoint: 'https://api.soundcloud.com/oauth2/token',
};

export function ConnectSourcesScreen() {
  const { isAuthenticated, user, isLoading, error, login, logout, initialize } = useAuthStore();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: SOUNDCLOUD_CLIENT_ID,
      scopes: ['non-expiring'],
      redirectUri: SOUNDCLOUD_REDIRECT_URI,
      responseType: AuthSession.ResponseType.Code,
    },
    discovery
  );

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (response?.type === 'success' && response.params.code) {
      exchangeCodeForToken(response.params.code);
    }
  }, [response]);

  const exchangeCodeForToken = async (code: string) => {
    try {
      const { accessToken, refreshToken } = await soundcloudAdapter.exchangeCodeForToken(code);
      await login(accessToken, refreshToken);
    } catch (err) {
      console.error('Token exchange failed:', err);
    }
  };

  const handleConnect = () => {
    promptAsync();
  };

  if (isLoading) {
    return (
      <LinearGradient colors={['#0a0a0a', '#1a1a2e']} style={styles.container}>
        <ActivityIndicator size="large" color="#ff006e" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0a0a0a', '#1a1a2e']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Psych Visuals</Text>
        <Text style={styles.subtitle}>Audio-Reactive Visualizations</Text>

        {isAuthenticated && user ? (
          <View style={styles.connectedContainer}>
            {user.avatarUrl && (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            )}
            <Text style={styles.connectedText}>Connected as</Text>
            <Text style={styles.username}>{user.fullName || user.username}</Text>
            <TouchableOpacity style={styles.disconnectButton} onPress={logout}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.connectButton, !request && styles.buttonDisabled]}
              onPress={handleConnect}
              disabled={!request}
            >
              <View style={styles.buttonContent}>
                <View style={styles.soundcloudIcon}>
                  <Text style={styles.iconText}>SC</Text>
                </View>
                <Text style={styles.buttonText}>Connect SoundCloud</Text>
              </View>
            </TouchableOpacity>

            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 60,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#ff5500',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: 280,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundcloudIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    color: '#ff5500',
    fontWeight: 'bold',
    fontSize: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff4444',
    marginTop: 16,
    textAlign: 'center',
  },
  connectedContainer: {
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  connectedText: {
    color: '#888888',
    fontSize: 14,
  },
  username: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 24,
  },
  disconnectButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#444444',
  },
  disconnectText: {
    color: '#888888',
    fontSize: 14,
  },
});
