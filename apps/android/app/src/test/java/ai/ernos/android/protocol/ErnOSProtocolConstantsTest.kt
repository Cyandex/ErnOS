package ai.ernos.android.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class ErnOSProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", ErnOSCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", ErnOSCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", ErnOSCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", ErnOSCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", ErnOSCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", ErnOSCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", ErnOSCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", ErnOSCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", ErnOSCapability.Canvas.rawValue)
    assertEquals("camera", ErnOSCapability.Camera.rawValue)
    assertEquals("screen", ErnOSCapability.Screen.rawValue)
    assertEquals("voiceWake", ErnOSCapability.VoiceWake.rawValue)
    assertEquals("location", ErnOSCapability.Location.rawValue)
    assertEquals("sms", ErnOSCapability.Sms.rawValue)
    assertEquals("device", ErnOSCapability.Device.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", ErnOSCameraCommand.List.rawValue)
    assertEquals("camera.snap", ErnOSCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", ErnOSCameraCommand.Clip.rawValue)
  }

  @Test
  fun screenCommandsUseStableStrings() {
    assertEquals("screen.record", ErnOSScreenCommand.Record.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", ErnOSNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", ErnOSNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", ErnOSDeviceCommand.Status.rawValue)
    assertEquals("device.info", ErnOSDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", ErnOSDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", ErnOSDeviceCommand.Health.rawValue)
  }
}
