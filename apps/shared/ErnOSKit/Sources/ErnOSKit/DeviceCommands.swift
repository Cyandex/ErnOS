import Foundation

public enum ErnOSDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum ErnOSBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum ErnOSThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum ErnOSNetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum ErnOSNetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct ErnOSBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: ErnOSBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: ErnOSBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct ErnOSThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: ErnOSThermalState

    public init(state: ErnOSThermalState) {
        self.state = state
    }
}

public struct ErnOSStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct ErnOSNetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: ErnOSNetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [ErnOSNetworkInterfaceType]

    public init(
        status: ErnOSNetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [ErnOSNetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct ErnOSDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: ErnOSBatteryStatusPayload
    public var thermal: ErnOSThermalStatusPayload
    public var storage: ErnOSStorageStatusPayload
    public var network: ErnOSNetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: ErnOSBatteryStatusPayload,
        thermal: ErnOSThermalStatusPayload,
        storage: ErnOSStorageStatusPayload,
        network: ErnOSNetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct ErnOSDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}
