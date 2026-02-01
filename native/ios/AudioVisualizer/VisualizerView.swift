import SwiftUI

struct VisualizerView: View {
    @StateObject private var viewModel = VisualizerViewModel()
    
    var body: some View {
        ZStack {
            UnityContainerView()
                .edgesIgnoringSafeArea(.all)
            
            VStack {
                Spacer()
                
                if viewModel.showControls {
                    controlsOverlay
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .onAppear {
            viewModel.startVisualizer()
        }
        .onDisappear {
            viewModel.stopVisualizer()
        }
        .gesture(
            TapGesture()
                .onEnded { _ in
                    withAnimation(.easeInOut(duration: 0.3)) {
                        viewModel.showControls.toggle()
                    }
                }
        )
    }
    
    private var controlsOverlay: some View {
        VStack(spacing: 16) {
            if let track = viewModel.currentTrack {
                HStack {
                    if let artworkUrl = track.artworkUrl {
                        AsyncImage(url: URL(string: artworkUrl)) { image in
                            image.resizable()
                        } placeholder: {
                            Color.gray.opacity(0.3)
                        }
                        .frame(width: 50, height: 50)
                        .cornerRadius(8)
                    }
                    
                    VStack(alignment: .leading) {
                        Text(track.title)
                            .font(.headline)
                            .foregroundColor(.white)
                        Text(track.artist)
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    }
                    
                    Spacer()
                }
                .padding(.horizontal)
            }
            
            HStack(spacing: 40) {
                Button(action: { viewModel.previousPreset() }) {
                    Image(systemName: "chevron.left.circle.fill")
                        .font(.system(size: 30))
                }
                
                Button(action: { viewModel.togglePlayback() }) {
                    Image(systemName: viewModel.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                        .font(.system(size: 50))
                }
                
                Button(action: { viewModel.nextPreset() }) {
                    Image(systemName: "chevron.right.circle.fill")
                        .font(.system(size: 30))
                }
            }
            .foregroundColor(.white)
            
            VStack(spacing: 12) {
                HStack {
                    Text("Intensity")
                        .font(.caption)
                        .foregroundColor(.gray)
                    Slider(value: $viewModel.intensity, in: 0.1...2.0)
                        .tint(.cyan)
                }
                
                HStack {
                    Text("Speed")
                        .font(.caption)
                        .foregroundColor(.gray)
                    Slider(value: $viewModel.speed, in: 0.1...3.0)
                        .tint(.purple)
                }
                
                Toggle(isOn: $viewModel.trailsEnabled) {
                    Text("Trails")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
                .toggleStyle(SwitchToggleStyle(tint: .purple))
            }
            .padding(.horizontal, 20)
        }
        .padding(.vertical, 20)
        .background(
            LinearGradient(
                colors: [Color.black.opacity(0.8), Color.black.opacity(0.6)],
                startPoint: .bottom,
                endPoint: .top
            )
        )
    }
}

class VisualizerViewModel: ObservableObject {
    @Published var isPlaying = false
    @Published var showControls = true
    @Published var intensity: Float = 1.0 {
        didSet { sendPresetUpdate() }
    }
    @Published var speed: Float = 1.0 {
        didSet { sendPresetUpdate() }
    }
    @Published var trailsEnabled = false {
        didSet { sendPresetUpdate() }
    }
    @Published var currentTrack: TrackInfo?
    
    private var currentPresetIndex = 0
    private let presets = [
        "Blue Tunnel", "BW Vortex", "Rainbow Spiral", "Red Mandala",
        "Energy Rings", "Psy Tunnel", "Particle Field"
    ]
    
    private var audioAnalyzer: AudioAnalyzer?
    private var displayLink: CADisplayLink?
    
    struct TrackInfo {
        let title: String
        let artist: String
        let artworkUrl: String?
    }
    
    func startVisualizer() {
        UnityBridge.shared.initialize()
        UnityBridge.shared.showUnity()
        startAudioAnalysis()
    }
    
    func stopVisualizer() {
        stopAudioAnalysis()
    }
    
    func togglePlayback() {
        isPlaying.toggle()
        UnityBridge.shared.sendPlaybackMessage(isPlaying: isPlaying, positionMs: 0)
    }
    
    func nextPreset() {
        currentPresetIndex = (currentPresetIndex + 1) % presets.count
        sendPresetUpdate()
    }
    
    func previousPreset() {
        currentPresetIndex = currentPresetIndex > 0 ? currentPresetIndex - 1 : presets.count - 1
        sendPresetUpdate()
    }
    
    private func sendPresetUpdate() {
        UnityBridge.shared.sendPresetMessage(
            presetName: presets[currentPresetIndex],
            intensity: intensity,
            speed: speed,
            trailsOn: trailsEnabled,
            trailsAmount: 0.75
        )
    }
    
    private func startAudioAnalysis() {
        displayLink = CADisplayLink(target: self, selector: #selector(updateAudioBands))
        displayLink?.add(to: .main, forMode: .common)
    }
    
    private func stopAudioAnalysis() {
        displayLink?.invalidate()
        displayLink = nil
    }
    
    /// STUB: Simulates audio bands with random values for testing.
    /// TODO: Replace with real FFT audio analysis using AVAudioEngine:
    /// 1. Tap the audio output using installTap(onBus:)
    /// 2. Apply FFT using Accelerate framework (vDSP_DFT)
    /// 3. Compute band energies: bass (60-250Hz), mid (250-2kHz), high (2k-10kHz)
    /// 4. Normalize and smooth values before sending
    @objc private func updateAudioBands() {
        // STUB: Random values for UI testing - replace with real FFT
        let bass = Float.random(in: 0.3...0.8)
        let mid = Float.random(in: 0.2...0.6)
        let high = Float.random(in: 0.1...0.4)
        
        UnityBridge.shared.sendBandsMessage(bass: bass, mid: mid, high: high)
    }
}

struct UnityContainerView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        let viewController = UIViewController()
        viewController.view.backgroundColor = .black
        return viewController
    }
    
    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}
