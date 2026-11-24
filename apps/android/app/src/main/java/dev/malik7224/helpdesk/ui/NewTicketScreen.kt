package dev.malik7224.helpdesk.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import dev.malik7224.helpdesk.data.NewTicket
import dev.malik7224.helpdesk.data.Priority

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewTicketScreen(vm: NewTicketViewModel, onBack: () -> Unit) {
    var title by remember { mutableStateOf("") }
    var details by remember { mutableStateOf("") }
    var priority by remember { mutableStateOf(Priority.Medium) }
    val valid = title.trim().length >= 3

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("New ticket") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                },
                actions = {
                    TextButton(
                        onClick = { vm.create(NewTicket(title.trim(), details.trim(), priority), onDone = onBack) },
                        enabled = valid && !vm.busy,
                        modifier = Modifier.testTag("create"),
                    ) { Text("Create") }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier.padding(padding).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Title") },
                placeholder = { Text("What is the problem?") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("title"),
            )
            OutlinedTextField(
                value = details,
                onValueChange = { details = it },
                label = { Text("Description (optional)") },
                minLines = 4,
                modifier = Modifier.fillMaxWidth(),
            )
            Text("Priority", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Priority.entries.forEach {
                    FilterChip(selected = priority == it, onClick = { priority = it }, label = { Text(it.label) })
                }
            }
            ErrorText(vm.error)
        }
    }
}
