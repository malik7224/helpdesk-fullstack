import XCTest

/// Drives the real app against a running API (`npm run seed && npm run dev:api` in the repo root).
/// These are not part of the default test run, because they need a server.
final class EndToEndTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func signInIfNeeded(_ app: XCUIApplication) {
        if app.textFields["Email"].waitForExistence(timeout: 5) {
            app.textFields["Email"].tap()
            app.textFields["Email"].typeText("agent@demo.test")
            app.secureTextFields["Password"].tap()
            app.secureTextFields["Password"].typeText("demo-password-123")
            app.buttons["Sign in"].tap()
        }
        XCTAssertTrue(app.navigationBars["Tickets"].waitForExistence(timeout: 10))
    }

    func testWrongPasswordShowsAnError() throws {
        let app = XCUIApplication()
        app.launch()
        let email = app.textFields["Email"]
        guard email.waitForExistence(timeout: 5) else { return } // already signed in from another test
        snap(app, "1-login")
        email.tap()
        email.typeText("agent@demo.test")
        app.secureTextFields["Password"].tap()
        app.secureTextFields["Password"].typeText("wrong-password")
        app.buttons["Sign in"].tap()
        XCTAssertTrue(app.staticTexts["login-error"].waitForExistence(timeout: 10))
        snap(app, "2-login-error")
    }

    func testSignInReadAndComment() throws {
        let app = XCUIApplication()
        app.launch()
        signInIfNeeded(app)

        let firstTicket = app.collectionViews.buttons.firstMatch
        XCTAssertTrue(firstTicket.waitForExistence(timeout: 10))
        snap(app, "3-ticket-list")

        firstTicket.tap()
        let composer = app.textFields["Add a comment"]
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        composer.tap()
        let text = "Checked from the iPhone app \(Int(Date().timeIntervalSince1970))"
        composer.typeText(text)
        app.buttons["Post comment"].tap()
        XCTAssertTrue(app.staticTexts[text].waitForExistence(timeout: 10))
        snap(app, "4-ticket-detail-comment")
    }

    func testCreateTicket() throws {
        let app = XCUIApplication()
        app.launch()
        signInIfNeeded(app)

        app.buttons["New ticket"].tap()
        let title = app.textFields["new-ticket-title"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        title.tap()
        let name = "Created on iPhone \(Int(Date().timeIntervalSince1970))"
        title.typeText(name)
        snap(app, "5-new-ticket")
        app.buttons["Create"].tap()

        XCTAssertTrue(app.staticTexts[name].waitForExistence(timeout: 10))
        snap(app, "6-list-with-new-ticket")
    }

    /// Clean screenshots for the README. Run alone, on a freshly seeded database.
    func testReadmeScreenshots() throws {
        let app = XCUIApplication()
        app.launch()
        signInIfNeeded(app)

        let row = app.collectionViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Export to CSV'")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        snap(app, "readme-1-tickets")

        row.tap()
        let composer = app.textFields["Add a comment"]
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        composer.tap()
        let text = "Reproduced with a 50,000 row report. Looking into the timeout."
        composer.typeText(text)
        app.buttons["Post comment"].tap()
        XCTAssertTrue(app.staticTexts[text].waitForExistence(timeout: 10))
        app.collectionViews.firstMatch.swipeUp() // scroll to the comments
        sleep(1)
        snap(app, "readme-2-detail")

        app.navigationBars.buttons.firstMatch.tap()
        app.buttons["New ticket"].tap()
        let title = app.textFields["new-ticket-title"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        title.tap()
        title.typeText("Invoice PDF shows the wrong total")
        sleep(1)
        snap(app, "readme-3-new-ticket")
    }
}
