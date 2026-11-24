package dev.malik7224.helpdesk

import android.content.Context
import android.graphics.Bitmap
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import dev.malik7224.helpdesk.data.LocalNetwork
import java.io.File
import java.io.FileOutputStream
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * Drives the real app against a running API (`npm run seed && npm run dev:api` in the repo root).
 * The emulator reaches the computer at 10.0.2.2. These tests need a server, so CI does not run them.
 */
class EndToEndTest {
    @get:Rule(order = 0) val permission: GrantPermissionRule = GrantPermissionRule.grant(LocalNetwork.PERMISSION)
    @get:Rule(order = 1) val rule = createEmptyComposeRule()
    private lateinit var scenario: ActivityScenario<MainActivity>
    private val context: Context get() = InstrumentationRegistry.getInstrumentation().targetContext

    @Before fun launchSignedOut() {
        context.getSharedPreferences("session", Context.MODE_PRIVATE).edit().clear().commit()
        scenario = ActivityScenario.launch(MainActivity::class.java)
    }

    @After fun close() {
        scenario.close()
    }

    private fun waitForTag(tag: String, timeoutMs: Long = 15_000) =
        rule.waitUntil(timeoutMs) { rule.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }

    private fun waitForText(text: String, timeoutMs: Long = 15_000) =
        rule.waitUntil(timeoutMs) { rule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }

    private fun shot(name: String) {
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
        val dir = File(context.getExternalFilesDir(null), "shots").apply { mkdirs() }
        FileOutputStream(File(dir, "$name.png")).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun signIn(password: String) {
        waitForTag("email")
        rule.onNodeWithTag("email").performTextInput("agent@demo.test")
        rule.onNodeWithTag("password").performTextInput(password)
        rule.onNodeWithTag("sign-in").performClick()
    }

    @Test fun wrongPasswordShowsAnError() {
        signIn("wrong-password")
        waitForTag("login-error")
        rule.onNodeWithTag("login-error").assertIsDisplayed()
    }

    @Test fun signInReadCommentAndCreate() {
        signIn("demo-password-123")
        waitForTag("ticket-list")
        waitForText("Export to CSV fails on large reports")
        shot("readme-1-tickets")

        // Open a ticket and post a comment.
        rule.onNodeWithText("Export to CSV fails on large reports").performClick()
        waitForTag("composer")
        val comment = "Reproduced with a 50,000 row report. Looking into the timeout."
        rule.onNodeWithTag("composer").performTextInput(comment)
        rule.onNodeWithTag("send").performClick()
        waitForText("Comments (1)") // The comment is in the list, not just typed in the box.
        shot("readme-2-detail")

        // Back to the list, then create a ticket.
        scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        waitForTag("new-ticket")
        rule.onNodeWithTag("new-ticket").performClick()
        waitForTag("title")
        val title = "Invoice PDF shows the wrong total"
        rule.onNodeWithTag("title").performTextClearance()
        rule.onNodeWithTag("title").performTextInput(title)
        shot("readme-3-new-ticket")
        rule.onNodeWithTag("create").performClick()
        waitForTag("ticket-list")
        waitForText(title)
    }
}
