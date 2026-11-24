package dev.malik7224.helpdesk

import dev.malik7224.helpdesk.data.ApiClient
import dev.malik7224.helpdesk.data.ApiException
import dev.malik7224.helpdesk.data.NewTicket
import dev.malik7224.helpdesk.data.Priority
import dev.malik7224.helpdesk.data.Status
import dev.malik7224.helpdesk.data.TicketFilters
import dev.malik7224.helpdesk.data.TicketPatch
import java.time.Instant
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

class ApiClientTest {
    private lateinit var server: MockWebServer

    @Before fun start() {
        server = MockWebServer().also { it.start() }
    }

    @After fun stop() {
        server.shutdown()
    }

    private fun client(token: String? = null) = ApiClient(server.url("/").toString(), token)

    private fun reply(status: Int, body: String) {
        server.enqueue(MockResponse().setResponseCode(status).setHeader("Content-Type", "application/json").setBody(body))
    }

    private val ticketJson = """
        {"id":7,"title":"Printer is on fire","description":"Again","status":"in_progress","priority":"high",
         "createdBy":1,"createdByName":"Admin","assigneeId":null,"assigneeName":null,
         "createdAt":"2026-11-23T10:15:30.123Z","updatedAt":"2026-11-23T10:15:30Z"}
    """.trimIndent()

    @Test fun `login posts JSON and returns the token and user`() = runBlocking {
        reply(200, """{"token":"abc","user":{"id":2,"email":"a@demo.test","name":"Agent","role":"agent"}}""")
        val result = client().login("a@demo.test", "secret-pass")

        assertEquals("abc", result.token)
        assertEquals("Agent", result.user.name)
        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/auth/login", request.path)
        assertNull(request.getHeader("Authorization"))
        val body = JSONObject(request.body.readUtf8())
        assertEquals("a@demo.test", body.getString("email"))
        assertEquals("secret-pass", body.getString("password"))
    }

    @Test fun `sends the token as a Bearer header`() = runBlocking {
        reply(200, """{"user":{"id":2,"email":"a@demo.test","name":"Agent","role":"agent"}}""")
        client(token = "tok").me()
        assertEquals("Bearer tok", server.takeRequest().getHeader("Authorization"))
    }

    @Test fun `ticket list query skips empty filters`() = runBlocking {
        reply(200, """{"data":[],"page":2,"pageSize":20,"total":0,"totalPages":3}""")
        val page = client().tickets(TicketFilters(query = "  ", status = null, page = 2))
        assertEquals(3, page.totalPages)
        val url = server.takeRequest().requestUrl!!
        assertEquals(setOf("page", "pageSize"), url.queryParameterNames)
        assertEquals("2", url.queryParameter("page"))

        reply(200, """{"data":[],"page":1,"pageSize":20,"total":0,"totalPages":1}""")
        client().tickets(TicketFilters(query = "login", status = Status.InProgress))
        val second = server.takeRequest().requestUrl!!
        assertEquals("login", second.queryParameter("q"))
        assertEquals("in_progress", second.queryParameter("status"))
    }

    @Test fun `reads dates with and without fractional seconds`() = runBlocking {
        reply(200, """{"ticket":$ticketJson}""")
        val ticket = client().ticket(7)
        assertEquals(Status.InProgress, ticket.status)
        assertEquals(Priority.High, ticket.priority)
        assertNull(ticket.assigneeId)
        assertNull(ticket.assigneeName)
        assertEquals(Instant.parse("2026-11-23T10:15:30.123Z"), ticket.createdAt)
        assertEquals(Instant.parse("2026-11-23T10:15:30Z"), ticket.updatedAt)
    }

    @Test fun `a 401 becomes an Unauthorized error`() {
        reply(401, """{"error":"Invalid or expired token"}""")
        val error = runCatching { runBlocking { client(token = "old").me() } }.exceptionOrNull() as ApiException
        assertEquals(ApiException.Kind.Unauthorized, error.kind)
        assertEquals("Invalid or expired token", error.message)
    }

    @Test fun `validation issues are joined into one message`() {
        reply(400, """{"error":"Validation failed","issues":[{"path":"title","message":"Too short"}]}""")
        val error = runCatching { runBlocking { client().createTicket(NewTicket("ab", "", Priority.Low)) } }.exceptionOrNull() as ApiException
        assertEquals(ApiException.Kind.Server, error.kind)
        assertEquals(400, error.status)
        assertEquals("title: Too short", error.message)
    }

    @Test fun `an unreadable response is reported`() {
        reply(200, "not json")
        val error = runCatching { runBlocking { client().ticket(1) } }.exceptionOrNull() as ApiException
        assertEquals(ApiException.Kind.Invalid, error.kind)
    }

    @Test fun `an unreachable server is reported as a network error`() {
        val api = client()
        server.shutdown()
        val error = runCatching { runBlocking { api.me() } }.exceptionOrNull() as ApiException
        assertEquals(ApiException.Kind.Network, error.kind)
        assertTrue(error.message!!.contains("Cannot reach the server"))
    }

    @Test fun `a bad server address is reported without crashing`() {
        val error = runCatching { runBlocking { ApiClient("not a url").me() } }.exceptionOrNull() as ApiException
        assertEquals(ApiException.Kind.Invalid, error.kind)
    }

    @Test fun `adding a comment posts the text`() = runBlocking {
        reply(201, """{"comment":{"id":3,"ticketId":7,"body":"On it","authorId":2,"authorName":"Agent","createdAt":"2026-11-23T10:15:30.000Z"}}""")
        val comment = client(token = "t").addComment(7, "On it")
        assertEquals("On it", comment.body)
        val request = server.takeRequest()
        assertEquals("/tickets/7/comments", request.path)
        assertEquals("On it", JSONObject(request.body.readUtf8()).getString("body"))
    }

    @Test fun `updating sends PATCH with only the changed field`() = runBlocking {
        reply(200, """{"ticket":$ticketJson}""")
        client(token = "t").updateTicket(7, TicketPatch(status = Status.Resolved))
        val request = server.takeRequest()
        assertEquals("PATCH", request.method)
        val body = JSONObject(request.body.readUtf8())
        assertEquals(listOf("status"), body.keys().asSequence().toList())
        assertEquals("resolved", body.getString("status"))
    }

    @Test fun `a patch can assign and clear the assignee`() {
        val assign = TicketPatch(assignee = TicketPatch.AssigneeChange.Assign(4)).toJson()
        assertEquals(4, assign.getInt("assigneeId"))

        val clear = TicketPatch(assignee = TicketPatch.AssigneeChange.Clear).toJson()
        assertTrue(clear.has("assigneeId"))
        assertTrue(clear.isNull("assigneeId"))

        assertEquals(0, TicketPatch().toJson().length())
    }

    @Test fun `unknown status values fail loudly instead of guessing`() {
        try {
            Status.fromWire("archived")
            fail("Expected an exception")
        } catch (_: NoSuchElementException) {
            // expected
        }
    }
}
