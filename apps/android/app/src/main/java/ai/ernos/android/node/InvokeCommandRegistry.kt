package ai.ernos.android.node

import ai.ernos.android.protocol.ErnOSCanvasA2UICommand
import ai.ernos.android.protocol.ErnOSCanvasCommand
import ai.ernos.android.protocol.ErnOSCameraCommand
import ai.ernos.android.protocol.ErnOSDeviceCommand
import ai.ernos.android.protocol.ErnOSLocationCommand
import ai.ernos.android.protocol.ErnOSNotificationsCommand
import ai.ernos.android.protocol.ErnOSScreenCommand
import ai.ernos.android.protocol.ErnOSSmsCommand

enum class InvokeCommandAvailability {
  Always,
  CameraEnabled,
  LocationEnabled,
  SmsAvailable,
  DebugBuild,
}

data class InvokeCommandSpec(
  val name: String,
  val requiresForeground: Boolean = false,
  val availability: InvokeCommandAvailability = InvokeCommandAvailability.Always,
)

object InvokeCommandRegistry {
  val all: List<InvokeCommandSpec> =
    listOf(
      InvokeCommandSpec(
        name = ErnOSCanvasCommand.Present.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ErnOSCanvasCommand.Hide.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ErnOSCanvasCommand.Navigate.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ErnOSCanvasCommand.Eval.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ErnOSCanvasCommand.Snapshot.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ErnOSCanvasA2UICommand.Push.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ErnOSCanvasA2UICommand.PushJSONL.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ErnOSCanvasA2UICommand.Reset.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ErnOSScreenCommand.Record.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ErnOSCameraCommand.List.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = ErnOSCameraCommand.Snap.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = ErnOSCameraCommand.Clip.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = ErnOSLocationCommand.Get.rawValue,
        availability = InvokeCommandAvailability.LocationEnabled,
      ),
      InvokeCommandSpec(
        name = ErnOSDeviceCommand.Status.rawValue,
      ),
      InvokeCommandSpec(
        name = ErnOSDeviceCommand.Info.rawValue,
      ),
      InvokeCommandSpec(
        name = ErnOSDeviceCommand.Permissions.rawValue,
      ),
      InvokeCommandSpec(
        name = ErnOSDeviceCommand.Health.rawValue,
      ),
      InvokeCommandSpec(
        name = ErnOSNotificationsCommand.List.rawValue,
      ),
      InvokeCommandSpec(
        name = ErnOSNotificationsCommand.Actions.rawValue,
      ),
      InvokeCommandSpec(
        name = ErnOSSmsCommand.Send.rawValue,
        availability = InvokeCommandAvailability.SmsAvailable,
      ),
      InvokeCommandSpec(
        name = "debug.logs",
        availability = InvokeCommandAvailability.DebugBuild,
      ),
      InvokeCommandSpec(
        name = "debug.ed25519",
        availability = InvokeCommandAvailability.DebugBuild,
      ),
      InvokeCommandSpec(name = "app.update"),
    )

  private val byNameInternal: Map<String, InvokeCommandSpec> = all.associateBy { it.name }

  fun find(command: String): InvokeCommandSpec? = byNameInternal[command]

  fun advertisedCommands(
    cameraEnabled: Boolean,
    locationEnabled: Boolean,
    smsAvailable: Boolean,
    debugBuild: Boolean,
  ): List<String> {
    return all
      .filter { spec ->
        when (spec.availability) {
          InvokeCommandAvailability.Always -> true
          InvokeCommandAvailability.CameraEnabled -> cameraEnabled
          InvokeCommandAvailability.LocationEnabled -> locationEnabled
          InvokeCommandAvailability.SmsAvailable -> smsAvailable
          InvokeCommandAvailability.DebugBuild -> debugBuild
        }
      }
      .map { it.name }
  }
}
