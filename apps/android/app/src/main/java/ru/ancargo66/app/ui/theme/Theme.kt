package ru.ancargo66.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = SaldaOrangePrimary,
    onPrimary = Color.White,
    primaryContainer = SaldaOrange50,
    onPrimaryContainer = SaldaOrangeDark,
    secondary = Zinc700,
    onSecondary = Color.White,
    background = Zinc50,
    onBackground = Zinc900,
    surface = Color.White,
    onSurface = Zinc900,
    surfaceVariant = Zinc100,
    onSurfaceVariant = Zinc500,
    outline = Zinc200
)

private val DarkColorScheme = darkColorScheme(
    primary = SaldaOrangePrimary,
    onPrimary = Color.White,
    primaryContainer = SaldaOrangeDark,
    onPrimaryContainer = Color.White,
    secondary = Zinc200,
    onSecondary = Zinc900,
    background = Zinc900,
    onBackground = Zinc50,
    surface = Color(0xFF27272A),
    onSurface = Zinc50,
    surfaceVariant = Color(0xFF3F3F46),
    onSurfaceVariant = Zinc200,
    outline = Color(0xFF52525B)
)

@Composable
fun SaldaCargoTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
