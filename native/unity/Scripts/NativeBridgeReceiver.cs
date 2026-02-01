using System;
using UnityEngine;

namespace AudioVisualizer
{
    [Serializable]
    public class TrackMessage
    {
        public string type;
        public string source;
        public string title;
        public string artist;
        public string artworkUrl;
        public int durationMs;
        public string trackId;
        public string albumName;
    }

    [Serializable]
    public class PlaybackMessage
    {
        public string type;
        public bool isPlaying;
        public int positionMs;
        public float volume;
    }

    [Serializable]
    public class BandsMessage
    {
        public string type;
        public float? sub;      // Optional: 20-60Hz
        public float bass;       // Required: 60-250Hz
        public float mid;        // Required: 250-2kHz
        public float high;       // Required: 2k-10kHz
        public float? kick;      // Optional: beat detection
        public float? energy;    // Optional: overall energy
        public float? dominantFreq;
        public int? modeIndex;
        
        public float SubOrDefault => sub ?? 0f;
        public float KickOrDefault => kick ?? 0f;
        public float EnergyOrDefault => energy ?? ((bass + mid + high) / 3f);
    }

    [Serializable]
    public class PresetMessage
    {
        public string type;
        public string presetName;
        public float? intensity;     // Optional: defaults to current value
        public float? speed;         // Optional: defaults to current value
        public bool? trailsOn;       // Optional: defaults to current value
        public float? trailsAmount;  // Optional: defaults to current value
        public string[] colorPalette;
        
        public float IntensityOrDefault(float current) => intensity ?? current;
        public float SpeedOrDefault(float current) => speed ?? current;
        public bool TrailsOnOrDefault(bool current) => trailsOn ?? current;
        public float TrailsAmountOrDefault(float current) => trailsAmount ?? current;
    }

    [Serializable]
    public class ControlMessage
    {
        public string type;
        public string action;
        public float value;
    }

    public class NativeBridgeReceiver : MonoBehaviour
    {
        public static NativeBridgeReceiver Instance { get; private set; }

        public event Action<TrackMessage> OnTrackReceived;
        public event Action<PlaybackMessage> OnPlaybackReceived;
        public event Action<BandsMessage> OnBandsReceived;
        public event Action<PresetMessage> OnPresetReceived;
        public event Action<ControlMessage> OnControlReceived;

        [Header("References")]
        public AudioReactiveController audioController;
        public PresetManager presetManager;

        [Header("Debug")]
        public bool logMessages = false;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
            }
        }

        public void OnNativeMessage(string json)
        {
            if (string.IsNullOrEmpty(json)) return;

            if (logMessages)
            {
                Debug.Log($"[NativeBridge] Received: {json}");
            }

            try
            {
                var baseMessage = JsonUtility.FromJson<BaseMessage>(json);
                
                switch (baseMessage.type)
                {
                    case "track":
                        var trackMsg = JsonUtility.FromJson<TrackMessage>(json);
                        HandleTrackMessage(trackMsg);
                        break;
                    
                    case "playback":
                        var playbackMsg = JsonUtility.FromJson<PlaybackMessage>(json);
                        HandlePlaybackMessage(playbackMsg);
                        break;
                    
                    case "bands":
                        var bandsMsg = JsonUtility.FromJson<BandsMessage>(json);
                        HandleBandsMessage(bandsMsg);
                        break;
                    
                    case "preset":
                        var presetMsg = JsonUtility.FromJson<PresetMessage>(json);
                        HandlePresetMessage(presetMsg);
                        break;
                    
                    case "control":
                        var controlMsg = JsonUtility.FromJson<ControlMessage>(json);
                        HandleControlMessage(controlMsg);
                        break;
                    
                    default:
                        Debug.LogWarning($"[NativeBridge] Unknown message type: {baseMessage.type}");
                        break;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[NativeBridge] Failed to parse message: {e.Message}");
            }
        }

        private void HandleTrackMessage(TrackMessage msg)
        {
            OnTrackReceived?.Invoke(msg);
            
            if (presetManager != null)
            {
                presetManager.SetTrackInfo(msg.title, msg.artist, msg.artworkUrl);
            }
        }

        private void HandlePlaybackMessage(PlaybackMessage msg)
        {
            OnPlaybackReceived?.Invoke(msg);
        }

        private void HandleBandsMessage(BandsMessage msg)
        {
            OnBandsReceived?.Invoke(msg);
            
            if (audioController != null)
            {
                audioController.SetAudioBands(
                    msg.SubOrDefault, 
                    msg.bass, 
                    msg.mid, 
                    msg.high, 
                    msg.KickOrDefault, 
                    msg.EnergyOrDefault
                );
            }
        }

        private void HandlePresetMessage(PresetMessage msg)
        {
            OnPresetReceived?.Invoke(msg);
            
            if (presetManager != null)
            {
                presetManager.SetPreset(msg.presetName);
                
                // Only update optional values if they were provided
                if (msg.intensity.HasValue)
                    presetManager.SetIntensity(msg.intensity.Value);
                if (msg.speed.HasValue)
                    presetManager.SetSpeed(msg.speed.Value);
                if (msg.trailsOn.HasValue || msg.trailsAmount.HasValue)
                    presetManager.SetTrails(
                        msg.TrailsOnOrDefault(presetManager.trailsEnabled), 
                        msg.TrailsAmountOrDefault(presetManager.trailsAmount)
                    );
            }
        }

        private void HandleControlMessage(ControlMessage msg)
        {
            OnControlReceived?.Invoke(msg);
        }

        [Serializable]
        private class BaseMessage
        {
            public string type;
        }

#if UNITY_EDITOR
        [ContextMenu("Test Track Message")]
        private void TestTrackMessage()
        {
            string testJson = "{\"type\":\"track\",\"source\":\"spotify\",\"title\":\"Test Song\",\"artist\":\"Test Artist\",\"durationMs\":180000}";
            OnNativeMessage(testJson);
        }

        [ContextMenu("Test Bands Message")]
        private void TestBandsMessage()
        {
            string testJson = "{\"type\":\"bands\",\"bass\":0.8,\"mid\":0.5,\"high\":0.3}";
            OnNativeMessage(testJson);
        }
#endif
    }
}
