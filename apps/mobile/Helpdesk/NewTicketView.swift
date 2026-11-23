import SwiftUI

struct NewTicketView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var details = ""
    @State private var priority = Priority.medium
    @State private var error: String?
    @State private var busy = false
    var onCreated: (Ticket) -> Void

    private var isValid: Bool { title.trimmingCharacters(in: .whitespaces).count >= 3 }

    var body: some View {
        NavigationStack {
            Form {
                Section("Title") {
                    TextField("What is the problem?", text: $title)
                        .accessibilityIdentifier("new-ticket-title")
                }
                Section("Description") {
                    TextField("Add details (optional)", text: $details, axis: .vertical)
                        .lineLimit(4...10)
                }
                Section {
                    Picker("Priority", selection: $priority) {
                        ForEach(Priority.allCases) { Text($0.label).tag($0) }
                    }
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.callout) }
                }
            }
            .navigationTitle("New ticket")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await create() } }
                        .disabled(!isValid || busy)
                }
            }
        }
    }

    private func create() async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            let ticket = try await auth.api.createTicket(
                NewTicket(
                    title: title.trimmingCharacters(in: .whitespaces),
                    description: details.trimmingCharacters(in: .whitespacesAndNewlines),
                    priority: priority
                )
            )
            onCreated(ticket)
            dismiss()
        } catch {
            self.error = auth.message(for: error)
        }
    }
}
