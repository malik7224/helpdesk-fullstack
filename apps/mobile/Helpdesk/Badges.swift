import SwiftUI

struct Badge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(color)
            .background(color.opacity(0.15), in: Capsule())
    }
}

struct StatusBadge: View {
    let status: Status

    var body: some View {
        Badge(text: status.label, color: color)
    }

    private var color: Color {
        switch status {
        case .open: .blue
        case .inProgress: .orange
        case .resolved: .green
        case .closed: .gray
        }
    }
}

struct PriorityBadge: View {
    let priority: Priority

    var body: some View {
        Badge(text: priority.label, color: color)
    }

    private var color: Color {
        switch priority {
        case .low: .gray
        case .medium: .yellow
        case .high: .red
        }
    }
}
