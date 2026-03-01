import Foundation
import SwabbleKit
import Testing
@testable import ErnOS

@Suite struct VoiceWakeRuntimeTests {
    @Test func trimsAfterTriggerKeepsPostSpeech() {
        let triggers = ["claude", "ernos"]
        let text = "hey Claude how are you"
        #expect(VoiceWakeRuntime._testTrimmedAfterTrigger(text, triggers: triggers) == "how are you")
    }

    @Test func trimsAfterTriggerReturnsOriginalWhenNoTrigger() {
        let triggers = ["claude"]
        let text = "good morning friend"
        #expect(VoiceWakeRuntime._testTrimmedAfterTrigger(text, triggers: triggers) == text)
    }

    @Test func trimsAfterFirstMatchingTrigger() {
        let triggers = ["buddy", "claude"]
        let text = "hello buddy this is after trigger claude also here"
        #expect(VoiceWakeRuntime
            ._testTrimmedAfterTrigger(text, triggers: triggers) == "this is after trigger claude also here")
    }

    @Test func hasContentAfterTriggerFalseWhenOnlyTrigger() {
        let triggers = ["ernos"]
        let text = "hey ernos"
        #expect(!VoiceWakeRuntime._testHasContentAfterTrigger(text, triggers: triggers))
    }

    @Test func hasContentAfterTriggerTrueWhenSpeechContinues() {
        let triggers = ["claude"]
        let text = "claude write a note"
        #expect(VoiceWakeRuntime._testHasContentAfterTrigger(text, triggers: triggers))
    }

    @Test func trimsAfterChineseTriggerKeepsPostSpeech() {
        let triggers = ["小爪", "ernos"]
        let text = "嘿 小爪 帮我打开设置"
        #expect(VoiceWakeRuntime._testTrimmedAfterTrigger(text, triggers: triggers) == "帮我打开设置")
    }

    @Test func trimsAfterTriggerHandlesWidthInsensitiveForms() {
        let triggers = ["ernos"]
        let text = "ＯｐｅｎＣｌａｗ 请帮我"
        #expect(VoiceWakeRuntime._testTrimmedAfterTrigger(text, triggers: triggers) == "请帮我")
    }

    @Test func gateRequiresGapBetweenTriggerAndCommand() {
        let transcript = "hey ernos do thing"
        let segments = makeSegments(
            transcript: transcript,
            words: [
                ("hey", 0.0, 0.1),
                ("ernos", 0.2, 0.1),
                ("do", 0.35, 0.1),
                ("thing", 0.5, 0.1),
            ])
        let config = WakeWordGateConfig(triggers: ["ernos"], minPostTriggerGap: 0.3)
        #expect(WakeWordGate.match(transcript: transcript, segments: segments, config: config) == nil)
    }

    @Test func gateAcceptsGapAndExtractsCommand() {
        let transcript = "hey ernos do thing"
        let segments = makeSegments(
            transcript: transcript,
            words: [
                ("hey", 0.0, 0.1),
                ("ernos", 0.2, 0.1),
                ("do", 0.9, 0.1),
                ("thing", 1.1, 0.1),
            ])
        let config = WakeWordGateConfig(triggers: ["ernos"], minPostTriggerGap: 0.3)
        #expect(WakeWordGate.match(transcript: transcript, segments: segments, config: config)?.command == "do thing")
    }
}

private func makeSegments(
    transcript: String,
    words: [(String, TimeInterval, TimeInterval)])
-> [WakeWordSegment] {
    var searchStart = transcript.startIndex
    var output: [WakeWordSegment] = []
    for (word, start, duration) in words {
        let range = transcript.range(of: word, range: searchStart..<transcript.endIndex)
        output.append(WakeWordSegment(text: word, start: start, duration: duration, range: range))
        if let range { searchStart = range.upperBound }
    }
    return output
}
