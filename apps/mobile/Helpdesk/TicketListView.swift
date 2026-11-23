import SwiftUI

@MainActor
@Observable
final class TicketListModel {
    var tickets: [Ticket] = []
    var total = 0
    var query = ""
    var status: Status?
    var isLoading = false
    var error: String?

    private var page = 1
    private var totalPages = 1
    private var generation = 0

    var canLoadMore: Bool { page < totalPages }

    /// Loads the first page. A newer call replaces an older one that is still running.
    func reload(auth: AuthStore) async {
        generation += 1
        let mine = generation
        isLoading = true
        error = nil
        do {
            let result = try await auth.api.listTickets(filters(page: 1))
            guard mine == generation else { return }
            tickets = result.data
            total = result.total
            page = result.page
            totalPages = result.totalPages
        } catch {
            guard mine == generation else { return }
            self.error = auth.message(for: error)
        }
        if mine == generation { isLoading = false }
    }

    func loadMore(auth: AuthStore) async {
        guard canLoadMore, !isLoading else { return }
        let mine = generation
        isLoading = true
        do {
            let result = try await auth.api.listTickets(filters(page: page + 1))
            guard mine == generation else { return }
            tickets += result.data.filter { new in !tickets.contains { $0.id == new.id } }
            page = result.page
            totalPages = result.totalPages
        } catch {
            guard mine == generation else { return }
            self.error = auth.message(for: error)
        }
        if mine == generation { isLoading = false }
    }

    private func filters(page: Int) -> TicketFilters {
        TicketFilters(query: query, status: status, page: page)
    }
}

struct TicketListView: View {
    @Environment(AuthStore.self) private var auth
    @State private var model = TicketListModel()
    @State private var showNew = false
    @State private var confirmSignOut = false

    var body: some View {
        NavigationStack {
            List {
                if let error = model.error {
                    Text(error).foregroundStyle(.red).font(.callout)
                }

                ForEach(model.tickets) { ticket in
                    NavigationLink(value: ticket.id) {
                        TicketRow(ticket: ticket)
                    }
                    .task {
                        if ticket.id == model.tickets.last?.id { await model.loadMore(auth: auth) }
                    }
                }

                if model.isLoading && model.tickets.isEmpty {
                    ProgressView().frame(maxWidth: .infinity)
                } else if model.tickets.isEmpty && model.error == nil {
                    ContentUnavailableView("No tickets", systemImage: "tray", description: Text("Nothing matches. Try another search or filter."))
                }
            }
            .listStyle(.plain)
            .navigationTitle("Tickets")
            .navigationDestination(for: Int.self) { id in
                TicketDetailView(id: id) { updated in
                    if let index = model.tickets.firstIndex(where: { $0.id == updated.id }) {
                        model.tickets[index] = updated
                    }
                }
            }
            .searchable(text: $model.query, prompt: "Search tickets")
            .onSubmit(of: .search) { Task { await model.reload(auth: auth) } }
            .refreshable { await model.reload(auth: auth) }
            .task { await model.reload(auth: auth) }
            .onChange(of: model.status) { Task { await model.reload(auth: auth) } }
            .onChange(of: model.query) { _, new in
                // Clearing the search box brings the full list back.
                if new.isEmpty { Task { await model.reload(auth: auth) } }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        if let user = auth.user {
                            Text("\(user.name) · \(user.role.rawValue)")
                        }
                        Button("Sign out", role: .destructive) { confirmSignOut = true }
                    } label: {
                        Image(systemName: "person.crop.circle")
                    }
                    .accessibilityLabel("Account")
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Menu {
                        Picker("Status", selection: $model.status) {
                            Text("All statuses").tag(Status?.none)
                            ForEach(Status.allCases) { Text($0.label).tag(Status?.some($0)) }
                        }
                    } label: {
                        Image(systemName: model.status == nil
                              ? "line.3.horizontal.decrease.circle"
                              : "line.3.horizontal.decrease.circle.fill")
                    }
                    .accessibilityLabel("Filter by status")

                    Button { showNew = true } label: { Image(systemName: "plus") }
                        .accessibilityLabel("New ticket")
                }
            }
            .sheet(isPresented: $showNew) {
                NewTicketView { _ in Task { await model.reload(auth: auth) } }
            }
            .confirmationDialog("Sign out of Helpdesk?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) { auth.signOut() }
            }
        }
    }
}

struct TicketRow: View {
    let ticket: Ticket

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(ticket.title)
                .font(.headline)
                .lineLimit(2)
            HStack(spacing: 6) {
                StatusBadge(status: ticket.status)
                PriorityBadge(priority: ticket.priority)
                Spacer()
                Text(ticket.updatedAt, format: .relative(presentation: .named))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text(ticket.assigneeName.map { "Assigned to \($0)" } ?? "Unassigned")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}
