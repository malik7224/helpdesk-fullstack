package dev.malik7224.helpdesk.data

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import java.net.URI

/**
 * Android 17 (API 37) blocks apps from reaching devices on the local network, including the
 * emulator's 10.0.2.2 and a computer on the same Wi-Fi, until the user allows it.
 */
object LocalNetwork {
    const val PERMISSION = "android.permission.ACCESS_LOCAL_NETWORK"
    private const val API_37 = 37

    private val privateHost = Regex("""^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)""")

    fun isLocalAddress(url: String): Boolean {
        val host = runCatching { URI(url.trim()).host }.getOrNull() ?: return false
        return host == "localhost" || host.endsWith(".local") || privateHost.containsMatchIn(host)
    }

    fun needsPermission(context: Context, url: String): Boolean =
        Build.VERSION.SDK_INT >= API_37 &&
            isLocalAddress(url) &&
            context.checkSelfPermission(PERMISSION) != PackageManager.PERMISSION_GRANTED
}
