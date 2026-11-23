import SwiftUI

@main
struct HelpdeskApp: App {
    @State private var auth = AuthStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
        }
    }
}

struct RootView: View {
    @Environment(AuthStore.self) private var auth

    var body: some View {
        switch auth.state {
        case .loading:
            ProgressView("Loading…")
                .task { await auth.restore() }
        case .signedOut:
            LoginView()
        case .signedIn:
            TicketListView()
        }
    }
}
