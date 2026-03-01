package ai.ernos.android.ui

import androidx.compose.runtime.Composable
import ai.ernos.android.MainViewModel
import ai.ernos.android.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
