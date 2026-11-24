package dev.malik7224.helpdesk.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.malik7224.helpdesk.data.Priority
import dev.malik7224.helpdesk.data.Status
import dev.malik7224.helpdesk.data.TicketPatch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TicketDetailScreen(vm: TicketDetailViewModel, id: Int, onBack: () -> Unit) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    val ticket = ui.ticket

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ticket #$id") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                },
            )
        },
        bottomBar = {
            if (ticket != null) Composer(ui.draft, ui.posting, vm::setDraft, vm::post)
        },
    ) { padding ->
        if (ticket == null) {
            Box(Modifier.padding(padding).fillMaxSize(), Alignment.Center) {
                if (ui.error != null) ErrorText(ui.error, Modifier.padding(24.dp)) else CircularProgressIndicator()
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier.padding(padding).fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(16.dp),
        ) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(ticket.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            StatusBadge(ticket.status)
                            PriorityBadge(ticket.priority)
                        }
                        Text(
                            ticket.description.ifBlank { "No description." },
                            color = if (ticket.description.isBlank()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            "Opened by ${ticket.createdByName} · ${ticket.createdAt.formatted()}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Manage", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Selector(
                        label = "Status",
                        value = ticket.status.label,
                        options = Status.entries,
                        optionLabel = { it.label },
                        enabled = !ui.saving,
                        onSelect = { vm.update(TicketPatch(status = it)) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Selector(
                        label = "Priority",
                        value = ticket.priority.label,
                        options = Priority.entries,
                        optionLabel = { it.label },
                        enabled = !ui.saving,
                        onSelect = { vm.update(TicketPatch(priority = it)) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Selector(
                        label = "Assignee",
                        value = ticket.assigneeName ?: "Unassigned",
                        options = listOf<Int?>(null) + ui.users.map { it.id },
                        optionLabel = { id -> ui.users.firstOrNull { it.id == id }?.name ?: "Unassigned" },
                        enabled = !ui.saving,
                        onSelect = { userId ->
                            vm.update(
                                TicketPatch(assignee = userId?.let { TicketPatch.AssigneeChange.Assign(it) } ?: TicketPatch.AssigneeChange.Clear),
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }

            item { ErrorText(ui.error) }

            item {
                Text(
                    "Comments (${ui.comments.size})",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (ui.comments.isEmpty()) {
                item { Text("No comments yet.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            items(ui.comments, key = { it.id }) { comment ->
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            "${comment.authorName} · ${comment.createdAt.formatted()}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(comment.body)
                    }
                }
            }
        }
    }
}

@Composable
private fun Composer(draft: String, posting: Boolean, onChange: (String) -> Unit, onSend: () -> Unit) {
    val focus = LocalFocusManager.current
    Surface(color = MaterialTheme.colorScheme.surfaceContainerHigh, modifier = Modifier.navigationBarsPadding().imePadding()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedTextField(
                value = draft,
                onValueChange = onChange,
                placeholder = { Text("Add a comment") },
                maxLines = 4,
                modifier = Modifier.weight(1f).testTag("composer"),
            )
            IconButton(
                onClick = {
                    focus.clearFocus() // Closes the keyboard so the new comment is visible.
                    onSend()
                },
                enabled = draft.isNotBlank() && !posting,
                modifier = Modifier.testTag("send"),
            ) {
                if (posting) CircularProgressIndicator(Modifier.padding(4.dp), strokeWidth = 2.dp)
                else Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Post comment", tint = MaterialTheme.colorScheme.primary)
            }
        }
    }
}
