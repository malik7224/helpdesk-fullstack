package dev.malik7224.helpdesk.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import dev.malik7224.helpdesk.data.User

@Composable
fun HelpdeskApp(auth: AuthViewModel) {
    val state by auth.state.collectAsStateWithLifecycle()
    HelpdeskTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            when (val current = state) {
                AuthViewModel.State.Loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
                AuthViewModel.State.SignedOut -> LoginScreen(auth)
                is AuthViewModel.State.SignedIn -> SignedInNav(auth, current.user)
            }
        }
    }
}

@Composable
private fun SignedInNav(auth: AuthViewModel, user: User) {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = "tickets") {
        composable("tickets") {
            val vm: TicketListViewModel = viewModel(factory = viewModelFactory { initializer { TicketListViewModel(auth) } })
            TicketListScreen(
                vm = vm,
                user = user,
                onOpen = { nav.navigate("tickets/$it") },
                onNew = { nav.navigate("new") },
                onSignOut = auth::signOut,
            )
        }
        composable("tickets/{id}", arguments = listOf(navArgument("id") { type = NavType.IntType })) { entry ->
            val id = entry.arguments!!.getInt("id")
            val vm: TicketDetailViewModel = viewModel(
                key = "ticket-$id",
                factory = viewModelFactory { initializer { TicketDetailViewModel(auth, id) } },
            )
            TicketDetailScreen(vm = vm, id = id, onBack = { nav.popBackStack() })
        }
        composable("new") {
            val vm: NewTicketViewModel = viewModel(factory = viewModelFactory { initializer { NewTicketViewModel(auth) } })
            NewTicketScreen(vm = vm, onBack = { nav.popBackStack() })
        }
    }
}
