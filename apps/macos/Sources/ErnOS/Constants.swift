import Foundation

// Stable identifier used for both the macOS LaunchAgent label and Nix-managed defaults suite.
// nix-ernos writes app defaults into this suite to survive app bundle identifier churn.
let launchdLabel = "ai.ernos.mac"
let gatewayLaunchdLabel = "ai.ernos.gateway"
let onboardingVersionKey = "ernos.onboardingVersion"
let onboardingSeenKey = "ernos.onboardingSeen"
let currentOnboardingVersion = 7
let pauseDefaultsKey = "ernos.pauseEnabled"
let iconAnimationsEnabledKey = "ernos.iconAnimationsEnabled"
let swabbleEnabledKey = "ernos.swabbleEnabled"
let swabbleTriggersKey = "ernos.swabbleTriggers"
let voiceWakeTriggerChimeKey = "ernos.voiceWakeTriggerChime"
let voiceWakeSendChimeKey = "ernos.voiceWakeSendChime"
let showDockIconKey = "ernos.showDockIcon"
let defaultVoiceWakeTriggers = ["ernos"]
let voiceWakeMaxWords = 32
let voiceWakeMaxWordLength = 64
let voiceWakeMicKey = "ernos.voiceWakeMicID"
let voiceWakeMicNameKey = "ernos.voiceWakeMicName"
let voiceWakeLocaleKey = "ernos.voiceWakeLocaleID"
let voiceWakeAdditionalLocalesKey = "ernos.voiceWakeAdditionalLocaleIDs"
let voicePushToTalkEnabledKey = "ernos.voicePushToTalkEnabled"
let talkEnabledKey = "ernos.talkEnabled"
let iconOverrideKey = "ernos.iconOverride"
let connectionModeKey = "ernos.connectionMode"
let remoteTargetKey = "ernos.remoteTarget"
let remoteIdentityKey = "ernos.remoteIdentity"
let remoteProjectRootKey = "ernos.remoteProjectRoot"
let remoteCliPathKey = "ernos.remoteCliPath"
let canvasEnabledKey = "ernos.canvasEnabled"
let cameraEnabledKey = "ernos.cameraEnabled"
let systemRunPolicyKey = "ernos.systemRunPolicy"
let systemRunAllowlistKey = "ernos.systemRunAllowlist"
let systemRunEnabledKey = "ernos.systemRunEnabled"
let locationModeKey = "ernos.locationMode"
let locationPreciseKey = "ernos.locationPreciseEnabled"
let peekabooBridgeEnabledKey = "ernos.peekabooBridgeEnabled"
let deepLinkKeyKey = "ernos.deepLinkKey"
let modelCatalogPathKey = "ernos.modelCatalogPath"
let modelCatalogReloadKey = "ernos.modelCatalogReload"
let cliInstallPromptedVersionKey = "ernos.cliInstallPromptedVersion"
let heartbeatsEnabledKey = "ernos.heartbeatsEnabled"
let debugPaneEnabledKey = "ernos.debugPaneEnabled"
let debugFileLogEnabledKey = "ernos.debug.fileLogEnabled"
let appLogLevelKey = "ernos.debug.appLogLevel"
let voiceWakeSupported: Bool = ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26
