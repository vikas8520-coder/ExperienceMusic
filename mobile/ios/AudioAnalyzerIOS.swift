// ios/AudioAnalyzerIOS.swift
// Native module stub (iOS)
// NOTE: Stub only; FFT/beat implementation points are marked TODO.

import Foundation
import AVFoundation
import React

@objc(AudioAnalyzerIOS)
class AudioAnalyzerIOS: RCTEventEmitter {
  private var isRunning = false
  private var timer: Timer?

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return ["AudioBandsUpdate"]
  }

  /**
   Starts analysis tap/pipeline.
   Edge cases:
   - No active audio playback session -> reject
   - AVAudioSession misconfigured -> reject
   */
  @objc(startAnalysis:resolver:rejecter:)
  func startAnalysis(
    options: NSDictionary?,
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    if isRunning {
      resolve(nil)
      return
    }

    // TODO:
    // 1) Validate playback is active (player node/output has signal)
    // 2) Install AVAudioEngine tap or attach to playback bus
    // 3) Pull PCM frames, run FFT (vDSP)
    // 4) Compute:
    //    bass: 20-250Hz
    //    mid: 250-2000Hz
    //    high: 2000-10000Hz
    //    rmsEnergy
    //    beatDetected (energy flux / adaptive threshold)
    // 5) Emit "AudioBandsUpdate"

    // Stub emitter to keep JS contract alive during integration
    isRunning = true
    timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
      guard let self = self, self.isRunning else { return }
      self.sendEvent(withName: "AudioBandsUpdate", body: [
        "bass": 0.0,
        "mid": 0.0,
        "high": 0.0,
        "rmsEnergy": 0.0,
        "beatDetected": false,
        "timestampMs": Int(Date().timeIntervalSince1970 * 1000)
      ])
    }

    resolve(nil)
  }

  @objc(stopAnalysis:rejecter:)
  func stopAnalysis(
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    isRunning = false
    timer?.invalidate()
    timer = nil

    // TODO: remove tap / release audio resources
    resolve(nil)
  }
}
