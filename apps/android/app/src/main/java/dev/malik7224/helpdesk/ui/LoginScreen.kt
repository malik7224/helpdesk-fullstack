package dev.malik7224.helpdesk.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import dev.malik7224.helpdesk.data.ApiException
import dev.malik7224.helpdesk.data.LocalNetwork
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(auth: AuthViewModel) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var showServer by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var retryAfterPermission by remember { mutableStateOf(false) }

    val askLocalNetwork = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            retryAfterPermission = true
        } else {
            error = "Android needs your permission to reach a server on your own network. You can allow it in the app's settings."
        }
    }

    fun submit() {
        if (busy || email.isBlank() || password.isEmpty()) return
        if (LocalNetwork.needsPermission(context, auth.serverUrl)) {
            askLocalNetwork.launch(LocalNetwork.PERMISSION)
            return
        }
        scope.launch {
            busy = true
            error = null
            try {
                auth.signIn(email.trim(), password)
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                // A 401 here means wrong credentials, not an expired session, so show the server's message.
                error = e.message
            } finally {
                busy = false
            }
        }
    }

    LaunchedEffect(retryAfterPermission) {
        if (retryAfterPermission) {
            retryAfterPermission = false
            submit()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Helpdesk", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold)
        Text("Sign in to manage tickets.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(28.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth().testTag("email"),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth().testTag("password"),
        )

        ErrorText(error, Modifier.padding(top = 12.dp).testTag("login-error"))

        Spacer(Modifier.height(20.dp))
        Button(
            onClick = ::submit,
            enabled = !busy && email.isNotBlank() && password.isNotEmpty(),
            modifier = Modifier.fillMaxWidth().height(52.dp).testTag("sign-in"),
        ) {
            if (busy) CircularProgressIndicator(Modifier.height(22.dp), strokeWidth = 2.dp) else Text("Sign in")
        }

        TextButton(onClick = { showServer = !showServer }, modifier = Modifier.padding(top = 8.dp)) {
            Text(if (showServer) "Hide server" else "Server")
        }
        if (showServer) {
            OutlinedTextField(
                value = auth.serverUrl,
                onValueChange = { auth.serverUrl = it },
                label = { Text("Server address") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                "The emulator reaches your computer at http://10.0.2.2:4000. On a real phone, use your computer's address on the same Wi-Fi.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}
