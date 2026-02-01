import Foundation
import UnityFramework

@objc public class UnityBridge: NSObject {
    private static var instance: UnityBridge?
    private var unityFramework: UnityFramework?
    private var isInitialized = false
    
    public static var shared: UnityBridge {
        if instance == nil {
            instance = UnityBridge()
        }
        return instance!
    }
    
    private override init() {
        super.init()
    }
    
    public func initialize() {
        guard !isInitialized else { return }
        
        let bundlePath = Bundle.main.bundlePath
        let frameworkPath = bundlePath + "/Frameworks/UnityFramework.framework"
        
        guard let bundle = Bundle(path: frameworkPath) else {
            print("[UnityBridge] Failed to load Unity framework bundle")
            return
        }
        
        if !bundle.isLoaded {
            bundle.load()
        }
        
        guard let principalClass = bundle.principalClass as? UnityFramework.Type else {
            print("[UnityBridge] Failed to get UnityFramework class")
            return
        }
        
        unityFramework = principalClass.getInstance()
        
        if let framework = unityFramework {
            framework.setDataBundleId("com.unity3d.framework")
            framework.register(self)
            framework.runEmbedded(withArgc: CommandLine.argc, argv: CommandLine.unsafeArgv, appLaunchOpts: nil)
            isInitialized = true
        }
    }
    
    public func showUnity() {
        unityFramework?.showUnityWindow()
    }
    
    public func sendMessage(_ gameObject: String, method: String, message: String) {
        unityFramework?.sendMessageToGO(withName: gameObject, functionName: method, message: message)
    }
    
    public func sendTrackMessage(source: String, title: String, artist: String, artworkUrl: String?, durationMs: Int) {
        var dict: [String: Any] = [
            "type": "track",
            "source": source,
            "title": title,
            "artist": artist,
            "durationMs": durationMs
        ]
        
        if let artwork = artworkUrl {
            dict["artworkUrl"] = artwork
        }
        
        if let json = try? JSONSerialization.data(withJSONObject: dict),
           let jsonString = String(data: json, encoding: .utf8) {
            sendMessage("NativeBridge", method: "OnNativeMessage", message: jsonString)
        }
    }
    
    public func sendPlaybackMessage(isPlaying: Bool, positionMs: Int, volume: Float? = nil) {
        var dict: [String: Any] = [
            "type": "playback",
            "isPlaying": isPlaying,
            "positionMs": positionMs
        ]
        
        if let vol = volume {
            dict["volume"] = vol
        }
        
        if let json = try? JSONSerialization.data(withJSONObject: dict),
           let jsonString = String(data: json, encoding: .utf8) {
            sendMessage("NativeBridge", method: "OnNativeMessage", message: jsonString)
        }
    }
    
    public func sendBandsMessage(bass: Float, mid: Float, high: Float, sub: Float? = nil, kick: Float? = nil, energy: Float? = nil) {
        var dict: [String: Any] = [
            "type": "bands",
            "bass": bass,
            "mid": mid,
            "high": high
        ]
        
        if let s = sub { dict["sub"] = s }
        if let k = kick { dict["kick"] = k }
        if let e = energy { dict["energy"] = e }
        
        if let json = try? JSONSerialization.data(withJSONObject: dict),
           let jsonString = String(data: json, encoding: .utf8) {
            sendMessage("NativeBridge", method: "OnNativeMessage", message: jsonString)
        }
    }
    
    public func sendPresetMessage(presetName: String, intensity: Float? = nil, speed: Float? = nil, trailsOn: Bool? = nil, trailsAmount: Float? = nil) {
        var dict: [String: Any] = [
            "type": "preset",
            "presetName": presetName
        ]
        
        if let i = intensity { dict["intensity"] = i }
        if let s = speed { dict["speed"] = s }
        if let t = trailsOn { dict["trailsOn"] = t }
        if let ta = trailsAmount { dict["trailsAmount"] = ta }
        
        if let json = try? JSONSerialization.data(withJSONObject: dict),
           let jsonString = String(data: json, encoding: .utf8) {
            sendMessage("NativeBridge", method: "OnNativeMessage", message: jsonString)
        }
    }
}

extension UnityBridge: UnityFrameworkListener {
    public func unityDidUnload(_ notification: Notification!) {
        isInitialized = false
        unityFramework = nil
    }
}
