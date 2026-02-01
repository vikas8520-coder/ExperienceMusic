import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gyroscope } from 'expo-sensors';
import { usePlayerStore } from '../stores/playerStore';
import { useVisualizerStore } from '../stores/visualizerStore';
import { useAudioAnalysis } from '../hooks/useAudioAnalysis';
import { useScreenCapture } from '../hooks/useScreenCapture';
import { GLVisualizer } from '../components/GLVisualizer';
import type { VisualPreset } from '../types';

const { width, height } = Dimensions.get('window');

const GL_SUPPORTED_PRESETS: VisualPreset[] = [
  'energy-rings',
  'psy-tunnel', 
  'particle-field',
  'waveform-sphere',
  'audio-bars',
  'geometric-kaleidoscope',
  'cosmic-web',
];

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
  const { settings, gyroscope, gyroscopeEnabled, updateGyroscope } = useVisualizerStore();
  const audioBands = useAudioAnalysis();
  
  const animatedValues = useRef(
    Array.from({ length: 12 }, () => new Animated.Value(0))
  ).current;
  
  const offsetX = useRef(new Animated.Value(0)).current;
  const offsetY = useRef(new Animated.Value(0)).current;
  const rotationOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!gyroscopeEnabled) {
      Animated.parallel([
        Animated.timing(offsetX, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(offsetY, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(rotationOffset, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      return;
    }

    Gyroscope.setUpdateInterval(50);
    const subscription = Gyroscope.addListener((data) => {
      updateGyroscope(data);
      
      const maxOffset = 50;
      const sensitivity = 30;
      
      const newX = Math.max(-maxOffset, Math.min(maxOffset, data.y * sensitivity));
      const newY = Math.max(-maxOffset, Math.min(maxOffset, data.x * sensitivity));
      const newRotation = data.z * 20;
      
      Animated.parallel([
        Animated.spring(offsetX, { toValue: newX, useNativeDriver: true, tension: 50, friction: 10 }),
        Animated.spring(offsetY, { toValue: newY, useNativeDriver: true, tension: 50, friction: 10 }),
        Animated.spring(rotationOffset, { toValue: newRotation, useNativeDriver: true, tension: 50, friction: 10 }),
      ]).start();
    });

    return () => subscription.remove();
  }, [gyroscopeEnabled]);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const time = Date.now() / 1000;
      const progress = durationMs > 0 ? positionMs / durationMs : 0;
      
      const gyroInfluence = gyroscopeEnabled ? 
        Math.abs(gyroscope.x) * 0.3 + Math.abs(gyroscope.y) * 0.3 : 0;

      animatedValues.forEach((anim, i) => {
        const phase = (i / animatedValues.length) * Math.PI * 2;
        const energy = 0.3 + audioBands.energy * 0.7 + gyroInfluence;
        const speedMultiplier = settings.speed;
        
        const value = 
          Math.sin(time * 2 * speedMultiplier + phase) * 0.3 +
          Math.sin(time * 3.5 * speedMultiplier + phase * 1.5) * 0.2 +
          Math.sin(progress * Math.PI * 4 + phase) * 0.2 +
          energy * 0.3 * settings.intensity;

        Animated.timing(anim, {
          toValue: Math.abs(value),
          duration: 50,
          useNativeDriver: true,
        }).start();
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, positionMs, durationMs, audioBands.energy, gyroscope, gyroscopeEnabled, settings.speed, settings.intensity]);

  const colors = settings.colorPalette;
  const ringCount = settings.preset.includes('ring') ? 8 : 6;

  return (
    <Animated.View 
      style={[
        styles.visualizerContainer,
        {
          transform: [
            { translateX: offsetX },
            { translateY: offsetY },
          ],
        },
      ]}
    >
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
                      outputRange: [0.8, 1.2 + settings.intensity * 0.3],
                    }),
                  },
                  {
                    rotate: Animated.add(
                      anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, i * 15 * (Math.PI / 180)],
                      }),
                      rotationOffset.interpolate({
                        inputRange: [-180, 180],
                        outputRange: [-Math.PI, Math.PI],
                      })
                    ).interpolate({
                      inputRange: [-Math.PI, Math.PI],
                      outputRange: ['-180deg', '180deg'],
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
    </Animated.View>
  );
}

export function VisualizerScreen() {
  const { settings, setPreset, gyroscopeEnabled, toggleGyroscope, setIntensity, setSpeed } = useVisualizerStore();
  const [showPresets, setShowPresets] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [useGLRenderer, setUseGLRenderer] = useState(true);
  const { viewRef, isCapturing, captureProgress, captureScreenshot, captureSequence } = useScreenCapture();
  
  const isGLPreset = GL_SUPPORTED_PRESETS.includes(settings.preset);

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
      <View ref={viewRef} style={styles.visualizerWrapper} collapsable={false}>
        {useGLRenderer && isGLPreset ? <GLVisualizer /> : <SimpleVisualizer />}
      </View>
      
      {isCapturing && (
        <View style={styles.captureOverlay}>
          <ActivityIndicator size="large" color="#ff006e" />
          <Text style={styles.captureText}>
            Capturing... {Math.round(captureProgress * 100)}%
          </Text>
        </View>
      )}

      <View style={styles.topControls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setShowSettings(!showSettings)}
        >
          <Text style={styles.controlButtonText}>⚙</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.controlButton, gyroscopeEnabled && styles.controlButtonActive]}
          onPress={toggleGyroscope}
        >
          <Text style={styles.controlButtonText}>📱</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setShowPresets(!showPresets)}
        >
          <Text style={styles.controlButtonText}>
            {showPresets ? '✕' : '🎨'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.controlButton, isCapturing && styles.controlButtonDisabled]}
          onPress={captureScreenshot}
          disabled={isCapturing}
        >
          <Text style={styles.controlButtonText}>📷</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.controlButton, isCapturing && styles.controlButtonDisabled]}
          onPress={() => captureSequence(3, 10)}
          disabled={isCapturing}
        >
          <Text style={styles.controlButtonText}>🎬</Text>
        </TouchableOpacity>
      </View>

      {gyroscopeEnabled && (
        <View style={styles.gyroIndicator}>
          <Text style={styles.gyroText}>Gyroscope Active</Text>
          <Text style={styles.gyroSubtext}>Tilt to control visuals</Text>
        </View>
      )}

      {showSettings && (
        <View style={styles.settingsPanel}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>WebGL Renderer</Text>
            <Switch
              value={useGLRenderer}
              onValueChange={setUseGLRenderer}
              trackColor={{ false: '#333344', true: '#ff006e' }}
              thumbColor={useGLRenderer ? '#ffffff' : '#888888'}
            />
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Gyroscope Control</Text>
            <Switch
              value={gyroscopeEnabled}
              onValueChange={toggleGyroscope}
              trackColor={{ false: '#333344', true: '#ff006e' }}
              thumbColor={gyroscopeEnabled ? '#ffffff' : '#888888'}
            />
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Intensity: {(settings.intensity * 100).toFixed(0)}%</Text>
          </View>
          <View style={styles.sliderRow}>
            {[0.3, 0.5, 0.7, 1.0].map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.sliderButton, settings.intensity === val && styles.sliderButtonActive]}
                onPress={() => setIntensity(val)}
              >
                <Text style={styles.sliderButtonText}>{(val * 100).toFixed(0)}%</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Speed: {settings.speed.toFixed(1)}x</Text>
          </View>
          <View style={styles.sliderRow}>
            {[0.5, 1.0, 1.5, 2.0].map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.sliderButton, settings.speed === val && styles.sliderButtonActive]}
                onPress={() => setSpeed(val)}
              >
                <Text style={styles.sliderButtonText}>{val}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

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
  visualizerWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  visualizerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  captureText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
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
  topControls: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'column',
    gap: 12,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 0, 110, 0.5)',
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  controlButtonText: {
    fontSize: 20,
  },
  gyroIndicator: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(255, 0, 110, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  gyroText: {
    color: '#ff006e',
    fontSize: 12,
    fontWeight: '600',
  },
  gyroSubtext: {
    color: '#888888',
    fontSize: 10,
    marginTop: 2,
  },
  settingsPanel: {
    position: 'absolute',
    top: 120,
    right: 20,
    width: 200,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333344',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabel: {
    color: '#ffffff',
    fontSize: 14,
  },
  sliderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  sliderButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#333344',
    borderRadius: 6,
    alignItems: 'center',
  },
  sliderButtonActive: {
    backgroundColor: '#ff006e',
  },
  sliderButtonText: {
    color: '#ffffff',
    fontSize: 11,
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
