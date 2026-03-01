import CoreLocation
import Foundation
import ErnOSKit
import UIKit

typealias ErnOSCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias ErnOSCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: ErnOSCameraSnapParams) async throws -> ErnOSCameraSnapResult
    func clip(params: ErnOSCameraClipParams) async throws -> ErnOSCameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: ErnOSLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: ErnOSLocationGetParams,
        desiredAccuracy: ErnOSLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: ErnOSLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

protocol DeviceStatusServicing: Sendable {
    func status() async throws -> ErnOSDeviceStatusPayload
    func info() -> ErnOSDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: ErnOSPhotosLatestParams) async throws -> ErnOSPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: ErnOSContactsSearchParams) async throws -> ErnOSContactsSearchPayload
    func add(params: ErnOSContactsAddParams) async throws -> ErnOSContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: ErnOSCalendarEventsParams) async throws -> ErnOSCalendarEventsPayload
    func add(params: ErnOSCalendarAddParams) async throws -> ErnOSCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: ErnOSRemindersListParams) async throws -> ErnOSRemindersListPayload
    func add(params: ErnOSRemindersAddParams) async throws -> ErnOSRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: ErnOSMotionActivityParams) async throws -> ErnOSMotionActivityPayload
    func pedometer(params: ErnOSPedometerParams) async throws -> ErnOSPedometerPayload
}

struct WatchMessagingStatus: Sendable, Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Sendable, Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Sendable, Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: ErnOSWatchNotifyParams) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
