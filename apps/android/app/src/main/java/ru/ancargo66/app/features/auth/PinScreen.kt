package ru.ancargo66.app.features.auth

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.VpnKey
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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

    // Режим: если у пользователя нет PIN — включаем режим первичного создания PIN
    val isSetupMode = remember(user) { !user.hasPin && user.pinCode.isNullOrBlank() }

    var setupStep by remember { mutableStateOf(0) } // 0 = ввод первого PIN, 1 = подтверждение PIN
    var firstEnteredPin by remember { mutableStateOf("") }

    var enteredPin by remember { mutableStateOf("") }
    var isError by remember { mutableStateOf(false) }
    var customErrorMessage by remember { mutableStateOf<String?>(null) }
    var isProcessing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val handleDigit = { digit: String ->
        if (enteredPin.length < 4 && !isProcessing) {
            val newPin = enteredPin + digit
            enteredPin = newPin
            isError = false
            customErrorMessage = null

            if (newPin.length == 4) {
                if (isSetupMode) {
                    if (setupStep == 0) {
                        // Шаг 1 завершен, переходим к подтверждению
                        firstEnteredPin = newPin
                        enteredPin = ""
                        setupStep = 1
                    } else {
                        // Шаг 2: проверка совпадения
                        if (newPin == firstEnteredPin) {
                            isProcessing = true
                            scope.launch {
                                val ok = try {
                                    SaldaApiClient.setPin(user.id, newPin)
                                } catch (_: Exception) {
                                    false
                                }
                                isProcessing = false
                                if (ok) {
                                    onSuccess()
                                } else {
                                    isError = true
                                    customErrorMessage = "Ошибка сети при сохранении PIN. Повторите попытку"
                                    enteredPin = ""
                                    firstEnteredPin = ""
                                    setupStep = 0
                                }
                            }
                        } else {
                            // Не совпали!
                            isError = true
                            customErrorMessage = "PIN-коды не совпали. Попробуйте снова"
                            enteredPin = ""
                            firstEnteredPin = ""
                            setupStep = 0
                        }
                    }
                } else {
                    // Режим обычной авторизации (Verify)
                    isProcessing = true
                    scope.launch {
                        val ok = try {
                            SaldaApiClient.verifyPin(user.id, newPin)
                        } catch (_: Exception) {
                            false
                        }
                        isProcessing = false
                        if (ok) {
                            onSuccess()
                        } else {
                            isError = true
                            customErrorMessage = "Неверный PIN-код, попробуйте снова"
                            enteredPin = ""
                        }
                    }
                }
            }
        }
    }

    val handleBackspace = {
        if (enteredPin.isNotEmpty() && !isProcessing) {
            enteredPin = enteredPin.dropLast(1)
            isError = false
            customErrorMessage = null
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
            modifier = Modifier.padding(top = 20.dp)
        ) {
            Surface(
                color = if (isSetupMode) Color(0xFFFEF3C7) else SaldaOrange50,
                shape = CircleShape,
                modifier = Modifier.size(68.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = if (isSetupMode) Icons.Default.VpnKey else Icons.Default.Person,
                        contentDescription = null,
                        tint = if (isSetupMode) AmberWarning else SaldaOrangePrimary,
                        modifier = Modifier.size(34.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = user.name,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Zinc900
            )

            Spacer(modifier = Modifier.height(4.dp))

            if (isSetupMode) {
                Surface(
                    color = SaldaOrange50,
                    shape = RoundedCornerShape(6.dp),
                    modifier = Modifier.padding(bottom = 6.dp)
                ) {
                    Text(
                        text = if (setupStep == 0) "ШАГ 1 ИЗ 2: СОЗДАНИЕ PIN" else "ШАГ 2 ИЗ 2: ПОДТВЕРЖДЕНИЕ",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = SaldaOrangePrimary,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }
            }

            Text(
                text = when {
                    isProcessing -> if (isSetupMode) "Сохранение вашего личного PIN..." else "Проверка PIN-кода..."
                    isError -> customErrorMessage ?: "Ошибка ввода, попробуйте снова"
                    isSetupMode && setupStep == 0 -> "Придумайте личный 4-значный PIN-код"
                    isSetupMode && setupStep == 1 -> "Повторите придуманный PIN-код"
                    else -> "Введите ваш 4-значный PIN-код"
                },
                fontSize = 14.sp,
                fontWeight = if (isError) FontWeight.Bold else FontWeight.Medium,
                color = if (isError) RedAlert else Zinc700,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 16.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))

            // 4 точки индикаторов (Банковский стиль)
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
            verticalArrangement = Arrangement.spacedBy(14.dp)
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
                                Spacer(modifier = Modifier.size(68.dp))
                            }
                            "del" -> {
                                Box(
                                    modifier = Modifier
                                        .size(68.dp)
                                        .clip(CircleShape)
                                        .clickable(enabled = !isProcessing) { handleBackspace() },
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
            modifier = Modifier.padding(bottom = 8.dp)
        ) {
            Text(
                text = "Выбрать другого сотрудника",
                color = Zinc700,
                fontWeight = FontWeight.Medium,
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
        shadowElevation = 2.dp,
        modifier = Modifier.size(68.dp),
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
