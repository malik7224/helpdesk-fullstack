import SwiftUI

@MainActor
@Observable
final class TicketDetailModel {
    let id: Int
    var ticket: Ticket?
    var comments: [Comment] = []
    var users: [User] = []
    var draft = ""
    var error: String?
    var isSaving = false
    var isPosting = false

    init(id: Int) { self.id = id }

    func load(auth: AuthStore) async {
        error = nil
        do {
            async let ticket = auth.api.ticket(id: id)
            async let comments = auth.api.comments(ticketId: id)
            async let users = auth.api.listUsers()
            self.ticket = try await ticket
            self.comments = try await comments
            self.users = (try? await users) ?? []
        } catch {
            self.error = auth.message(for: error)
        }
    }

    /// Returns the updated ticket on success.
    func update(_ patch: TicketPatch, auth: AuthStore) async -> Ticket? {
        isSaving = true
        error = nil
        defer { isSaving = false }
        do {
            let updated = try await auth.api.updateTicket(id: id, patch)
            ticket = updated
            return updated
        } catch {
            self.error = auth.message(for: error)
            return nil
        }
    }

    func post(auth: AuthStore) async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isPosting else { return }
        isPosting = true
        error = nil
        defer { isPosting = false }
        do {
            comments.append(try await auth.api.addComment(ticketId: id, body: text))
            draft = ""
        } catch {
            self.error = auth.message(for: error)
        }
    }
}

struct TicketDetailView: View {
    @Environment(AuthStore.self) private var auth
    @State private var model: TicketDetailModel
    @FocusState private var composerFocused: Bool
    var onChange: (Ticket) -> Void

    init(id: Int, onChange: @escaping (Ticket) -> Void = { _ in }) {
        _model = State(initialValue: TicketDetailModel(id: id))
        self.onChange = onChange
    }

    var body: some View {
        Group {
            if let ticket = model.ticket {
                content(for: ticket)
            } else if let error = model.error {
                ContentUnavailableView("Could not load ticket", systemImage: "exclamationmark.triangle", description: Text(error))
            } else {
                ProgressView()
            }
        }
        .navigationTitle("Ticket #\(model.id)")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load(auth: auth) }
    }

    @ViewBuilder
    private func content(for ticket: Ticket) -> some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    Text(ticket.title).font(.title3.weight(.semibold))
                    HStack {
                        StatusBadge(status: ticket.status)
                        PriorityBadge(priority: ticket.priority)
                    }
                    Text(ticket.description.isEmpty ? "No description." : ticket.description)
                        .foregroundStyle(ticket.description.isEmpty ? .secondary : .primary)
                    Text("Opened by \(ticket.createdByName) · \(ticket.createdAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }

            Section("Manage") {
                Picker("Status", selection: binding(ticket.status) { TicketPatch(status: $0) }) {
                    ForEach(Status.allCases) { Text($0.label).tag($0) }
                }
                Picker("Priority", selection: binding(ticket.priority) { TicketPatch(priority: $0) }) {
                    ForEach(Priority.allCases) { Text($0.label).tag($0) }
                }
                Picker("Assignee", selection: binding(ticket.assigneeId) {
                    TicketPatch(assignee: $0.map { .assign($0) } ?? .clear)
                }) {
                    Text("Unassigned").tag(Int?.none)
                    ForEach(model.users) { Text($0.name).tag(Int?.some($0.id)) }
                }
            }
            .disabled(model.isSaving)

            Section("Comments (\(model.comments.count))") {
                if model.comments.isEmpty {
                    Text("No comments yet.").foregroundStyle(.secondary)
                }
                ForEach(model.comments) { comment in
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(comment.authorName) · \(comment.createdAt.formatted(date: .abbreviated, time: .shortened))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(comment.body)
                    }
                    .padding(.vertical, 2)
                }
            }

            if let error = model.error {
                Section { Text(error).foregroundStyle(.red).font(.callout) }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) { composer }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Add a comment", text: $model.draft, axis: .vertical)
                .lineLimit(1...4)
                .focused($composerFocused)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
            Button {
                Task {
                    await model.post(auth: auth)
                    if model.draft.isEmpty { composerFocused = false }
                }
            } label: {
                if model.isPosting {
                    ProgressView()
                } else {
                    Image(systemName: "arrow.up.circle.fill").font(.title)
                }
            }
            .disabled(model.isPosting || model.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityLabel("Post comment")
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }

    /// A binding that saves to the API when the user changes the value.
    private func binding<Value: Equatable>(
        _ current: Value,
        patch: @escaping (Value) -> TicketPatch
    ) -> Binding<Value> {
        Binding(
            get: { current },
            set: { newValue in
                guard newValue != current else { return }
                Task {
                    if let updated = await model.update(patch(newValue), auth: auth) { onChange(updated) }
                }
            }
        )
    }
}
