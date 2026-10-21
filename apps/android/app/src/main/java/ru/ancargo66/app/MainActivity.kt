package ru.ancargo66.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import ru.ancargo66.app.core.model.User
import ru.ancargo66.app.core.storage.SessionManager
import ru.ancargo66.app.features.auth.LoginScreen
import ru.ancargo66.app.features.dispatcher.DispatcherScreen
import ru.ancargo66.app.features.driver.DriverScreen
import ru.ancargo66.app.features.loader.LoaderScreen
import ru.ancargo66.app.features.mechanic.MechanicScreen
import ru.ancargo66.app.ui.theme.SaldaCargoTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val sessionManager = SessionManager(applicationContext)

        setContent {
            SaldaCargoTheme {
                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    containerColor = MaterialTheme.colorScheme.background
                ) { innerPadding ->
                    var currentUser by remember { mutableStateOf(sessionManager.getCurrentUser()) }
                    var activeRole by remember { mutableStateOf(sessionManager.getActiveRole()) }

                    val onLogout = {
                        sessionManager.clear()
                        currentUser = null
                    }

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
            }
        }
    }
}
