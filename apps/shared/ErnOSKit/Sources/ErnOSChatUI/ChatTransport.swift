import Foundation

public enum ErnOSChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(ErnOSChatEventPayload)
    case agent(ErnOSAgentEventPayload)
    case seqGap
}

public protocol ErnOSChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> ErnOSChatHistoryPayload
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [ErnOSChatAttachmentPayload]) async throws -> ErnOSChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> ErnOSChatSessionsListResponse

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<ErnOSChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
}

extension ErnOSChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "ErnOSChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> ErnOSChatSessionsListResponse {
        throw NSError(
            domain: "ErnOSChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }
}
