import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';

import { ConnectSourcesScreen } from '../screens/ConnectSourcesScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { VisualizerScreen } from '../screens/VisualizerScreen';
import { NowPlayingTopDrawer } from '../components/NowPlayingTopDrawer';
import { useAuthStore } from '../stores/authStore';
import { usePlayerStore } from '../stores/playerStore';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Library: '🎵',
    Visualizer: '✨',
    Settings: '⚙️',
  };
  return (
    <View style={styles.tabIcon}>
      <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.5 }}>
        {icons[name] || '•'}
      </Text>
    </View>
  );
}

function MainTabs() {
  const { track } = usePlayerStore();

  return (
    <View style={styles.container}>
      {track && <NowPlayingTopDrawer />}
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarShowLabel: true,
          tabBarLabelStyle: styles.tabLabel,
          tabBarActiveTintColor: '#ff006e',
          tabBarInactiveTintColor: '#666666',
          tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        })}
      >
        <Tab.Screen name="Library" component={LibraryScreen} />
        <Tab.Screen name="Visualizer" component={VisualizerScreen} />
      </Tab.Navigator>
    </View>
  );
}

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Connect" component={ConnectSourcesScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
  },
  tabBar: {
    backgroundColor: '#0a0a0a',
    borderTopColor: '#1a1a2e',
    paddingTop: 8,
    height: 80,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
