package ai.ernos.android.protocol

enum class ErnOSCapability(val rawValue: String) {
  Canvas("canvas"),
  Camera("camera"),
  Screen("screen"),
  Sms("sms"),
  VoiceWake("voiceWake"),
  Location("location"),
  Device("device"),
}

enum class ErnOSCanvasCommand(val rawValue: String) {
  Present("canvas.present"),
  Hide("canvas.hide"),
  Navigate("canvas.navigate"),
  Eval("canvas.eval"),
  Snapshot("canvas.snapshot"),
  ;

  companion object {
    const val NamespacePrefix: String = "canvas."
  }
}

enum class ErnOSCanvasA2UICommand(val rawValue: String) {
  Push("canvas.a2ui.push"),
  PushJSONL("canvas.a2ui.pushJSONL"),
  Reset("canvas.a2ui.reset"),
  ;

  companion object {
    const val NamespacePrefix: String = "canvas.a2ui."
  }
}

enum class ErnOSCameraCommand(val rawValue: String) {
  List("camera.list"),
  Snap("camera.snap"),
  Clip("camera.clip"),
  ;

  companion object {
    const val NamespacePrefix: String = "camera."
  }
}

enum class ErnOSScreenCommand(val rawValue: String) {
  Record("screen.record"),
  ;

  companion object {
    const val NamespacePrefix: String = "screen."
  }
}

enum class ErnOSSmsCommand(val rawValue: String) {
  Send("sms.send"),
  ;

  companion object {
    const val NamespacePrefix: String = "sms."
  }
}

enum class ErnOSLocationCommand(val rawValue: String) {
  Get("location.get"),
  ;

  companion object {
    const val NamespacePrefix: String = "location."
  }
}

enum class ErnOSDeviceCommand(val rawValue: String) {
  Status("device.status"),
  Info("device.info"),
  Permissions("device.permissions"),
  Health("device.health"),
  ;

  companion object {
    const val NamespacePrefix: String = "device."
  }
}

enum class ErnOSNotificationsCommand(val rawValue: String) {
  List("notifications.list"),
  Actions("notifications.actions"),
  ;

  companion object {
    const val NamespacePrefix: String = "notifications."
  }
}
