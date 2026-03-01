package ai.ernos.android.node

import ai.ernos.android.protocol.ErnOSCameraCommand
import ai.ernos.android.protocol.ErnOSDeviceCommand
import ai.ernos.android.protocol.ErnOSLocationCommand
import ai.ernos.android.protocol.ErnOSNotificationsCommand
import ai.ernos.android.protocol.ErnOSSmsCommand
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  @Test
  fun advertisedCommands_respectsFeatureAvailability() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        cameraEnabled = false,
        locationEnabled = false,
        smsAvailable = false,
        debugBuild = false,
      )

    assertFalse(commands.contains(ErnOSCameraCommand.Snap.rawValue))
    assertFalse(commands.contains(ErnOSCameraCommand.Clip.rawValue))
    assertFalse(commands.contains(ErnOSCameraCommand.List.rawValue))
    assertFalse(commands.contains(ErnOSLocationCommand.Get.rawValue))
    assertTrue(commands.contains(ErnOSDeviceCommand.Status.rawValue))
    assertTrue(commands.contains(ErnOSDeviceCommand.Info.rawValue))
    assertTrue(commands.contains(ErnOSDeviceCommand.Permissions.rawValue))
    assertTrue(commands.contains(ErnOSDeviceCommand.Health.rawValue))
    assertTrue(commands.contains(ErnOSNotificationsCommand.List.rawValue))
    assertTrue(commands.contains(ErnOSNotificationsCommand.Actions.rawValue))
    assertFalse(commands.contains(ErnOSSmsCommand.Send.rawValue))
    assertFalse(commands.contains("debug.logs"))
    assertFalse(commands.contains("debug.ed25519"))
    assertTrue(commands.contains("app.update"))
  }

  @Test
  fun advertisedCommands_includesFeatureCommandsWhenEnabled() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        cameraEnabled = true,
        locationEnabled = true,
        smsAvailable = true,
        debugBuild = true,
      )

    assertTrue(commands.contains(ErnOSCameraCommand.Snap.rawValue))
    assertTrue(commands.contains(ErnOSCameraCommand.Clip.rawValue))
    assertTrue(commands.contains(ErnOSCameraCommand.List.rawValue))
    assertTrue(commands.contains(ErnOSLocationCommand.Get.rawValue))
    assertTrue(commands.contains(ErnOSDeviceCommand.Status.rawValue))
    assertTrue(commands.contains(ErnOSDeviceCommand.Info.rawValue))
    assertTrue(commands.contains(ErnOSDeviceCommand.Permissions.rawValue))
    assertTrue(commands.contains(ErnOSDeviceCommand.Health.rawValue))
    assertTrue(commands.contains(ErnOSNotificationsCommand.List.rawValue))
    assertTrue(commands.contains(ErnOSNotificationsCommand.Actions.rawValue))
    assertTrue(commands.contains(ErnOSSmsCommand.Send.rawValue))
    assertTrue(commands.contains("debug.logs"))
    assertTrue(commands.contains("debug.ed25519"))
    assertTrue(commands.contains("app.update"))
  }
}
