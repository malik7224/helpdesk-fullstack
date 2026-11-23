import XCTest
@testable import Helpdesk

/// Answers every request from memory so the tests never touch the network.
final class StubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: (@Sendable (URLRequest) -> (Int, Data))?
    nonisolated(unsafe) static var lastRequest: URLRequest?
    nonisolated(unsafe) static var lastBody: Data?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.lastRequest = request
        Self.lastBody = request.httpBody ?? request.httpBodyStream.flatMap { stream in
            stream.open()
            defer { stream.close() }
            var data = Data()
            var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                data.append(buffer, count: count)
            }
            return data
        }
        let (status, body) = Self.handler?(request) ?? (500, Data())
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

final class APIClientTests: XCTestCase {
    private func makeClient(token: String? = nil) -> APIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubProtocol.self]
        return APIClient(baseURL: URL(string: "http://localhost:4000")!, token: token, session: URLSession(configuration: config))
    }

    private func respond(_ status: Int, _ json: String) {
        StubProtocol.handler = { _ in (status, Data(json.utf8)) }
    }

    private let ticketJSON = """
    {"id":7,"title":"Printer is on fire","description":"Again","status":"in_progress","priority":"high",
     "createdBy":1,"createdByName":"Admin","assigneeId":null,"assigneeName":null,
     "createdAt":"2026-11-23T10:15:30.123Z","updatedAt":"2026-11-23T10:15:30Z"}
    """

    override func tearDown() {
        StubProtocol.handler = nil
        StubProtocol.lastRequest = nil
        StubProtocol.lastBody = nil
    }

    func testLoginSendsJSONAndDecodesTokenAndUser() async throws {
        respond(200, #"{"token":"abc","user":{"id":2,"email":"a@demo.test","name":"Agent","role":"agent"}}"#)
        let result = try await makeClient().login(email: "a@demo.test", password: "secret-pass")

        XCTAssertEqual(result.token, "abc")
        XCTAssertEqual(result.user.role, .agent)
        let request = try XCTUnwrap(StubProtocol.lastRequest)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/auth/login")
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
        let body = try JSONSerialization.jsonObject(with: try XCTUnwrap(StubProtocol.lastBody)) as? [String: String]
        XCTAssertEqual(body, ["email": "a@demo.test", "password": "secret-pass"])
    }

    func testSendsTheTokenAsABearerHeader() async throws {
        respond(200, #"{"user":{"id":2,"email":"a@demo.test","name":"Agent","role":"agent"}}"#)
        _ = try await makeClient(token: "tok").me()
        XCTAssertEqual(StubProtocol.lastRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer tok")
    }

    func testTicketListQuerySkipsEmptyFilters() async throws {
        respond(200, #"{"data":[],"page":1,"pageSize":20,"total":0,"totalPages":1}"#)
        _ = try await makeClient().listTickets(TicketFilters(query: "  ", status: nil, page: 2, pageSize: 20))
        let items = URLComponents(url: try XCTUnwrap(StubProtocol.lastRequest?.url), resolvingAgainstBaseURL: false)?.queryItems
        XCTAssertEqual(Dictionary(uniqueKeysWithValues: (items ?? []).map { ($0.name, $0.value ?? "") }),
                       ["page": "2", "pageSize": "20"])

        _ = try await makeClient().listTickets(TicketFilters(query: "login", status: .inProgress))
        let query = StubProtocol.lastRequest?.url?.query ?? ""
        XCTAssertTrue(query.contains("q=login"))
        XCTAssertTrue(query.contains("status=in_progress"))
    }

    func testDecodesTicketsWithAndWithoutFractionalSeconds() async throws {
        respond(200, #"{"ticket":"# + ticketJSON + "}")
        let ticket = try await makeClient().ticket(id: 7)
        XCTAssertEqual(ticket.status, .inProgress)
        XCTAssertEqual(ticket.priority, .high)
        XCTAssertNil(ticket.assigneeId)
        XCTAssertLessThan(ticket.createdAt, ticket.updatedAt.addingTimeInterval(1))
    }

    func testUnauthorizedBecomesItsOwnError() async {
        respond(401, #"{"error":"Invalid or expired token"}"#)
        do {
            _ = try await makeClient(token: "old").me()
            XCTFail("Expected an error")
        } catch {
            XCTAssertEqual(error as? APIError, .unauthorized("Invalid or expired token"))
        }
    }

    func testValidationIssuesAreJoinedIntoOneMessage() async {
        respond(400, #"{"error":"Validation failed","issues":[{"path":"title","message":"Too short"}]}"#)
        do {
            _ = try await makeClient().createTicket(NewTicket(title: "ab", description: "", priority: .low))
            XCTFail("Expected an error")
        } catch {
            XCTAssertEqual(error as? APIError, .server(status: 400, message: "title: Too short"))
        }
    }

    func testUnreadableResponseIsReported() async {
        respond(200, "not json")
        do {
            _ = try await makeClient().ticket(id: 1)
            XCTFail("Expected an error")
        } catch {
            XCTAssertEqual(error as? APIError, .invalidResponse)
        }
    }

    func testAddCommentPostsTheBody() async throws {
        respond(201, #"{"comment":{"id":3,"ticketId":7,"body":"On it","authorId":2,"authorName":"Agent","createdAt":"2026-11-23T10:15:30.000Z"}}"#)
        let comment = try await makeClient(token: "t").addComment(ticketId: 7, body: "On it")
        XCTAssertEqual(comment.body, "On it")
        XCTAssertEqual(StubProtocol.lastRequest?.url?.path, "/tickets/7/comments")
        let body = try JSONSerialization.jsonObject(with: try XCTUnwrap(StubProtocol.lastBody)) as? [String: String]
        XCTAssertEqual(body, ["body": "On it"])
    }

    func testPatchOnlySendsChangedFieldsAndCanClearTheAssignee() throws {
        func json(_ patch: TicketPatch) throws -> [String: Any] {
            try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(patch)) as? [String: Any])
        }
        XCTAssertEqual(try json(TicketPatch(status: .resolved)) as NSDictionary, ["status": "resolved"])
        let cleared = try json(TicketPatch(assignee: .clear))
        XCTAssertEqual(cleared.keys.sorted(), ["assigneeId"])
        XCTAssertTrue(cleared["assigneeId"] is NSNull)
        XCTAssertEqual(try json(TicketPatch(assignee: .assign(4))) as NSDictionary, ["assigneeId": 4])
    }
}
