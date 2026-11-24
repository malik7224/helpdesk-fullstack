package dev.malik7224.helpdesk.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.malik7224.helpdesk.data.ApiClient
import dev.malik7224.helpdesk.data.ApiException
import dev.malik7224.helpdesk.data.Comment
import dev.malik7224.helpdesk.data.NewTicket
import dev.malik7224.helpdesk.data.SessionStore
import dev.malik7224.helpdesk.data.Status
import dev.malik7224.helpdesk.data.Ticket
import dev.malik7224.helpdesk.data.TicketFilters
import dev.malik7224.helpdesk.data.TicketPatch
import dev.malik7224.helpdesk.data.User
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AuthViewModel(private val store: SessionStore) : ViewModel() {
    sealed interface State {
        data object Loading : State
        data object SignedOut : State
        data class SignedIn(val user: User) : State
    }

    private val _state = MutableStateFlow<State>(State.Loading)
    val state: StateFlow<State> = _state.asStateFlow()

    var serverUrl by mutableStateOf(store.serverUrl)
    private var token: String? = null

    init {
        viewModelScope.launch { restore() }
    }

    /** A client for the current server and token. */
    fun api() = ApiClient(serverUrl, token)

    private suspend fun restore() {
        // The Keystore can be slow, so it never runs on the UI thread.
        token = withContext(Dispatchers.IO) { store.loadToken() }
        if (token == null) {
            _state.value = State.SignedOut
            return
        }
        try {
            _state.value = State.SignedIn(api().me())
        } catch (e: ApiException) {
            // An expired token means signing in again. Any other error (for example no network)
            // also lands on the sign-in screen, but the saved token is kept.
            if (e.kind == ApiException.Kind.Unauthorized) signOut() else _state.value = State.SignedOut
        }
    }

    suspend fun signIn(email: String, password: String) {
        val result = ApiClient(serverUrl).login(email, password)
        withContext(Dispatchers.IO) {
            store.serverUrl = serverUrl.trim()
            store.saveToken(result.token)
        }
        token = result.token
        _state.value = State.SignedIn(result.user)
    }

    fun signOut() {
        token = null
        viewModelScope.launch(Dispatchers.IO) { store.clearToken() }
        _state.value = State.SignedOut
    }

    /** Turns an error into text for the screen. Signs out on an expired session and returns null. */
    fun messageFor(error: Throwable): String? {
        if (error is ApiException && error.kind == ApiException.Kind.Unauthorized) {
            signOut()
            return null
        }
        return error.message ?: "Something went wrong"
    }
}

data class ListUi(
    val tickets: List<Ticket> = emptyList(),
    val total: Int = 0,
    val query: String = "",
    val status: Status? = null,
    val loading: Boolean = false,
    val refreshing: Boolean = false,
    val canLoadMore: Boolean = false,
    val error: String? = null,
)

class TicketListViewModel(private val auth: AuthViewModel) : ViewModel() {
    private val _ui = MutableStateFlow(ListUi())
    val ui: StateFlow<ListUi> = _ui.asStateFlow()

    private var page = 1
    private var totalPages = 1
    private var generation = 0
    private var searchJob: Job? = null

    /** Loads the first page. A newer call replaces an older one that is still running. */
    fun reload(pulled: Boolean = false) {
        val mine = ++generation
        viewModelScope.launch {
            _ui.update { it.copy(loading = true, refreshing = pulled, error = null) }
            try {
                val current = _ui.value
                val result = auth.api().tickets(TicketFilters(query = current.query, status = current.status))
                if (mine != generation) return@launch
                page = result.page
                totalPages = result.totalPages
                _ui.update {
                    it.copy(
                        tickets = result.items,
                        total = result.total,
                        canLoadMore = page < totalPages,
                        loading = false,
                        refreshing = false,
                    )
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                if (mine == generation) {
                    _ui.update { it.copy(loading = false, refreshing = false, error = auth.messageFor(e)) }
                }
            }
        }
    }

    fun loadMore() {
        val current = _ui.value
        if (!current.canLoadMore || current.loading) return
        val mine = generation
        viewModelScope.launch {
            _ui.update { it.copy(loading = true) }
            try {
                val result = auth.api().tickets(
                    TicketFilters(query = current.query, status = current.status, page = page + 1),
                )
                if (mine != generation) return@launch
                page = result.page
                totalPages = result.totalPages
                _ui.update { state ->
                    val known = state.tickets.mapTo(HashSet()) { it.id }
                    state.copy(
                        tickets = state.tickets + result.items.filter { it.id !in known },
                        canLoadMore = page < totalPages,
                        loading = false,
                    )
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                if (mine == generation) _ui.update { it.copy(loading = false, error = auth.messageFor(e)) }
            }
        }
    }

    fun setQuery(query: String) {
        _ui.update { it.copy(query = query) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(350) // Wait for the user to stop typing.
            reload()
        }
    }

    fun setStatus(status: Status?) {
        _ui.update { it.copy(status = status) }
        reload()
    }
}

data class DetailUi(
    val ticket: Ticket? = null,
    val comments: List<Comment> = emptyList(),
    val users: List<User> = emptyList(),
    val draft: String = "",
    val saving: Boolean = false,
    val posting: Boolean = false,
    val error: String? = null,
)

class TicketDetailViewModel(private val auth: AuthViewModel, private val id: Int) : ViewModel() {
    private val _ui = MutableStateFlow(DetailUi())
    val ui: StateFlow<DetailUi> = _ui.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _ui.update { it.copy(error = null) }
            try {
                coroutineScope {
                    val api = auth.api()
                    val ticket = async { api.ticket(id) }
                    val comments = async { api.comments(id) }
                    val users = async { runCatching { api.users() }.getOrDefault(emptyList()) }
                    _ui.update { it.copy(ticket = ticket.await(), comments = comments.await(), users = users.await()) }
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                _ui.update { it.copy(error = auth.messageFor(e)) }
            }
        }
    }

    fun update(patch: TicketPatch) {
        viewModelScope.launch {
            _ui.update { it.copy(saving = true, error = null) }
            try {
                val updated = auth.api().updateTicket(id, patch)
                _ui.update { it.copy(ticket = updated, saving = false) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                _ui.update { it.copy(saving = false, error = auth.messageFor(e)) }
            }
        }
    }

    fun setDraft(text: String) = _ui.update { it.copy(draft = text) }

    fun post() {
        val text = _ui.value.draft.trim()
        if (text.isEmpty() || _ui.value.posting) return
        viewModelScope.launch {
            _ui.update { it.copy(posting = true, error = null) }
            try {
                val comment = auth.api().addComment(id, text)
                _ui.update { it.copy(comments = it.comments + comment, draft = "", posting = false) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                _ui.update { it.copy(posting = false, error = auth.messageFor(e)) }
            }
        }
    }
}

class NewTicketViewModel(private val auth: AuthViewModel) : ViewModel() {
    var busy by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    fun create(input: NewTicket, onDone: () -> Unit) {
        viewModelScope.launch {
            busy = true
            error = null
            try {
                auth.api().createTicket(input)
                onDone()
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                error = auth.messageFor(e)
            } finally {
                busy = false
            }
        }
    }
}
