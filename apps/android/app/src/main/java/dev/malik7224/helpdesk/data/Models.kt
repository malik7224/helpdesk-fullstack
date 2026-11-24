package dev.malik7224.helpdesk.data

import java.time.Instant
import org.json.JSONArray
import org.json.JSONObject

enum class Status(val wire: String, val label: String) {
    Open("open", "Open"),
    InProgress("in_progress", "In progress"),
    Resolved("resolved", "Resolved"),
    Closed("closed", "Closed");

    companion object {
        fun fromWire(value: String): Status = entries.first { it.wire == value }
    }
}

enum class Priority(val wire: String, val label: String) {
    Low("low", "Low"),
    Medium("medium", "Medium"),
    High("high", "High");

    companion object {
        fun fromWire(value: String): Priority = entries.first { it.wire == value }
    }
}

data class User(val id: Int, val email: String, val name: String, val role: String)

data class Ticket(
    val id: Int,
    val title: String,
    val description: String,
    val status: Status,
    val priority: Priority,
    val createdBy: Int,
    val createdByName: String,
    val assigneeId: Int?,
    val assigneeName: String?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class Comment(
    val id: Int,
    val ticketId: Int,
    val body: String,
    val authorId: Int,
    val authorName: String,
    val createdAt: Instant,
)

data class Page<T>(val items: List<T>, val page: Int, val totalPages: Int, val total: Int)

data class TicketFilters(
    val query: String = "",
    val status: Status? = null,
    val page: Int = 1,
    val pageSize: Int = 20,
)

data class NewTicket(val title: String, val description: String, val priority: Priority)

/** A partial update. Fields left null are not sent. [assignee] can also clear the assignee. */
data class TicketPatch(
    val status: Status? = null,
    val priority: Priority? = null,
    val assignee: AssigneeChange? = null,
) {
    sealed interface AssigneeChange {
        data class Assign(val userId: Int) : AssigneeChange
        data object Clear : AssigneeChange
    }

    fun toJson(): JSONObject = JSONObject().apply {
        status?.let { put("status", it.wire) }
        priority?.let { put("priority", it.wire) }
        when (assignee) {
            is AssigneeChange.Assign -> put("assigneeId", assignee.userId)
            AssigneeChange.Clear -> put("assigneeId", JSONObject.NULL)
            null -> Unit
        }
    }
}

// JSON mapping. The API sends ISO-8601 dates, with or without fractional seconds.

private fun JSONObject.nullableInt(name: String): Int? = if (isNull(name)) null else getInt(name)
private fun JSONObject.nullableString(name: String): String? = if (isNull(name)) null else getString(name)

internal fun JSONObject.toUser() = User(getInt("id"), getString("email"), getString("name"), getString("role"))

internal fun JSONObject.toTicket() = Ticket(
    id = getInt("id"),
    title = getString("title"),
    description = getString("description"),
    status = Status.fromWire(getString("status")),
    priority = Priority.fromWire(getString("priority")),
    createdBy = getInt("createdBy"),
    createdByName = getString("createdByName"),
    assigneeId = nullableInt("assigneeId"),
    assigneeName = nullableString("assigneeName"),
    createdAt = Instant.parse(getString("createdAt")),
    updatedAt = Instant.parse(getString("updatedAt")),
)

internal fun JSONObject.toComment() = Comment(
    id = getInt("id"),
    ticketId = getInt("ticketId"),
    body = getString("body"),
    authorId = getInt("authorId"),
    authorName = getString("authorName"),
    createdAt = Instant.parse(getString("createdAt")),
)

internal fun <T> JSONArray.map(transform: (JSONObject) -> T): List<T> =
    List(length()) { transform(getJSONObject(it)) }
