package ru.ancargo66.app.features.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import ru.ancargo66.app.core.model.User
import ru.ancargo66.app.core.network.SaldaApiClient
import ru.ancargo66.app.ui.theme.*

@Composable
fun PinScreen(
    user: User,
    onSuccess: () -> Unit,
    onCancel: () -> Unit
) {
    val keyboardController = LocalSoftwareKeyboardController.current
    LaunchedEffect(Unit) {
        keyboardController?.hide()
    }

    var enteredPin by remember { mutableStateOf("") }
    var isError by remember { mutableStateOf(false) }
    var isChecking by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val handleDigit = { digit: String ->
        if (enteredPin.length < 4 && !isChecking) {
            val newPin = enteredPin + digit
            enteredPin = newPin
            isError = false
            if (newPin.length == 4) {
                isChecking = true
                scope.launch {
                    val ok = try {
                        SaldaApiClient.verifyPin(user.id, newPin)
                    } catch (_: Exception) {
                        false
                    }
                    isChecking = false
                    if (ok) {
                        onSuccess()
                    } else {
                        isError = true
                        enteredPin = ""
                    }
                }
            }
        }
    }

    val handleBackspace = {
        if (enteredPin.isNotEmpty() && !isChecking) {
            enteredPin = enteredPin.dropLast(1)
            isError = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Zinc50)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Верхний блок: профиль сотрудника
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(top = 28.dp)
        ) {
            Surface(
                color = SaldaOrange50,
                shape = CircleShape,
                modifier = Modifier.size(72.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = null,
                        tint = SaldaOrangePrimary,
                        modifier = Modifier.size(36.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = user.name,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Zinc900
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = if (isChecking) "Проверка PIN-кода..." else if (isError) "Неверный PIN-код, попробуйте снова" else "Введите 4-значный PIN-код",
                fontSize = 14.sp,
                color = if (isError) RedAlert else Zinc500
            )

            Spacer(modifier = Modifier.height(28.dp))

            // 4 точки индикаторов (Т-Банк / Сбербанк стиль)
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                for (i in 0 until 4) {
                    val isFilled = i < enteredPin.length
                    Box(
                        modifier = Modifier
                            .size(16.dp)
                            .clip(CircleShape)
                            .background(
                                when {
                                    isError -> RedAlert
                                    isFilled -> SaldaOrangePrimary
                                    else -> Zinc200
                                }
                            )
                    )
                }
            }
        }

        // Цифровой пад (Keypad) 3x4
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            val rows = listOf(
                listOf("1", "2", "3"),
                listOf("4", "5", "6"),
                listOf("7", "8", "9"),
                listOf("", "0", "del")
            )

            for (row in rows) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    for (item in row) {
                        when (item) {
                            "" -> {
                                Spacer(modifier = Modifier.size(72.dp))
                            }
                            "del" -> {
                                Box(
                                    modifier = Modifier
                                        .size(72.dp)
                                        .clip(CircleShape)
                                        .clickable(enabled = !isChecking) { handleBackspace() },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.Backspace,
                                        contentDescription = "Удалить",
                                        tint = Zinc700,
                                        modifier = Modifier.size(26.dp)
                                    )
                                }
                            }
                            else -> {
                                KeypadButton(digit = item, onClick = { handleDigit(item) })
                            }
                        }
                    }
                }
            }
        }

        // Нижняя кнопка: Сменить сотрудника
        TextButton(
            onClick = onCancel,
            modifier = Modifier.padding(bottom = 12.dp)
        ) {
            Text(
                text = "Выбрать другого сотрудника",
                color = Zinc500,
                fontSize = 14.sp
            )
        }
    }
}

@Composable
fun KeypadButton(
    digit: String,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = Color.White,
        shadowElevation = 1.dp,
        modifier = Modifier.size(72.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Zinc200)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = digit,
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
                color = Zinc900
            )
        }
    }
}
