package dev.malik7224.helpdesk.data

import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONException
import org.json.JSONObject

class ApiException(val kind: Kind, message: String, val status: Int = 0) : Exception(message) {
    enum class Kind { Unauthorized, Server, Network, Invalid }
}

data class LoginResult(val token: String, val user: User)

/**
 * Talks to the Helpdesk REST API. The token goes in a Bearer header, so the app never
 * depends on the web app's cookie.
 */
class ApiClient(
    baseUrl: String,
    private val token: String? = null,
    private val http: OkHttpClient = OkHttpClient(),
) {
    private val base = baseUrl.trim().trimEnd('/')

    suspend fun login(email: String, password: String): LoginResult {
        val body = JSONObject().put("email", email).put("password", password)
        val json = request("POST", "/auth/login", body = body)
        return LoginResult(json.getString("token"), json.getJSONObject("user").toUser())
    }

    suspend fun me(): User = request("GET", "/auth/me").getJSONObject("user").toUser()

    suspend fun users(): List<User> = request("GET", "/users").getJSONArray("data").map { it.toUser() }

    suspend fun tickets(filters: TicketFilters): Page<Ticket> {
        val query = buildList {
            add("page" to filters.page.toString())
            add("pageSize" to filters.pageSize.toString())
            if (filters.query.isNotBlank()) add("q" to filters.query.trim())
            filters.status?.let { add("status" to it.wire) }
        }
        val json = request("GET", "/tickets", query)
        return Page(
            items = json.getJSONArray("data").map { it.toTicket() },
            page = json.getInt("page"),
            totalPages = json.getInt("totalPages"),
            total = json.getInt("total"),
        )
    }

    suspend fun ticket(id: Int): Ticket = request("GET", "/tickets/$id").getJSONObject("ticket").toTicket()

    suspend fun createTicket(input: NewTicket): Ticket {
        val body = JSONObject()
            .put("title", input.title)
            .put("description", input.description)
            .put("priority", input.priority.wire)
        return request("POST", "/tickets", body = body).getJSONObject("ticket").toTicket()
    }

    suspend fun updateTicket(id: Int, patch: TicketPatch): Ticket =
        request("PATCH", "/tickets/$id", body = patch.toJson()).getJSONObject("ticket").toTicket()

    suspend fun comments(ticketId: Int): List<Comment> =
        request("GET", "/tickets/$ticketId/comments").getJSONArray("comments").map { it.toComment() }

    suspend fun addComment(ticketId: Int, text: String): Comment =
        request("POST", "/tickets/$ticketId/comments", body = JSONObject().put("body", text))
            .getJSONObject("comment")
            .toComment()

    // Plumbing

    /** Runs on a background thread: Android does not allow reading a network body on the UI thread. */
    private suspend fun request(
        method: String,
        path: String,
        query: List<Pair<String, String>> = emptyList(),
        body: JSONObject? = null,
    ): JSONObject = withContext(Dispatchers.IO) { send(method, path, query, body) }

    private suspend fun send(
        method: String,
        path: String,
        query: List<Pair<String, String>>,
        body: JSONObject?,
    ): JSONObject {
        val url = try {
            "$base$path".toHttpUrl().newBuilder().apply { query.forEach { (k, v) -> addQueryParameter(k, v) } }.build()
        } catch (_: IllegalArgumentException) {
            throw ApiException(ApiException.Kind.Invalid, "Enter a valid server address, like http://10.0.2.2:4000")
        }

        val requestBody = body?.toString()?.toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(url)
            .method(method, requestBody)
            .header("Accept", "application/json")
            .apply { token?.let { header("Authorization", "Bearer $it") } }
            .build()

        val response = try {
            http.newCall(request).await()
        } catch (_: IOException) {
            throw ApiException(ApiException.Kind.Network, "Cannot reach the server. Is the API running?")
        }

        response.use {
            val text = it.body?.string().orEmpty()
            if (it.isSuccessful) {
                return try {
                    JSONObject(text)
                } catch (_: JSONException) {
                    throw ApiException(ApiException.Kind.Invalid, "The server sent a response the app could not read.")
                }
            }
            val message = errorMessage(text) ?: it.message.ifBlank { "Request failed (${it.code})" }
            if (it.code == 401) throw ApiException(ApiException.Kind.Unauthorized, message, 401)
            throw ApiException(ApiException.Kind.Server, message, it.code)
        }
    }

    private fun errorMessage(text: String): String? = try {
        val json = JSONObject(text)
        val issues = json.optJSONArray("issues")
        if (issues != null && issues.length() > 0) {
            map(issues) { "${it.getString("path")}: ${it.getString("message")}" }.joinToString(". ")
        } else {
            json.optString("error").ifBlank { null }
        }
    } catch (_: JSONException) {
        null
    }

    private fun <T> map(array: org.json.JSONArray, transform: (JSONObject) -> T) = array.map(transform)
}

/** Runs the call without blocking a thread, and cancels it if the coroutine is cancelled. */
private suspend fun Call.await(): Response = suspendCancellableCoroutine { continuation ->
    continuation.invokeOnCancellation { cancel() }
    enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) {
            if (continuation.isActive) continuation.resumeWithException(e)
        }

        override fun onResponse(call: Call, response: Response) {
            continuation.resume(response)
        }
    })
}
