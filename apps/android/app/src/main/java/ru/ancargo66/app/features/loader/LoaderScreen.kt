package ru.ancargo66.app.features.loader

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsWalk
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import ru.ancargo66.app.core.model.DriverFinanceData
import ru.ancargo66.app.core.model.User
import ru.ancargo66.app.core.network.SaldaApiClient
import ru.ancargo66.app.core.storage.SessionManager
import ru.ancargo66.app.ui.theme.*

@Composable
fun LoaderScreen(
    user: User,
    sessionManager: SessionManager,
    onLogout: () -> Unit
) {
    var isOnline by remember { mutableStateOf(sessionManager.isLoaderOnline()) }
    var currentAddress by remember { mutableStateOf(sessionManager.getLoaderAddress()) }
    var hasTransport by remember { mutableStateOf(sessionManager.hasLoaderTransport()) }
    var isAddressEditing by remember { mutableStateOf(false) }
    var isSaving by remember { mutableStateOf(false) }
    var financeData by remember { mutableStateOf<DriverFinanceData?>(null) }
    var actionInProgressId by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    val loadFinance = {
        scope.launch {
            try {
                financeData = SaldaApiClient.getDriverFinance(user.id)
            } catch (_: Exception) {}
        }
    }

    LaunchedEffect(user.id) {
        loadFinance()
    }

    val saveShift = { online: Boolean, addr: String, transport: Boolean ->
        isOnline = online
        currentAddress = addr
        hasTransport = transport
        sessionManager.saveLoaderShift(online, addr, transport)
        scope.launch {
            isSaving = true
            try {
                SaldaApiClient.updateLoaderShift(user.id, online, addr, transport)
            } catch (_: Exception) {}
            finally {
                isSaving = false
            }
        }
    }

    Scaffold(
        topBar = {
            Surface(
                color = Color.White,
                border = CardDefaults.outlinedCardBorder()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            color = SaldaOrange50,
                            shape = RoundedCornerShape(20.dp),
                            modifier = Modifier.size(44.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("👷", fontSize = 22.sp)
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(text = user.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Zinc900)
                            Text(text = "Грузчик • ПРР Биржа", fontSize = 12.sp, color = Zinc500)
                        }
                    }
                    IconButton(onClick = onLogout) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Выйти", tint = Zinc500)
                    }
                }
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(Zinc50)
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Главный блок: Тумблер готовности к работе
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isOnline) GreenOnline.copy(alpha = 0.10f) else Color.White
                    ),
                    shape = RoundedCornerShape(16.dp),
                    border = CardDefaults.outlinedCardBorder().copy(
                        brush = androidx.compose.ui.graphics.SolidColor(if (isOnline) GreenOnline else Zinc200),
                        width = if (isOnline) 2.dp else 1.dp
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "ВАШ СТАТУС ДЛЯ ДИСПЕТЧЕРА",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (isOnline) GreenOnline else Zinc400,
                                    letterSpacing = 1.sp
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = if (isOnline) "🟢 ГОТОВ РАБОТАТЬ (НА ЛИНИИ)" else "⚪ НЕ НА ЛИНИИ",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (isOnline) GreenOnline else Zinc900
                                )
                            }
                            Switch(
                                checked = isOnline,
                                onCheckedChange = { saveShift(it, currentAddress, hasTransport) },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.White,
                                    checkedTrackColor = GreenOnline
                                )
                            )
                        }

                        if (isOnline) {
                            Spacer(modifier = Modifier.height(14.dp))
                            HorizontalDivider(color = GreenOnline.copy(alpha = 0.2f))
                            Spacer(modifier = Modifier.height(12.dp))

                            // Где находится
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(text = "Где вы сейчас находитесь:", fontSize = 11.sp, color = Zinc500)
                                    Text(
                                        text = "📍 $currentAddress",
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Zinc900
                                    )
                                }
                                TextButton(onClick = { isAddressEditing = !isAddressEditing }) {
                                    Text(if (isAddressEditing) "Готово" else "Сменить", color = SaldaOrangePrimary, fontWeight = FontWeight.Bold)
                                }
                            }

                            if (isAddressEditing) {
                                Spacer(modifier = Modifier.height(6.dp))
                                OutlinedTextField(
                                    value = currentAddress,
                                    onValueChange = { saveShift(isOnline, it, hasTransport) },
                                    placeholder = { Text("Улица, дом или район города") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }

                            Spacer(modifier = Modifier.height(12.dp))

                            // Транспорт (доеду сам vs пеший)
                            Surface(
                                color = Color.White,
                                shape = RoundedCornerShape(10.dp),
                                border = CardDefaults.outlinedCardBorder(),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(if (hasTransport) "🚗" else "🚶", fontSize = 20.sp)
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Column {
                                            Text(
                                                text = if (hasTransport) "На своём авто (доеду сам)" else "Пеший (нужно забрать)",
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Zinc900
                                            )
                                            Text(
                                                text = if (hasTransport) "Мобилен, сам приеду на адрес" else "Водитель заберёт на машине",
                                                fontSize = 11.sp,
                                                color = Zinc500
                                            )
                                        }
                                    }
                                    Checkbox(
                                        checked = hasTransport,
                                        onCheckedChange = { saveShift(isOnline, currentAddress, it) },
                                        colors = CheckboxDefaults.colors(checkedColor = SaldaOrangePrimary)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Блок Зарплаты грузчика
            val sal = financeData?.salary
            val pending = sal?.pendingConfirmation ?: emptyList()
            val accumulated = sal?.accumulatedTotal ?: "0.00"

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(14.dp),
                    border = CardDefaults.outlinedCardBorder()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "ЗАРАБОТАНО (К ВЫПЛАТЕ)",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = Zinc400,
                            letterSpacing = 1.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "$accumulated ₽",
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Black,
                            color = GreenOnline
                        )
                        if (pending.isNotEmpty()) {
                            val sum = pending.sumOf { it.amount }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "+ ещё ${sum.toInt()} ₽ ожидает вашего подтверждения",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = AmberPending
                            )
                        }
                    }
                }
            }

            // Ожидающие подтверждения ЗП грузчика
            if (pending.isNotEmpty()) {
                item {
                    Text(
                        text = "ОЖИДАЮТ ПОДТВЕРЖДЕНИЯ (${pending.size})",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = AmberPending,
                        letterSpacing = 1.sp
                    )
                }

                items(pending, key = { it.id }) { item ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7)),
                        shape = RoundedCornerShape(10.dp),
                        border = CardDefaults.outlinedCardBorder().copy(
                            brush = androidx.compose.ui.graphics.SolidColor(AmberPending),
                            width = 1.dp
                        )
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(text = item.label, fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color(0xFF92400E))
                                    Text(text = item.context, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Zinc900)
                                }
                                Text(text = "+ ${item.amount.toInt()} ₽", fontWeight = FontWeight.Black, fontSize = 16.sp, color = GreenOnline)
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = {
                                        scope.launch {
                                            actionInProgressId = item.id
                                            SaldaApiClient.confirmEmployeePayroll(user.id, listOf(item.id))
                                            actionInProgressId = null
                                            loadFinance()
                                        }
                                    },
                                    modifier = Modifier.weight(1f),
                                    colors = ButtonDefaults.buttonColors(containerColor = GreenOnline),
                                    shape = RoundedCornerShape(8.dp),
                                    enabled = actionInProgressId != item.id
                                ) {
                                    Text(if (actionInProgressId == item.id) "..." else "✓ Подтвердить получение", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }

            // Карточка статуса радар
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(12.dp),
                    border = CardDefaults.outlinedCardBorder()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("📡", fontSize = 24.sp)
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = if (isOnline) "Вы видны в радаре диспетчера" else "Вы в офлайне",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Zinc900
                            )
                            Text(
                                text = if (isOnline) "Диспетчер видит ваш адрес «$currentAddress» и может назначить в рейс без звонка."
                                       else "Включите переключатель «На линии», чтобы получать заказы.",
                                fontSize = 12.sp,
                                color = Zinc500
                            )
                        }
                    }
                }
            }
        }
    }
}
