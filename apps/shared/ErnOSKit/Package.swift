// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "ErnOSKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "ErnOSProtocol", targets: ["ErnOSProtocol"]),
        .library(name: "ErnOSKit", targets: ["ErnOSKit"]),
        .library(name: "ErnOSChatUI", targets: ["ErnOSChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.0"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "ErnOSProtocol",
            path: "Sources/ErnOSProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "ErnOSKit",
            dependencies: [
                "ErnOSProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/ErnOSKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "ErnOSChatUI",
            dependencies: [
                "ErnOSKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/ErnOSChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "ErnOSKitTests",
            dependencies: ["ErnOSKit", "ErnOSChatUI"],
            path: "Tests/ErnOSKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
