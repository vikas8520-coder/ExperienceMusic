import { useRef, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

interface CaptureResult {
  uri: string;
  type: 'screenshot' | 'sequence';
}

export function useScreenCapture() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const viewRef = useRef<any>(null);

  const requestPermissions = async (): Promise<boolean> => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant media library access to save captures.'
      );
      return false;
    }
    return true;
  };

  const captureScreenshot = useCallback(async (): Promise<CaptureResult | null> => {
    if (!viewRef.current) {
      Alert.alert('Error', 'Visualizer view not available');
      return null;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return null;

    try {
      setIsCapturing(true);

      const uri = await captureRef(viewRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const filename = `psych_visual_${Date.now()}.png`;
      const asset = await MediaLibrary.createAssetAsync(uri);
      
      await MediaLibrary.createAlbumAsync('Psych Visuals', asset, false);

      Alert.alert('Saved!', 'Screenshot saved to your photo library.');

      return { uri, type: 'screenshot' };
    } catch (error) {
      console.error('Screenshot failed:', error);
      Alert.alert('Error', 'Failed to capture screenshot');
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const captureSequence = useCallback(async (
    durationSeconds: number = 3,
    fps: number = 10
  ): Promise<CaptureResult | null> => {
    if (!viewRef.current) {
      Alert.alert('Error', 'Visualizer view not available');
      return null;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return null;

    try {
      setIsCapturing(true);
      setCaptureProgress(0);

      const totalFrames = durationSeconds * fps;
      const frameInterval = 1000 / fps;
      const frames: string[] = [];

      const captureDir = `${FileSystem.cacheDirectory}sequence_${Date.now()}/`;
      await FileSystem.makeDirectoryAsync(captureDir, { intermediates: true });

      for (let i = 0; i < totalFrames; i++) {
        const uri = await captureRef(viewRef.current, {
          format: 'png',
          quality: 0.8,
          result: 'tmpfile',
        });

        const framePath = `${captureDir}frame_${String(i).padStart(4, '0')}.png`;
        await FileSystem.copyAsync({ from: uri, to: framePath });
        frames.push(framePath);

        setCaptureProgress((i + 1) / totalFrames);
        
        await new Promise(resolve => setTimeout(resolve, frameInterval));
      }

      const firstFrame = frames[0];
      if (firstFrame) {
        const asset = await MediaLibrary.createAssetAsync(firstFrame);
        await MediaLibrary.createAlbumAsync('Psych Visuals', asset, false);
      }

      Alert.alert(
        'Captured!',
        `${totalFrames} frames captured. First frame saved to library.`,
        [
          {
            text: 'Share',
            onPress: async () => {
              if (frames[0] && await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(frames[0]);
              }
            },
          },
          { text: 'OK' },
        ]
      );

      return { uri: captureDir, type: 'sequence' };
    } catch (error) {
      console.error('Sequence capture failed:', error);
      Alert.alert('Error', 'Failed to capture sequence');
      return null;
    } finally {
      setIsCapturing(false);
      setCaptureProgress(0);
    }
  }, []);

  const shareCapture = useCallback(async (uri: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    } else {
      Alert.alert('Sharing not available', 'Cannot share on this device');
    }
  }, []);

  return {
    viewRef,
    isCapturing,
    captureProgress,
    captureScreenshot,
    captureSequence,
    shareCapture,
  };
}
