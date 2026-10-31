package ru.ancargo66.app.features.loader

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
    var activeTab by remember { mutableStateOf(0) } // 0: Начисления, 1: Выплаты
    var selectedAccrualForDetails by remember { mutableStateOf<ru.ancargo66.app.core.model.SalaryAccrualItem?>(null) }
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

            // Карточка статуса радар (Диспетчер + Водители)
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(14.dp),
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
                                text = if (isOnline) "Вы видны на радаре диспетчера и водителей" else "Вы сейчас в офлайне",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = Zinc900
                            )
                            Text(
                                text = if (isOnline) "Диспетчер и водители видят статус «На линии», адрес «$currentAddress» и вы подняты в топ заявок."
                                       else "Включите статус «На линии», чтобы получать заказы на погрузку и разгрузку.",
                                fontSize = 11.sp,
                                color = Zinc500
                            )
                        }
                    }
                }
            }

            // Блок Зарплаты грузчика
            val sal = financeData?.salary
            val pending = sal?.pendingConfirmation ?: emptyList()
            val accumulated = sal?.accumulatedTotal ?: "0.00"
            val totalPaid = sal?.totalPaid ?: "0.00"
            val accruals = sal?.accruals ?: emptyList()
            val payouts = sal?.payouts ?: emptyList()

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(14.dp),
                    border = CardDefaults.outlinedCardBorder()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Top
                        ) {
                            Column {
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
                            }
                            if (totalPaid != "0.00" && totalPaid.isNotBlank()) {
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        text = "ВЫПЛАЧЕНО",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Zinc400,
                                        letterSpacing = 1.sp
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = "$totalPaid ₽",
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Zinc700
                                    )
                                }
                            }
                        }

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

            // Переключатель вкладок: Начисления / Выплаты
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.White, RoundedCornerShape(12.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    listOf("📦 Начисления (${accruals.size})" to 0, "💳 Выплаты (${payouts.size})" to 1).forEach { (title, tabIdx) ->
                        Surface(
                            modifier = Modifier
                                .weight(1f)
                                .clickable { activeTab = tabIdx },
                            color = if (activeTab == tabIdx) Zinc900 else Color.Transparent,
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text(
                                text = title,
                                modifier = Modifier.padding(vertical = 8.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (activeTab == tabIdx) Color.White else Zinc600
                            )
                        }
                    }
                }
            }

            // Список Начислений (Dense 1-Line Layout)
            if (activeTab == 0) {
                if (accruals.isEmpty()) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(10.dp),
                            border = CardDefaults.outlinedCardBorder()
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(20.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("Начислений пока нет", color = Zinc500, fontSize = 13.sp)
                            }
                        }
                    }
                } else {
                    items(accruals, key = { it.id }) { acc ->
                        val isPaid = acc.settlementStatus == "completed"
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedAccrualForDetails = acc },
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(10.dp),
                            border = CardDefaults.outlinedCardBorder()
                        ) {
                            // Строго 1 строка
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f, fill = false)
                                ) {
                                    Text("📦", fontSize = 14.sp)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = if (acc.tripNumber != null) "Рейс №${acc.tripNumber}" else "ПРР",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = Zinc900
                                    )
                                    if (!acc.driverName.isNullOrBlank()) {
                                        Text(
                                            text = " · Вод. ${acc.driverName}",
                                            fontSize = 11.sp,
                                            color = Zinc600,
                                            maxLines = 1
                                        )
                                    }
                                    if (!acc.date.isNullOrBlank()) {
                                        val dateShort = acc.date.substringBefore("T").split("-").let {
                                            if (it.size == 3) "${it[2]}.${it[1]}" else ""
                                        }
                                        if (dateShort.isNotBlank()) {
                                            Text(
                                                text = " · $dateShort",
                                                fontSize = 10.sp,
                                                color = Zinc400
                                            )
                                        }
                                    }
                                }

                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    modifier = Modifier.padding(start = 6.dp)
                                ) {
                                    Surface(
                                        color = if (isPaid) GreenOnline.copy(alpha = 0.12f) else AmberPending.copy(alpha = 0.12f),
                                        shape = RoundedCornerShape(4.dp)
                                    ) {
                                        Text(
                                            text = if (isPaid) "Выплачено" else "К выплате",
                                            color = if (isPaid) GreenOnline else Color(0xFFB45309),
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                        )
                                    }
                                    Text(
                                        text = "+ ${acc.amount.toInt()} ₽",
                                        fontWeight = FontWeight.Black,
                                        fontSize = 14.sp,
                                        color = GreenOnline
                                    )
                                }
                            }
                        }
                    }
                }
            } else {
                // Список Выплат
                if (payouts.isEmpty()) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(10.dp),
                            border = CardDefaults.outlinedCardBorder()
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(20.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("Выплат пока не производилось", color = Zinc500, fontSize = 13.sp)
                            }
                        }
                    }
                } else {
                    items(payouts, key = { it.id }) { pay ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(10.dp),
                            border = CardDefaults.outlinedCardBorder()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f, fill = false)
                                ) {
                                    Text("💳", fontSize = 14.sp)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = pay.walletName ?: "Касса",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = Zinc900
                                    )
                                    if (!pay.date.isNullOrBlank()) {
                                        val dateShort = pay.date.substringBefore("T").split("-").let {
                                            if (it.size == 3) "${it[2]}.${it[1]}" else ""
                                        }
                                        if (dateShort.isNotBlank()) {
                                            Text(
                                                text = " · $dateShort",
                                                fontSize = 10.sp,
                                                color = Zinc400
                                            )
                                        }
                                    }
                                }

                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Surface(
                                        color = GreenOnline.copy(alpha = 0.12f),
                                        shape = RoundedCornerShape(4.dp)
                                    ) {
                                        Text(
                                            text = "✓ Выдано",
                                            color = GreenOnline,
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                        )
                                    }
                                    Text(
                                        text = "${pay.amount.toInt()} ₽",
                                        fontWeight = FontWeight.Black,
                                        fontSize = 14.sp,
                                        color = Zinc900
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Модальное окно деталей начисления
    selectedAccrualForDetails?.let { acc ->
        AlertDialog(
            onDismissRequest = { selectedAccrualForDetails = null },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("📦", fontSize = 18.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (acc.tripNumber != null) "Рейс №${acc.tripNumber}" else "Начисление ПРР",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Сумма к выплате:", fontSize = 12.sp, color = Zinc500)
                        Text("+ ${acc.amount.toInt()} ₽", fontSize = 14.sp, fontWeight = FontWeight.Black, color = GreenOnline)
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Статус:", fontSize = 12.sp, color = Zinc500)
                        Text(
                            text = if (acc.settlementStatus == "completed") "✓ Выплачено" else "⏳ К выплате",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (acc.settlementStatus == "completed") GreenOnline else AmberPending
                        )
                    }
                    if (!acc.driverName.isNullOrBlank()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Водитель:", fontSize = 12.sp, color = Zinc500)
                            Text(acc.driverName, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Zinc900)
                        }
                    }
                    if (!acc.assetName.isNullOrBlank()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Автомобиль / Объект:", fontSize = 12.sp, color = Zinc500)
                            Text(acc.assetName, fontSize = 12.sp, color = Zinc900)
                        }
                    }
                    if (!acc.date.isNullOrBlank()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Дата работы:", fontSize = 12.sp, color = Zinc500)
                            Text(acc.date.replace("T", " ").substringBefore("."), fontSize = 12.sp, color = Zinc800)
                        }
                    }
                    if (!acc.description.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Описание:", fontSize = 11.sp, color = Zinc400, fontWeight = FontWeight.Bold)
                        Surface(
                            color = Zinc100,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = acc.description,
                                fontSize = 12.sp,
                                color = Zinc800,
                                modifier = Modifier.padding(8.dp)
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { selectedAccrualForDetails = null }) {
                    Text("Понятно", fontWeight = FontWeight.Bold, color = SaldaOrangePrimary)
                }
            }
        )
    }
}
