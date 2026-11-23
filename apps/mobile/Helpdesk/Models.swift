import Foundation

enum Role: String, Codable, Sendable {
    case admin, agent
}

enum Status: String, Codable, CaseIterable, Identifiable, Sendable {
    case open
    case inProgress = "in_progress"
    case resolved
    case closed

    var id: String { rawValue }

    var label: String {
        switch self {
        case .open: "Open"
        case .inProgress: "In progress"
        case .resolved: "Resolved"
        case .closed: "Closed"
        }
    }
}

enum Priority: String, Codable, CaseIterable, Identifiable, Sendable {
    case low, medium, high

    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

struct User: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    let email: String
    let name: String
    let role: Role
}

struct Ticket: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    var title: String
    var description: String
    var status: Status
    var priority: Priority
    let createdBy: Int
    let createdByName: String
    var assigneeId: Int?
    var assigneeName: String?
    let createdAt: Date
    var updatedAt: Date
}

struct Comment: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    let ticketId: Int
    let body: String
    let authorId: Int
    let authorName: String
    let createdAt: Date
}

struct Paged<Item: Decodable & Sendable>: Decodable, Sendable {
    let data: [Item]
    let page: Int
    let pageSize: Int
    let total: Int
    let totalPages: Int
}

struct TicketFilters: Sendable, Equatable {
    var query = ""
    var status: Status?
    var page = 1
    var pageSize = 20
}

struct NewTicket: Encodable, Sendable {
    var title: String
    var description: String
    var priority: Priority
    var assigneeId: Int?
}

/// A partial update. Fields left nil are not sent. `assignee` can also clear the assignee.
struct TicketPatch: Encodable, Sendable {
    enum AssigneeChange: Sendable, Equatable {
        case assign(Int)
        case clear
    }

    var title: String?
    var description: String?
    var status: Status?
    var priority: Priority?
    var assignee: AssigneeChange?

    private enum CodingKeys: String, CodingKey {
        case title, description, status, priority, assigneeId
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encodeIfPresent(status, forKey: .status)
        try container.encodeIfPresent(priority, forKey: .priority)
        switch assignee {
        case .assign(let id): try container.encode(id, forKey: .assigneeId)
        case .clear: try container.encodeNil(forKey: .assigneeId)
        case nil: break
        }
    }
}
