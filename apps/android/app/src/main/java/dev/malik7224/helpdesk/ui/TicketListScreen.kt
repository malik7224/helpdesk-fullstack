package dev.malik7224.helpdesk.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.malik7224.helpdesk.data.Status
import dev.malik7224.helpdesk.data.Ticket
import dev.malik7224.helpdesk.data.User

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TicketListScreen(
    vm: TicketListViewModel,
    user: User,
    onOpen: (Int) -> Unit,
    onNew: () -> Unit,
    onSignOut: () -> Unit,
) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    var menu by remember { mutableStateOf(false) }

    // The list may have changed while another screen was open.
    LaunchedEffect(Unit) { vm.reload() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tickets", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { menu = true }, modifier = Modifier.testTag("account")) {
                        Icon(Icons.Default.MoreVert, contentDescription = "Account")
                    }
                    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                        Text(
                            "${user.name} · ${user.role}",
                            style = MaterialTheme.typography.labelLarge,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                        DropdownMenuItem(text = { Text("Sign out") }, onClick = { menu = false; onSignOut() })
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onNew, modifier = Modifier.testTag("new-ticket")) {
                Icon(Icons.Default.Add, contentDescription = "New ticket")
            }
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = ui.refreshing,
            onRefresh = { vm.reload(pulled = true) },
            modifier = Modifier.padding(padding).fillMaxSize(),
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize().testTag("ticket-list"),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            ) {
                item {
                    OutlinedTextField(
                        value = ui.query,
                        onValueChange = vm::setQuery,
                        placeholder = { Text("Search tickets") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("search"),
                    )
                }
                item {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        item { FilterChip(selected = ui.status == null, onClick = { vm.setStatus(null) }, label = { Text("All") }) }
                        items(Status.entries) { status ->
                            FilterChip(
                                selected = ui.status == status,
                                onClick = { vm.setStatus(status) },
                                label = { Text(status.label) },
                            )
                        }
                    }
                }
                item { ErrorText(ui.error) }
                items(ui.tickets, key = { it.id }) { ticket -> TicketRow(ticket) { onOpen(ticket.id) } }
                if (ui.tickets.isEmpty() && !ui.loading && ui.error == null) {
                    item {
                        Text(
                            "No tickets match. Try another search or filter.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 24.dp),
                        )
                    }
                }
                if (ui.canLoadMore) {
                    item { LaunchedEffect(ui.tickets.size) { vm.loadMore() } }
                }
            }
        }
    }
}

@Composable
private fun TicketRow(ticket: Ticket, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
        modifier = Modifier.fillMaxWidth().testTag("ticket-${ticket.id}"),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(ticket.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                StatusBadge(ticket.status)
                PriorityBadge(ticket.priority)
                Text(
                    ticket.updatedAt.relative(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                    textAlign = androidx.compose.ui.text.style.TextAlign.End,
                )
            }
            Text(
                ticket.assigneeName?.let { "Assigned to $it" } ?: "Unassigned",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
