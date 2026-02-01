using UnityEngine;

namespace AudioVisualizer
{
    public class AudioReactiveController : MonoBehaviour
    {
        [Header("Current Audio Values (0-1 normalized)")]
        [Range(0, 1)] public float sub;
        [Range(0, 1)] public float bass;
        [Range(0, 1)] public float mid;
        [Range(0, 1)] public float high;
        [Range(0, 1)] public float kick;
        [Range(0, 1)] public float energy;

        [Header("Smoothing Settings")]
        [Tooltip("Smoothing for sub frequencies (20-60Hz) - slower for body feel")]
        [Range(0.01f, 0.3f)] public float subSmoothing = 0.06f;
        
        [Tooltip("Smoothing for bass frequencies (60-250Hz) - medium for punch")]
        [Range(0.01f, 0.3f)] public float bassSmoothing = 0.12f;
        
        [Tooltip("Smoothing for mid frequencies (250-2kHz) - medium-fast for geometry")]
        [Range(0.01f, 0.3f)] public float midSmoothing = 0.15f;
        
        [Tooltip("Smoothing for high frequencies (2k-10kHz) - fast for sparkle")]
        [Range(0.01f, 0.3f)] public float highSmoothing = 0.2f;
        
        [Tooltip("Smoothing for kick detection - fast attack")]
        [Range(0.01f, 0.3f)] public float kickSmoothing = 0.25f;

        [Header("Attack/Release")]
        [Tooltip("Attack multiplier - how fast values rise")]
        [Range(1f, 5f)] public float attackMultiplier = 3f;
        
        [Tooltip("Release multiplier - how fast values fall")]
        [Range(0.5f, 2f)] public float releaseMultiplier = 0.8f;

        private float targetSub;
        private float targetBass;
        private float targetMid;
        private float targetHigh;
        private float targetKick;
        private float targetEnergy;

        public float SmoothedSub => sub;
        public float SmoothedBass => bass;
        public float SmoothedMid => mid;
        public float SmoothedHigh => high;
        public float SmoothedKick => kick;
        public float SmoothedEnergy => energy;

        private void Update()
        {
            float dt = Time.deltaTime;
            
            sub = SmoothValue(sub, targetSub, subSmoothing, dt);
            bass = SmoothValue(bass, targetBass, bassSmoothing, dt);
            mid = SmoothValue(mid, targetMid, midSmoothing, dt);
            high = SmoothValue(high, targetHigh, highSmoothing, dt);
            kick = SmoothValue(kick, targetKick, kickSmoothing, dt);
            energy = SmoothValue(energy, targetEnergy, midSmoothing, dt);
        }

        private float SmoothValue(float current, float target, float smoothing, float dt)
        {
            float speed;
            
            if (target > current)
            {
                speed = smoothing * attackMultiplier;
            }
            else
            {
                speed = smoothing * releaseMultiplier;
            }
            
            float factor = 1f - Mathf.Exp(-speed / Mathf.Max(0.001f, dt));
            return Mathf.Lerp(current, target, factor * dt * 60f);
        }

        public void SetAudioBands(float newSub, float newBass, float newMid, float newHigh, float newKick, float newEnergy)
        {
            targetSub = Mathf.Clamp01(newSub);
            targetBass = Mathf.Clamp01(newBass);
            targetMid = Mathf.Clamp01(newMid);
            targetHigh = Mathf.Clamp01(newHigh);
            targetKick = Mathf.Clamp01(newKick);
            targetEnergy = Mathf.Clamp01(newEnergy);
        }

        public void SetBassAndMidHigh(float newBass, float newMid, float newHigh)
        {
            SetAudioBands(0f, newBass, newMid, newHigh, 0f, (newBass + newMid + newHigh) / 3f);
        }

        public void Reset()
        {
            sub = bass = mid = high = kick = energy = 0f;
            targetSub = targetBass = targetMid = targetHigh = targetKick = targetEnergy = 0f;
        }

#if UNITY_EDITOR
        [Header("Debug Testing")]
        [Range(0, 1)] public float testBass = 0.5f;
        [Range(0, 1)] public float testMid = 0.5f;
        [Range(0, 1)] public float testHigh = 0.5f;

        [ContextMenu("Apply Test Values")]
        private void ApplyTestValues()
        {
            SetBassAndMidHigh(testBass, testMid, testHigh);
        }

        [ContextMenu("Simulate Beat")]
        private void SimulateBeat()
        {
            targetBass = 1f;
            targetKick = 1f;
            Invoke(nameof(ResetKick), 0.1f);
        }

        private void ResetKick()
        {
            targetKick = 0f;
        }
#endif
    }
}
