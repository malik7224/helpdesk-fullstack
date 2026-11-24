package dev.malik7224.helpdesk.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Amber = Color(0xFFF2B84B)

private val Dark = darkColorScheme(
    primary = Amber,
    onPrimary = Color(0xFF1E1E21),
    primaryContainer = Amber,
    onPrimaryContainer = Color(0xFF1E1E21),
    secondaryContainer = Color(0xFF4A3A18),
    onSecondaryContainer = Color(0xFFFFE2A8),
    background = Color(0xFF1E1E21),
    surface = Color(0xFF1E1E21),
    surfaceContainer = Color(0xFF26262A),
    surfaceContainerHigh = Color(0xFF2E2E33),
    onBackground = Color(0xFFF2F2F3),
    onSurface = Color(0xFFF2F2F3),
    onSurfaceVariant = Color(0xFFB0B0B6),
    outlineVariant = Color(0xFF3A3A3F),
)

private val Light = lightColorScheme(
    primary = Color(0xFF8A5A00),
    onPrimary = Color.White,
    primaryContainer = Amber,
    onPrimaryContainer = Color(0xFF1E1E21),
    secondaryContainer = Color(0xFFFFE7B3),
    onSecondaryContainer = Color(0xFF3B2A00),
    background = Color(0xFFF6F6F7),
    surface = Color(0xFFF6F6F7),
    surfaceContainer = Color.White,
    surfaceContainerHigh = Color(0xFFEDEDEF),
)

@Composable
fun HelpdeskTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, content = content)
}
