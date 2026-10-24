package ru.ancargo66.app.features.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import ru.ancargo66.app.R
import ru.ancargo66.app.core.model.User
import ru.ancargo66.app.core.network.SaldaApiClient
import ru.ancargo66.app.core.network.SupabaseApi
import ru.ancargo66.app.ui.theme.*

private var cachedUsersMemory: List<User> = emptyList()

@Composable
fun LoginScreen(
    onLoginSuccess: (User, String) -> Unit
) {
    val keyboardController = LocalSoftwareKeyboardController.current
    var selectedRole by remember { mutableStateOf("driver") }
    var users by remember { mutableStateOf(cachedUsersMemory) }
    var userForPin by remember { mutableStateOf<User?>(null) }
    var isLoading by remember { mutableStateOf(cachedUsersMemory.isEmpty()) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    val loadUsers = {
        scope.launch {
            if (cachedUsersMemory.isEmpty()) isLoading = true
            errorMessage = null
            try {
                // Быстрый прямой запрос в Supabase (~300мс) с откатом на API
                val loaded = try {
                    SupabaseApi.getUsers()
                } catch (_: Exception) {
                    SaldaApiClient.getUsers()
                }
                users = loaded
                cachedUsersMemory = loaded
            } catch (e: Exception) {
                if (cachedUsersMemory.isEmpty()) {
                    errorMessage = "Ошибка подключения к серверу: ${e.message}"
                }
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        loadUsers()
    }

    // Если выбран сотрудник с PIN-кодом — показываем банковский PinScreen
    val pinUser = userForPin
    if (pinUser != null) {
        PinScreen(
            user = pinUser,
            onSuccess = { onLoginSuccess(pinUser, selectedRole) },
            onCancel = { userForPin = null }
        )
        return
    }

    val filteredUsers = remember(users, selectedRole, searchQuery) {
        users.filter { user ->
            val roleMatch = when (selectedRole) {
                "driver" -> user.roles.contains("driver")
                "loader" -> user.roles.contains("loader")
                "mechanic" -> user.roles.any { it in listOf("mechanic", "mechanic_lead", "welder", "electrician", "painter", "handyman") }
                "admin" -> user.roles.any { it in listOf("admin", "owner", "dispatcher", "accountant") }
                else -> true
            }
            val searchMatch = searchQuery.isBlank() || user.name.contains(searchQuery, ignoreCase = true)
            roleMatch && searchMatch
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Zinc50)
            .padding(20.dp)
    ) {
        // Заголовок с фирменным логотипом
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(bottom = 6.dp)
        ) {
            Surface(
                color = Color.White,
                shape = RoundedCornerShape(12.dp),
                shadowElevation = 2.dp,
                modifier = Modifier.size(52.dp)
            ) {
                Image(
                    painter = painterResource(R.drawable.logo),
                    contentDescription = "TK501 Logo",
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(4.dp)
                        .clip(RoundedCornerShape(8.dp))
                )
            }
            Spacer(modifier = Modifier.width(14.dp))
            Column {
                Text(
                    text = "TK501",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "Транспортная компания • Верхняя Салда",
                    fontSize = 12.sp,
                    color = Zinc500
                )
            }
        }

        Spacer(modifier = Modifier.height(18.dp))

        // Табы ролей (Водитель, Грузчик, Механик, Офис)
        TabRow(
            selectedTabIndex = when (selectedRole) {
                "driver" -> 0
                "loader" -> 1
                "mechanic" -> 2
                else -> 3
            },
            containerColor = Zinc100,
            contentColor = SaldaOrangePrimary
        ) {
            Tab(selected = selectedRole == "driver", onClick = { selectedRole = "driver"; errorMessage = null }) {
                Text("Водитель", modifier = Modifier.padding(10.dp), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            Tab(selected = selectedRole == "loader", onClick = { selectedRole = "loader"; errorMessage = null }) {
                Text("Грузчик", modifier = Modifier.padding(10.dp), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            Tab(selected = selectedRole == "mechanic", onClick = { selectedRole = "mechanic"; errorMessage = null }) {
                Text("Механик", modifier = Modifier.padding(10.dp), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            Tab(selected = selectedRole == "admin", onClick = { selectedRole = "admin"; errorMessage = null }) {
                Text("Офис", modifier = Modifier.padding(10.dp), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Поиск
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Поиск сотрудника...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Zinc500) },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { searchQuery = "" }) {
                        Icon(Icons.Default.Close, contentDescription = "Очистить", tint = Zinc500)
                    }
                }
            },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Color.White,
                unfocusedContainerColor = Color.White,
                focusedBorderColor = SaldaOrangePrimary,
                unfocusedBorderColor = Zinc200
            )
        )

        Spacer(modifier = Modifier.height(14.dp))

        if (errorMessage != null) {
            Surface(
                color = RedAlert.copy(alpha = 0.1f),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = errorMessage ?: "",
                        color = RedAlert,
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(onClick = { loadUsers() }) {
                        Text("Повторить", color = SaldaOrangePrimary, fontSize = 12.sp)
                    }
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
        }

        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = SaldaOrangePrimary)
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Загрузка списка...", color = Zinc500, fontSize = 13.sp)
                }
            }
        } else if (filteredUsers.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (searchQuery.isNotBlank()) "Никого не найдено" else "Нет сотрудников в данной роли",
                    color = Zinc500,
                    fontSize = 14.sp
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filteredUsers, key = { it.id }) { user ->
                    Card(
                        onClick = {
                            keyboardController?.hide()
                            if (user.hasPin || !user.pinCode.isNullOrBlank()) {
                                userForPin = user
                            } else {
                                onLoginSuccess(user, selectedRole)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        shape = RoundedCornerShape(12.dp),
                        border = CardDefaults.outlinedCardBorder()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    color = SaldaOrange50,
                                    shape = RoundedCornerShape(20.dp),
                                    modifier = Modifier.size(40.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            imageVector = Icons.Default.Person,
                                            contentDescription = null,
                                            tint = SaldaOrangePrimary,
                                            modifier = Modifier.size(22.dp)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(
                                        text = user.name,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 15.sp,
                                        color = Zinc900
                                    )
                                    Text(
                                        text = if (user.hasPin || !user.pinCode.isNullOrBlank()) "Вход по PIN-коду" else "Быстрый вход в 1 клик",
                                        fontSize = 12.sp,
                                        color = Zinc500
                                    )
                                }
                            }

                            if (user.hasPin || !user.pinCode.isNullOrBlank()) {
                                Icon(
                                    imageVector = Icons.Default.Lock,
                                    contentDescription = "Защищено PIN-кодом",
                                    tint = Zinc400,
                                    modifier = Modifier.size(18.dp)
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.Default.ChevronRight,
                                    contentDescription = "Войти",
                                    tint = SaldaOrangePrimary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
