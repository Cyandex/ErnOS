import Foundation

public enum ErnOSCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum ErnOSCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum ErnOSCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum ErnOSCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct ErnOSCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: ErnOSCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: ErnOSCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: ErnOSCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: ErnOSCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct ErnOSCameraClipParams: Codable, Sendable, Equatable {
    public var facing: ErnOSCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: ErnOSCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: ErnOSCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: ErnOSCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
