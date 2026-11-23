import Foundation
import Observation

@MainActor
@Observable
final class AuthStore {
    enum State: Equatable {
        case loading
        case signedOut
        case signedIn(User)
    }

    private(set) var state: State = .loading
    var serverURL: String {
        didSet { UserDefaults.standard.set(serverURL, forKey: Self.serverKey) }
    }

    private var token: String?
    private let tokenStore: TokenStore
    private static let serverKey = "helpdesk.serverURL"
    static let defaultServer = "http://localhost:4000"

    init(tokenStore: TokenStore = TokenStore()) {
        self.tokenStore = tokenStore
        self.serverURL = UserDefaults.standard.string(forKey: Self.serverKey) ?? Self.defaultServer
        self.token = tokenStore.load()
    }

    var user: User? {
        if case .signedIn(let user) = state { return user }
        return nil
    }

    /// A client for the current server and token.
    var api: APIClient {
        APIClient(baseURL: URL(string: serverURL) ?? URL(string: Self.defaultServer)!, token: token)
    }

    func restore() async {
        guard token != nil else {
            state = .signedOut
            return
        }
        do {
            state = .signedIn(try await api.me())
        } catch APIError.unauthorized {
            signOut()
        } catch {
            // The server may just be unreachable. Keep the token and ask the user to retry.
            state = .signedOut
        }
    }

    func signIn(email: String, password: String) async throws {
        guard let url = URL(string: serverURL.trimmingCharacters(in: .whitespaces)), url.scheme != nil, url.host != nil else {
            throw APIError.server(status: 0, message: "Enter a valid server address, like http://localhost:4000")
        }
        serverURL = url.absoluteString
        let response = try await APIClient(baseURL: url).login(email: email, password: password)
        token = response.token
        tokenStore.save(response.token)
        state = .signedIn(response.user)
    }

    func signOut() {
        token = nil
        tokenStore.delete()
        state = .signedOut
    }

    /// Turns an error into text for the screen. Signs out on an expired session.
    /// Returns nil for cancelled work, which is not worth showing.
    func message(for error: Error) -> String? {
        if error is CancellationError { return nil }
        if case APIError.unauthorized = error {
            signOut()
            return nil
        }
        return error.localizedDescription
    }
}
