import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlayerStore } from '../stores/playerStore';
import { useVisualizerStore } from '../stores/visualizerStore';
import type { VisualPreset } from '../types';

const { width, height } = Dimensions.get('window');

const PRESETS: { id: VisualPreset; name: string; category: string }[] = [
  { id: 'energy-rings', name: 'Energy Rings', category: 'Base' },
  { id: 'psy-tunnel', name: 'Psy Tunnel', category: 'Base' },
  { id: 'particle-field', name: 'Particle Field', category: 'Base' },
  { id: 'waveform-sphere', name: 'Waveform Sphere', category: 'Base' },
  { id: 'audio-bars', name: 'Audio Bars', category: 'Base' },
  { id: 'geometric-kaleidoscope', name: 'Kaleidoscope', category: 'Base' },
  { id: 'cosmic-web', name: 'Cosmic Web', category: 'Base' },
  { id: 'cymatic-sand', name: 'Cymatic Sand', category: 'Cymatics' },
  { id: 'water-membrane', name: 'Water Membrane', category: 'Cymatics' },
  { id: 'chladni', name: 'Chladni', category: 'Cymatics' },
  { id: 'resonant-field', name: 'Resonant Field', category: 'Cymatics' },
];

function SimpleVisualizer() {
  const { positionMs, durationMs, isPlaying } = usePlayerStore();
  const { settings, audioBands } = useVisualizerStore();
  
  const animatedValues = useRef(
    Array.from({ length: 12 }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const time = Date.now() / 1000;
      const progress = durationMs > 0 ? positionMs / durationMs : 0;

      animatedValues.forEach((anim, i) => {
        const phase = (i / animatedValues.length) * Math.PI * 2;
        const energy = 0.3 + audioBands.energy * 0.7;
        const value = 
          Math.sin(time * 2 + phase) * 0.3 +
          Math.sin(time * 3.5 + phase * 1.5) * 0.2 +
          Math.sin(progress * Math.PI * 4 + phase) * 0.2 +
          energy * 0.3;

        Animated.timing(anim, {
          toValue: Math.abs(value),
          duration: 50,
          useNativeDriver: true,
        }).start();
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, positionMs, durationMs, audioBands.energy]);

  const colors = settings.colorPalette;
  const ringCount = settings.preset.includes('ring') ? 8 : 6;

  return (
    <View style={styles.visualizerContainer}>
      {animatedValues.slice(0, ringCount).map((anim, i) => {
        const size = 80 + i * 50;
        const colorIndex = i % colors.length;
        return (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: colors[colorIndex],
                transform: [
                  {
                    scale: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.2],
                    }),
                  },
                  {
                    rotate: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', `${i * 15}deg`],
                    }),
                  },
                ],
                opacity: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.9],
                }),
              },
            ]}
          />
        );
      })}
      <View style={styles.centerGlow}>
        <LinearGradient
          colors={[colors[0] + '80', colors[1] + '40', 'transparent']}
          style={styles.glowGradient}
        />
      </View>
    </View>
  );
}

export function VisualizerScreen() {
  const { settings, setPreset } = useVisualizerStore();
  const [showPresets, setShowPresets] = React.useState(false);

  const groupedPresets = PRESETS.reduce(
    (acc, preset) => {
      if (!acc[preset.category]) acc[preset.category] = [];
      acc[preset.category].push(preset);
      return acc;
    },
    {} as Record<string, typeof PRESETS>
  );

  return (
    <View style={styles.container}>
      <SimpleVisualizer />

      <TouchableOpacity
        style={styles.presetToggle}
        onPress={() => setShowPresets(!showPresets)}
      >
        <Text style={styles.presetToggleText}>
          {showPresets ? '✕' : '🎨'}
        </Text>
      </TouchableOpacity>

      {showPresets && (
        <View style={styles.presetPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {Object.entries(groupedPresets).map(([category, presets]) => (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{category}</Text>
                <View style={styles.presetRow}>
                  {presets.map((preset) => (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.presetButton,
                        settings.preset === preset.id && styles.presetButtonActive,
                      ]}
                      onPress={() => setPreset(preset.id)}
                    >
                      <View style={styles.presetThumb}>
                        <LinearGradient
                          colors={settings.colorPalette.slice(0, 2) as [string, string]}
                          style={styles.presetGradient}
                        />
                      </View>
                      <Text
                        style={[
                          styles.presetName,
                          settings.preset === preset.id && styles.presetNameActive,
                        ]}
                        numberOfLines={1}
                      >
                        {preset.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  visualizerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  centerGlow: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  glowGradient: {
    flex: 1,
  },
  presetToggle: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetToggleText: {
    fontSize: 20,
  },
  presetPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    paddingTop: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  categorySection: {
    marginLeft: 16,
  },
  categoryTitle: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 12,
  },
  presetButton: {
    width: 70,
    alignItems: 'center',
  },
  presetButtonActive: {
    transform: [{ scale: 1.05 }],
  },
  presetThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 6,
  },
  presetGradient: {
    flex: 1,
  },
  presetName: {
    color: '#666666',
    fontSize: 11,
    textAlign: 'center',
  },
  presetNameActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
