using System;
using UnityEngine;
using UnityEngine.UI;

namespace AudioVisualizer
{
    public enum VisualizerPreset
    {
        BlueTunnel,
        BWVortex,
        RainbowSpiral,
        RedMandala,
        EnergyRings,
        PsyTunnel,
        ParticleField,
        WaveformSphere,
        AudioBars,
        GeometricKaleidoscope,
        CosmicWeb
    }

    public class PresetManager : MonoBehaviour
    {
        [Header("Current Preset")]
        public VisualizerPreset currentPreset = VisualizerPreset.BlueTunnel;

        [Header("Shader References")]
        public Material blueTunnelMaterial;
        public Material bwVortexMaterial;
        public Material rainbowSpiralMaterial;
        public Material redMandalaMaterial;

        [Header("Visualization Settings")]
        [Range(0.1f, 2f)] public float intensity = 1f;
        [Range(0.1f, 3f)] public float speed = 1f;
        public bool trailsEnabled = false;
        [Range(0f, 1f)] public float trailsAmount = 0.75f;
        [Range(0f, 1f)] public float thumbnailBlend = 0.5f;

        [Header("Track Info")]
        public string trackTitle;
        public string trackArtist;
        public Texture2D artworkTexture;

        [Header("UI References (Optional)")]
        public Text titleText;
        public Text artistText;
        public RawImage artworkImage;

        [Header("Post Processing")]
        public float bloomIntensity = 1f;
        public float chromaticAberration = 0.01f;
        public float vignetteIntensity = 0.35f;

        public event Action<VisualizerPreset> OnPresetChanged;
        public event Action<float> OnIntensityChanged;
        public event Action<float> OnSpeedChanged;

        private Material currentMaterial;

        private void Start()
        {
            ApplyPreset(currentPreset);
        }

        public void SetPreset(string presetName)
        {
            if (Enum.TryParse<VisualizerPreset>(presetName.Replace(" ", ""), true, out var preset))
            {
                SetPreset(preset);
            }
            else
            {
                Debug.LogWarning($"[PresetManager] Unknown preset: {presetName}");
            }
        }

        public void SetPreset(VisualizerPreset preset)
        {
            if (currentPreset != preset)
            {
                currentPreset = preset;
                ApplyPreset(preset);
                OnPresetChanged?.Invoke(preset);
            }
        }

        public void NextPreset()
        {
            int nextIndex = ((int)currentPreset + 1) % Enum.GetValues(typeof(VisualizerPreset)).Length;
            SetPreset((VisualizerPreset)nextIndex);
        }

        public void PreviousPreset()
        {
            int prevIndex = (int)currentPreset - 1;
            if (prevIndex < 0) prevIndex = Enum.GetValues(typeof(VisualizerPreset)).Length - 1;
            SetPreset((VisualizerPreset)prevIndex);
        }

        private void ApplyPreset(VisualizerPreset preset)
        {
            switch (preset)
            {
                case VisualizerPreset.BlueTunnel:
                    currentMaterial = blueTunnelMaterial;
                    break;
                case VisualizerPreset.BWVortex:
                    currentMaterial = bwVortexMaterial;
                    break;
                case VisualizerPreset.RainbowSpiral:
                    currentMaterial = rainbowSpiralMaterial;
                    break;
                case VisualizerPreset.RedMandala:
                    currentMaterial = redMandalaMaterial;
                    break;
                default:
                    currentMaterial = blueTunnelMaterial;
                    break;
            }

            UpdateMaterialProperties();
        }

        private void UpdateMaterialProperties()
        {
            if (currentMaterial == null) return;

            currentMaterial.SetFloat("_Intensity", intensity);
            currentMaterial.SetFloat("_Speed", speed);
            currentMaterial.SetFloat("_TrailsAmount", trailsEnabled ? trailsAmount : 0f);
            
            if (artworkTexture != null)
            {
                currentMaterial.SetTexture("_ArtworkTex", artworkTexture);
                currentMaterial.SetFloat("_ThumbnailBlend", thumbnailBlend);
            }
        }

        public void SetIntensity(float value)
        {
            intensity = Mathf.Clamp(value, 0.1f, 2f);
            UpdateMaterialProperties();
            OnIntensityChanged?.Invoke(intensity);
        }

        public void SetSpeed(float value)
        {
            speed = Mathf.Clamp(value, 0.1f, 3f);
            UpdateMaterialProperties();
            OnSpeedChanged?.Invoke(speed);
        }

        public void SetTrails(bool enabled, float amount)
        {
            trailsEnabled = enabled;
            trailsAmount = Mathf.Clamp01(amount);
            UpdateMaterialProperties();
        }

        public void SetThumbnailBlend(float blend)
        {
            thumbnailBlend = Mathf.Clamp01(blend);
            UpdateMaterialProperties();
        }

        public void SetTrackInfo(string title, string artist, string artworkUrl)
        {
            trackTitle = title;
            trackArtist = artist;

            if (titleText != null) titleText.text = title;
            if (artistText != null) artistText.text = artist;

            if (!string.IsNullOrEmpty(artworkUrl))
            {
                StartCoroutine(LoadArtwork(artworkUrl));
            }
        }

        private System.Collections.IEnumerator LoadArtwork(string url)
        {
            using (var www = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(url))
            {
                yield return www.SendWebRequest();

                if (www.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    artworkTexture = UnityEngine.Networking.DownloadHandlerTexture.GetContent(www);
                    
                    if (artworkImage != null)
                    {
                        artworkImage.texture = artworkTexture;
                    }
                    
                    UpdateMaterialProperties();
                }
                else
                {
                    Debug.LogWarning($"[PresetManager] Failed to load artwork: {www.error}");
                }
            }
        }

        public void SetColorPalette(Color[] colors)
        {
            if (currentMaterial == null || colors == null || colors.Length == 0) return;

            if (colors.Length >= 1) currentMaterial.SetColor("_Color1", colors[0]);
            if (colors.Length >= 2) currentMaterial.SetColor("_Color2", colors[1]);
            if (colors.Length >= 3) currentMaterial.SetColor("_Color3", colors[2]);
            if (colors.Length >= 4) currentMaterial.SetColor("_Color4", colors[3]);
        }

        public Material GetCurrentMaterial()
        {
            return currentMaterial;
        }

#if UNITY_EDITOR
        [ContextMenu("Test Next Preset")]
        private void TestNextPreset()
        {
            NextPreset();
        }
#endif
    }
}
