package ru.ancargo66.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.core.view.WindowCompat
import ru.ancargo66.app.core.storage.SessionManager
import ru.ancargo66.app.features.auth.LoginScreen
import ru.ancargo66.app.features.dispatcher.DispatcherScreen
import ru.ancargo66.app.features.driver.DriverScreen
import ru.ancargo66.app.features.loader.LoaderScreen
import ru.ancargo66.app.features.mechanic.MechanicScreen
import ru.ancargo66.app.ui.theme.SaldaCargoTheme
import ru.ancargo66.app.ui.theme.Zinc50

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Делаем системные значки часов, батареи и связи тёмными и контрастными
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }

        val sessionManager = SessionManager(applicationContext)

        setContent {
            SaldaCargoTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Zinc50
                ) {
                    var currentUser by remember { mutableStateOf(sessionManager.getCurrentUser()) }
                    var activeRole by remember { mutableStateOf(sessionManager.getActiveRole()) }

                    val onLogout = {
                        sessionManager.clear()
                        currentUser = null
                    }

                    Column(
                        modifier = Modifier.fillMaxSize()
                    ) {
                        // 1. АБСОЛЮТНАЯ ЗАЩИТА СВЕРХУ:
                        // Физический разделитель ровно на высоту статус-бара и выреза камеры телефона
                        Spacer(
                            modifier = Modifier
                                .fillMaxWidth()
                                .windowInsetsTopHeight(WindowInsets.statusBars)
                                .background(Color.White)
                        )

                        // 2. Основной контент приложения — гарантированно расположен НИЖЕ информации телефона
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f)
                        ) {
                            val user = currentUser
                            if (user == null) {
                                LoginScreen(
                                    onLoginSuccess = { loggedUser, role ->
                                        sessionManager.saveUser(loggedUser, role)
                                        activeRole = role
                                        currentUser = loggedUser
                                    }
                                )
                            } else {
                                when (activeRole) {
                                    "driver" -> DriverScreen(user = user, onLogout = onLogout)
                                    "loader" -> LoaderScreen(user = user, sessionManager = sessionManager, onLogout = onLogout)
                                    "mechanic" -> MechanicScreen(user = user, onLogout = onLogout)
                                    else -> DispatcherScreen(user = user, onLogout = onLogout)
                                }
                            }
                        }

                        // 3. АБСОЛЮТНАЯ ЗАЩИТА СНИЗУ:
                        // Физический разделитель под жестовую полоску / кнопки навигации Android
                        Spacer(
                            modifier = Modifier
                                .fillMaxWidth()
                                .windowInsetsBottomHeight(WindowInsets.navigationBars)
                                .background(Color.White)
                        )
                    }
                }
            }
        }
    }
}
