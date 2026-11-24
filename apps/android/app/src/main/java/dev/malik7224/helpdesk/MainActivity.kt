package dev.malik7224.helpdesk

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dev.malik7224.helpdesk.data.SessionStore
import dev.malik7224.helpdesk.ui.AuthViewModel
import dev.malik7224.helpdesk.ui.HelpdeskApp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val store = SessionStore(applicationContext)
        setContent {
            val auth: AuthViewModel = viewModel(factory = viewModelFactory { initializer { AuthViewModel(store) } })
            HelpdeskApp(auth)
        }
    }
}
