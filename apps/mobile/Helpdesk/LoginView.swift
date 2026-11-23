import SwiftUI

struct LoginView: View {
    @Environment(AuthStore.self) private var auth
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false
    @State private var showServer = false
    @FocusState private var focus: Field?

    private enum Field { case email, password }

    var body: some View {
        @Bindable var auth = auth

        NavigationStack {
            Form {
                Section {
                    TextField("Email", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focus = .password }
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .focused($focus, equals: .password)
                        .submitLabel(.go)
                        .onSubmit { Task { await signIn() } }
                }

                if let error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.callout)
                            .accessibilityIdentifier("login-error")
                    }
                }

                Section {
                    Button {
                        Task { await signIn() }
                    } label: {
                        HStack {
                            Spacer()
                            if busy { ProgressView() } else { Text("Sign in").fontWeight(.semibold) }
                            Spacer()
                        }
                    }
                    .disabled(busy || email.isEmpty || password.isEmpty)
                }

                Section {
                    DisclosureGroup("Server", isExpanded: $showServer) {
                        TextField("http://localhost:4000", text: $auth.serverURL)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Text("On a real iPhone, use your computer's address on the same Wi-Fi, for example http://192.168.1.20:4000.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Helpdesk")
            .navigationBarTitleDisplayMode(.large)
        }
    }

    private func signIn() async {
        guard !busy, !email.isEmpty, !password.isEmpty else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await auth.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
        } catch {
            self.error = auth.message(for: error)
        }
    }
}
