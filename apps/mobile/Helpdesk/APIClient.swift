import Foundation

enum APIError: LocalizedError, Equatable {
    case unauthorized(String)
    case server(status: Int, message: String)
    case network
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .unauthorized(let message): message
        case .server(_, let message): message
        case .network: "Cannot reach the server. Is the API running?"
        case .invalidResponse: "The server sent a response the app could not read."
        }
    }
}

/// Talks to the Helpdesk REST API. It sends the token as a Bearer header, so the app never
/// depends on the web app's cookie.
struct APIClient: Sendable {
    var baseURL: URL
    var token: String?
    var session: URLSession = APIClient.makeSession()

    static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.httpCookieStorage = nil
        config.timeoutIntervalForRequest = 15
        return URLSession(configuration: config)
    }

    static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let text = try container.decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: text) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: text) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unreadable date: \(text)")
        }
        return decoder
    }

    // MARK: Endpoints

    struct LoginResponse: Decodable, Sendable {
        let token: String
        let user: User
    }

    func login(email: String, password: String) async throws -> LoginResponse {
        try await decode(.post, "/auth/login", body: ["email": email, "password": password])
    }

    func me() async throws -> User {
        struct Body: Decodable { let user: User }
        return try await (decode(.get, "/auth/me") as Body).user
    }

    func listUsers() async throws -> [User] {
        struct Body: Decodable { let data: [User] }
        return try await (decode(.get, "/users") as Body).data
    }

    func listTickets(_ filters: TicketFilters) async throws -> Paged<Ticket> {
        var items = [
            URLQueryItem(name: "page", value: String(filters.page)),
            URLQueryItem(name: "pageSize", value: String(filters.pageSize)),
        ]
        let trimmed = filters.query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { items.append(URLQueryItem(name: "q", value: trimmed)) }
        if let status = filters.status { items.append(URLQueryItem(name: "status", value: status.rawValue)) }
        return try await decode(.get, "/tickets", query: items)
    }

    func ticket(id: Int) async throws -> Ticket {
        struct Body: Decodable { let ticket: Ticket }
        return try await (decode(.get, "/tickets/\(id)") as Body).ticket
    }

    func createTicket(_ input: NewTicket) async throws -> Ticket {
        struct Body: Decodable { let ticket: Ticket }
        return try await (decode(.post, "/tickets", body: input) as Body).ticket
    }

    func updateTicket(id: Int, _ patch: TicketPatch) async throws -> Ticket {
        struct Body: Decodable { let ticket: Ticket }
        return try await (decode(.patch, "/tickets/\(id)", body: patch) as Body).ticket
    }

    func comments(ticketId: Int) async throws -> [Comment] {
        struct Body: Decodable { let comments: [Comment] }
        return try await (decode(.get, "/tickets/\(ticketId)/comments") as Body).comments
    }

    func addComment(ticketId: Int, body: String) async throws -> Comment {
        struct Body: Decodable { let comment: Comment }
        return try await (decode(.post, "/tickets/\(ticketId)/comments", body: ["body": body]) as Body).comment
    }

    // MARK: Plumbing

    enum Method: String { case get = "GET", post = "POST", patch = "PATCH" }

    private func decode<T: Decodable>(
        _ method: Method,
        _ path: String,
        query: [URLQueryItem] = [],
        body: (any Encodable)? = nil
    ) async throws -> T {
        let data = try await send(method, path, query: query, body: body)
        do {
            return try Self.makeDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.invalidResponse
        }
    }

    private func send(
        _ method: Method,
        _ path: String,
        query: [URLQueryItem],
        body: (any Encodable)?
    ) async throws -> Data {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw APIError.invalidResponse
        }
        components.path = path
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else { throw APIError.invalidResponse }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch {
            throw APIError.network
        }

        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if (200..<300).contains(http.statusCode) { return data }

        let message = Self.errorMessage(from: data) ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
        if http.statusCode == 401 { throw APIError.unauthorized(message) }
        throw APIError.server(status: http.statusCode, message: message)
    }

    private static func errorMessage(from data: Data) -> String? {
        struct Body: Decodable {
            struct Issue: Decodable { let path: String; let message: String }
            let error: String?
            let issues: [Issue]?
        }
        guard let body = try? JSONDecoder().decode(Body.self, from: data) else { return nil }
        if let issues = body.issues, !issues.isEmpty {
            return issues.map { "\($0.path): \($0.message)" }.joined(separator: ". ")
        }
        return body.error
    }
}
