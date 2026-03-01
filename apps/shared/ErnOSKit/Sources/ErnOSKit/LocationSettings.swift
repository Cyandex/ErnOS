import Foundation

public enum ErnOSLocationMode: String, Codable, Sendable, CaseIterable {
    case off
    case whileUsing
    case always
}
