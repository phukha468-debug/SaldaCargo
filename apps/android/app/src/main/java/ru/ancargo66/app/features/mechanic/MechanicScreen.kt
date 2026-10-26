package ru.ancargo66.app.features.mechanic

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import ru.ancargo66.app.core.model.*
import ru.ancargo66.app.core.network.SaldaApiClient
import ru.ancargo66.app.features.auth.PinScreen
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.roundToLong

// ── Цветовая палитра Варианта 2: Стиль Сбербанк (Светлая изумрудная) ────────
private val SberBg = Color(0xFFF2F4F7)
private val SberCard = Color(0xFFFFFFFF)
private val SberGreen = Color(0xFF21A038)
private val SberDarkGreen = Color(0xFF0E7C5B)
private val SberMint = Color(0xFFE8F7EC)
private val SberTextPrimary = Color(0xFF0F172A)
private val SberTextSecondary = Color(0xFF64748B)
private val SberBorder = Color(0xFFE2E8F0)
private val SberAmberBg = Color(0xFFFFFBEB)
private val SberAmberBorder = Color(0xFFFCD34D)
private val SberAmberText = Color(0xFF92400E)
private val SberBlueBg = Color(0xFFEFF6FF)
private val SberBlueText = Color(0xFF1D4ED8)
private val SberRedBg = Color(0xFFFEF2F2)
private val SberRedText = Color(0xFFDC2626)

private fun formatRub(amount: Double): String {
    val nf = NumberFormat.getNumberInstance(Locale("ru", "RU"))
    nf.maximumFractionDigits = 0
    return "${nf.format(amount.roundToLong())} ₽"
}

private fun formatIsoDateShort(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val clean = iso.take(10)
    val parts = clean.split("-")
    if (parts.size != 3) return clean
    val months = listOf(
        "янв", "фев", "мар", "апр", "мая", "июн",
        "июл", "авг", "сен", "окт", "ноя", "дек"
    )
    val d = parts[2].toIntOrNull() ?: return clean
    val m = (parts[1].toIntOrNull() ?: 1) - 1
    val mStr = if (m in 0..11) months[m] else parts[1]
    return "$d $mStr ${parts[0]}"
}

private fun isOilOrFilterWorkName(name: String?): Boolean {
    if (name.isNullOrBlank()) return false
    val lower = name.lowercase(Locale.getDefault())
    return lower.contains("масл") || lower.contains("фильтр") || lower.contains("то ") || lower.endsWith(" то")
}

@Composable
fun MechanicScreen(
    user: User,
    onLogout: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val cal = remember { Calendar.getInstance() }
    val currentYear = remember { cal.get(Calendar.YEAR) }
    val currentMonth = remember { cal.get(Calendar.MONTH) + 1 }

    var orders by remember { mutableStateOf<List<MechanicOrder>>(emptyList()) }
    var salaryData by remember { mutableStateOf(MechanicSalaryData()) }
    var assets by remember { mutableStateOf<List<Asset>>(SaldaApiClient.getCachedAssets() ?: emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    // Навигация внутри кабинета механика
    var showCreateOrderScreen by rememberSaveable { mutableStateOf(false) }
    var selectedOrderId by rememberSaveable { mutableStateOf<String?>(null) }
    var showSalaryScreen by rememberSaveable { mutableStateOf(false) }
    var showAllOrdersScreen by rememberSaveable { mutableStateOf(false) }
    var showChangePinScreen by rememberSaveable { mutableStateOf(false) }
    var rejectingItemId by remember { mutableStateOf<String?>(null) }
    var isConfirmingPayroll by remember { mutableStateOf(false) }

    val refreshAll = {
        scope.launch {
            isLoading = orders.isEmpty()
            try {
                coroutineScope {
                    val ordersDef = async { SaldaApiClient.getMechanicOrders(user.id) }
                    val salaryDef = async { SaldaApiClient.getMechanicSalary(user.id, currentYear, currentMonth) }
                    val assetsDef = async {
                        try {
                            SaldaApiClient.getDriverAssets(user.id)
                        } catch (_: Exception) {
                            emptyList()
                        }
                    }
                    orders = ordersDef.await()
                    salaryData = salaryDef.await()
                    val loadedAssets = assetsDef.await()
                    if (loadedAssets.isNotEmpty()) assets = loadedAssets
                }
            } catch (_: Exception) {
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(user.id) {
        refreshAll()
    }

    // 1. Экран смены PIN-кода
    if (showChangePinScreen) {
        PinScreen(
            user = user,
            isChangePinMode = true,
            onSuccess = { showChangePinScreen = false },
            onCancel = { showChangePinScreen = false }
        )
        return
    }

    // 2. Экран создания нового заказ-наряда (5 шагов)
    if (showCreateOrderScreen) {
        CreateMechanicOrderScreen(
            user = user,
            assets = assets,
            rates = salaryData.rates,
            onBack = { showCreateOrderScreen = false },
            onCreated = {
                showCreateOrderScreen = false
                refreshAll()
            }
        )
        return
    }

    // 3. Экран деталей / редактирования заказ-наряда
    val detailOrderId = selectedOrderId
    if (detailOrderId != null) {
        MechanicOrderDetailScreen(
            orderId = detailOrderId,
            user = user,
            onBack = {
                selectedOrderId = null
                refreshAll()
            }
        )
        return
    }

    // 4. Экран зарплаты и выплат
    if (showSalaryScreen) {
        MechanicSalaryScreen(
            user = user,
            onBack = {
                showSalaryScreen = false
                refreshAll()
            },
            onOpenOrder = { ordId ->
                showSalaryScreen = false
                selectedOrderId = ordId
            }
        )
        return
    }

    // 5. Экран истории всех нарядов с фильтрами
    if (showAllOrdersScreen) {
        AllMechanicOrdersScreen(
            orders = orders,
            onBack = { showAllOrdersScreen = false },
            onOpenCreate = {
                showAllOrdersScreen = false
                showCreateOrderScreen = true
            },
            onOpenOrder = { ordId ->
                showAllOrdersScreen = false
                selectedOrderId = ordId
            }
        )
        return
    }

    val activeOrders = orders.filter {
        it.status == "in_progress" || it.status == "created" || it.lifecycleStatus == "returned"
    }
    val reviewOrders = orders.filter {
        it.status == "completed" && it.lifecycleStatus == "draft"
    }
    val closedOrders = orders.filter {
        it.lifecycleStatus == "approved"
    }.take(5)

    val pendingItems = salaryData.pendingConfirmation
    val payouts = salaryData.payouts

    Scaffold(
        containerColor = SberBg,
        topBar = {
            Surface(
                color = SberCard,
                shadowElevation = 1.dp
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
                            color = SberMint,
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.size(44.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    Icons.Default.Build,
                                    contentDescription = null,
                                    tint = SberGreen,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = user.name,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SberTextPrimary
                                )
                            }
                            Text(
                                text = "СТО TK501 · Кабинет механика",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = SberGreen
                            )
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { refreshAll() }) {
                            Icon(Icons.Default.Refresh, contentDescription = "Обновить", tint = SberTextSecondary)
                        }
                        IconButton(onClick = { showChangePinScreen = true }) {
                            Icon(Icons.Default.Lock, contentDescription = "Сменить PIN", tint = SberTextSecondary)
                        }
                        IconButton(onClick = onLogout) {
                            Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Выйти", tint = SberTextSecondary)
                        }
                    }
                }
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // ── 1. БАНКОВСКАЯ КАРТОЧКА ЗАРПЛАТЫ (Стиль Сбербанк) ──
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showSalaryScreen = true },
                    colors = CardDefaults.cardColors(containerColor = SberCard),
                    shape = RoundedCornerShape(24.dp),
                    border = BorderStroke(1.dp, SberBorder)
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .clip(CircleShape)
                                        .background(SberGreen)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "БАЛАНС МЕХАНИКА",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SberTextSecondary
                                )
                            }
                            Surface(
                                color = SberMint,
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text(
                                    text = "Все выплаты →",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SberDarkGreen,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = "К выплате сейчас",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = SberTextSecondary
                        )
                        Text(
                            text = formatRub(salaryData.summary.toPay),
                            fontSize = 30.sp,
                            fontWeight = FontWeight.Black,
                            color = SberTextPrimary
                        )

                        if (salaryData.summary.draftPay > 0) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Surface(
                                color = SberMint,
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text(
                                    text = "⏳ На проверке в гараже: +${formatRub(salaryData.summary.draftPay)}",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SberDarkGreen,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))
                        HorizontalDivider(color = SberBorder)
                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Surface(
                                color = SberBg,
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(
                                        text = "ЗАКРЫТЫЕ НАРЯДЫ (МЕС.)",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = SberTextSecondary
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = formatRub(salaryData.summary.totalAccrued),
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SberTextPrimary
                                    )
                                }
                            }
                            Surface(
                                color = SberBg,
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(
                                        text = "ВЫПЛАЧЕНО (МЕС.)",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = SberTextSecondary
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = formatRub(salaryData.summary.totalPaid),
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SberGreen
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ── 2. ГЛАВНАЯ КНОПКА: ОТКРЫТЬ ЗАКАЗ-НАРЯД ──
            item {
                Button(
                    onClick = { showCreateOrderScreen = true },
                    colors = ButtonDefaults.buttonColors(containerColor = SberGreen),
                    shape = RoundedCornerShape(22.dp),
                    contentPadding = PaddingValues(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                color = Color.White.copy(alpha = 0.2f),
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.size(44.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(Icons.Default.Add, contentDescription = null, tint = Color.White)
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = "Открыть заказ-наряд",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White
                                )
                                Text(
                                    text = "Свой авто (${salaryData.rates.hourlyRateOwn.toInt()} ₽/ч) · Клиент (${salaryData.rates.hourlyRateClient.toInt()} ₽/ч)",
                                    fontSize = 12.sp,
                                    color = Color.White.copy(alpha = 0.9f)
                                )
                            }
                        }
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color.White)
                    }
                }
            }

            // ── 3. ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ ЗП ──
            if (pendingItems.isNotEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = SberCard),
                        shape = RoundedCornerShape(22.dp),
                        border = BorderStroke(1.5.dp, SberAmberBorder)
                    ) {
                        Column {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(SberAmberBg)
                                    .padding(horizontal = 16.dp, vertical = 12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = "⏳ Подтвердите начисленную ЗП",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SberAmberText
                                    )
                                    Text(
                                        text = "${pendingItems.size} начислений по закрытым нарядам",
                                        fontSize = 11.sp,
                                        color = SberAmberText
                                    )
                                }
                                if (pendingItems.size > 1) {
                                    Button(
                                        onClick = {
                                            scope.launch {
                                                isConfirmingPayroll = true
                                                SaldaApiClient.confirmEmployeePayroll(user.id)
                                                isConfirmingPayroll = false
                                                refreshAll()
                                            }
                                        },
                                        enabled = !isConfirmingPayroll,
                                        colors = ButtonDefaults.buttonColors(containerColor = SberGreen),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                    ) {
                                        Text("Подтвердить всё", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }

                            pendingItems.forEachIndexed { index, item ->
                                if (index > 0) HorizontalDivider(color = SberBorder)
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.Top
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = "ЗАРПЛАТА ЗА ЗАКРЫТЫЙ НАРЯД",
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = SberTextSecondary
                                            )
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Text(
                                                text = item.context,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = SberTextPrimary
                                            )
                                        }
                                        Text(
                                            text = "+${formatRub(item.amount)}",
                                            fontSize = 17.sp,
                                            fontWeight = FontWeight.Black,
                                            color = SberGreen
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Button(
                                            onClick = {
                                                scope.launch {
                                                    isConfirmingPayroll = true
                                                    SaldaApiClient.confirmEmployeePayroll(user.id, listOf(item.id))
                                                    isConfirmingPayroll = false
                                                    refreshAll()
                                                }
                                            },
                                            enabled = !isConfirmingPayroll,
                                            colors = ButtonDefaults.buttonColors(containerColor = SberGreen),
                                            shape = RoundedCornerShape(12.dp),
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Text("✓ Подтвердить", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        }
                                        OutlinedButton(
                                            onClick = { rejectingItemId = item.id },
                                            enabled = !isConfirmingPayroll,
                                            shape = RoundedCornerShape(12.dp)
                                        ) {
                                            Text("Не согласен", fontSize = 12.sp, color = SberTextPrimary)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ── 4. АКТИВНЫЕ НАРЯДЫ В РАБОТЕ ──
            if (activeOrders.isNotEmpty()) {
                item {
                    Text(
                        text = "🔧 СЕЙЧАС В РАБОТЕ (${activeOrders.size})",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = SberTextSecondary
                    )
                }
                items(activeOrders, key = { "active_${it.id}" }) { ord ->
                    MechanicOrderCard(order = ord, onClick = { selectedOrderId = ord.id })
                }
            }

            // ── 5. НА ПРОВЕРКЕ В ГАРАЖЕ ──
            if (reviewOrders.isNotEmpty()) {
                item {
                    Text(
                        text = "⏳ НА ПРОВЕРКЕ В ГАРАЖЕ (${reviewOrders.size})",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = SberTextSecondary
                    )
                }
                items(reviewOrders, key = { "review_${it.id}" }) { ord ->
                    MechanicOrderCard(order = ord, onClick = { selectedOrderId = ord.id })
                }
            }

            // ── 6. ИСТОРИЯ ЗАКРЫТЫХ НАРЯДОВ ──
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "ЗАКРЫТЫЕ НАРЯДЫ И ЗП",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = SberTextSecondary
                    )
                    Text(
                        text = "Все наряды (${orders.size}) →",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = SberGreen,
                        modifier = Modifier.clickable { showAllOrdersScreen = true }
                    )
                }
            }

            if (isLoading) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(120.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = SberGreen)
                    }
                }
            } else if (closedOrders.isEmpty() && activeOrders.isEmpty() && reviewOrders.isEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = SberCard),
                        shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(1.dp, SberBorder)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text("📋", fontSize = 30.sp)
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Пока нет открытых или закрытых нарядов",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = SberTextPrimary
                            )
                            Text(
                                text = "Нажмите «Открыть заказ-наряд», чтобы записать выполненные работы и запчасти",
                                fontSize = 12.sp,
                                color = SberTextSecondary
                            )
                        }
                    }
                }
            } else {
                items(closedOrders, key = { "closed_${it.id}" }) { ord ->
                    MechanicOrderCard(order = ord, onClick = { selectedOrderId = ord.id })
                }
            }

            // ── 7. ИСТОРИЯ ВЫПЛАТ ОТ ГАРАЖА ──
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "ИСТОРИЯ ВЫПЛАТ (КАССА / КАРТА)",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = SberTextSecondary
                    )
                    Text(
                        text = "Подробнее →",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = SberGreen,
                        modifier = Modifier.clickable { showSalaryScreen = true }
                    )
                }
            }

            if (payouts.isEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = SberCard),
                        shape = RoundedCornerShape(18.dp),
                        border = BorderStroke(1.dp, SberBorder)
                    ) {
                        Text(
                            text = "История выплат наличными, переводов на карту и авансов отображается здесь",
                            fontSize = 12.sp,
                            color = SberTextSecondary,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }
            } else {
                items(payouts.take(4), key = { "payout_${it.id}" }) { p ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = SberCard),
                        shape = RoundedCornerShape(16.dp),
                        border = BorderStroke(1.dp, SberBorder)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(
                                        color = if (p.isAdvance) SberAmberBg else SberMint,
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text(
                                            text = p.walletLabel,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = if (p.isAdvance) SberAmberText else SberDarkGreen,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = formatIsoDateShort(p.date),
                                        fontSize = 11.sp,
                                        color = SberTextSecondary
                                    )
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = p.description,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SberTextPrimary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                            Text(
                                text = "+${formatRub(p.amount)}",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Black,
                                color = SberGreen
                            )
                        }
                    }
                }
            }
        }
    }

    // Диалог отклонения начисления ЗП
    if (rejectingItemId != null) {
        AlertDialog(
            onDismissRequest = { rejectingItemId = null },
            title = { Text("Не согласны с суммой ЗП?", fontWeight = FontWeight.ExtraBold) },
            text = {
                Text("Начисление вернётся администратору на пересмотр и корректировку суммы.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        val idToReject = rejectingItemId ?: return@Button
                        scope.launch {
                            SaldaApiClient.rejectEmployeePayroll(user.id, idToReject)
                            rejectingItemId = null
                            refreshAll()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = SberRedText)
                ) {
                    Text("Отклонить", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { rejectingItemId = null }) {
                    Text("Вернуться")
                }
            }
        )
    }
}

// ── КАРТОЧКА ЗАКАЗ-НАРЯДА В СПИСКЕ ──────────────────────────────────────────

@Composable
private fun MechanicOrderCard(
    order: MechanicOrder,
    onClick: () -> Unit
) {
    val isOwn = order.machineType == "own"
    val isApproved = order.lifecycleStatus == "approved"
    val isReturned = order.lifecycleStatus == "returned"
    val isCompleted = order.status == "completed"
    val pay = if (order.mechanicPay > 0) order.mechanicPay else order.estimatedPay

    val vehicleTitle = if (isOwn) {
        order.asset?.shortName?.takeIf { it.isNotBlank() } ?: "Свой автопарк"
    } else {
        order.clientVehicleBrand?.takeIf { it.isNotBlank() }
            ?: order.clientVehicleModel?.takeIf { it.isNotBlank() }
            ?: "Клиентский авто"
    }
    val regNum = if (isOwn) order.asset?.regNumber else order.clientVehicleReg
    val odo = if (order.odometerEnd > 0L) order.odometerEnd else order.odometerStart

    val totalMins = if (order.totalMinutes > 0L) {
        order.totalMinutes
    } else {
        order.works.sumOf { it.effectiveMinutes }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = SberCard),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, SberBorder)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = "Наряд #${order.orderNumber}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = SberTextPrimary
                        )
                        Surface(
                            color = if (isOwn) SberBg else SberBlueBg,
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = if (isOwn) "🚛 Свой" else "🚗 Клиент",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = if (isOwn) SberTextSecondary else SberBlueText,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                        val dateText = remember(order.startedAt, order.completedAt, order.createdAt) {
                            val s = order.startedAt?.take(10) ?: order.createdAt?.take(10)
                            val c = order.completedAt?.take(10)
                            if (!s.isNullOrBlank() && !c.isNullOrBlank() && s != c) "$s — $c"
                            else formatIsoDateShort(order.startedAt ?: order.createdAt)
                        }
                        Text(
                            text = dateText,
                            fontSize = 11.sp,
                            color = SberTextSecondary
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = buildString {
                            append(vehicleTitle)
                            if (!regNum.isNullOrBlank()) append(" · $regNum")
                            if (odo > 0L) append(" · $odo км")
                        },
                        fontSize = 14.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = SberTextPrimary
                    )
                }

                Column(horizontalAlignment = Alignment.End) {
                    if (pay > 0) {
                        Text(
                            text = "+${formatRub(pay)}",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Black,
                            color = SberGreen
                        )
                    } else {
                        Text(text = "—", fontSize = 13.sp, color = SberTextSecondary)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    val (badgeBg, badgeColor, badgeText) = when {
                        isApproved -> Triple(SberMint, SberDarkGreen, "✓ Закрыт")
                        isReturned -> Triple(SberRedBg, SberRedText, "На доработке")
                        isCompleted -> Triple(SberAmberBg, SberAmberText, "⏳ На проверке")
                        else -> Triple(SberBlueBg, SberBlueText, "В работе")
                    }
                    Surface(color = badgeBg, shape = RoundedCornerShape(8.dp)) {
                        Text(
                            text = badgeText,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = badgeColor,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            if (order.works.isNotEmpty()) {
                Spacer(modifier = Modifier.height(10.dp))
                HorizontalDivider(color = SberBorder)
                Spacer(modifier = Modifier.height(8.dp))
                order.works.take(3).forEachIndexed { idx, w ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "${idx + 1}. ${w.displayName}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = SberTextPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "${w.effectiveMinutes} мин",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = SberTextSecondary
                        )
                    }
                }
                if (order.works.size > 3) {
                    Text(
                        text = "+ ещё ${order.works.size - 3} работ...",
                        fontSize = 11.sp,
                        color = SberTextSecondary
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "⏱ Итого: $totalMins мин",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = SberTextSecondary
                )
                if (order.parts.isNotEmpty() || order.partsProvidedByService) {
                    Surface(color = SberMint, shape = RoundedCornerShape(6.dp)) {
                        Text(
                            text = "🔩 Запчасти сервиса: ${order.parts.size} поз.",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = SberDarkGreen,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

// ── ЭКРАН ОТКРЫТИЯ / СОЗДАНИЯ ЗАКАЗ-НАРЯДА (5 ШАГОВ) ────────────────────────

@Composable
private fun CreateMechanicOrderScreen(
    user: User,
    assets: List<Asset>,
    rates: MechanicRates,
    onBack: () -> Unit,
    onCreated: () -> Unit
) {
    BackHandler { onBack() }
    val scope = rememberCoroutineScope()
    val todayStr = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()) }

    // 1. Даты начала и окончания
    var startDate by remember { mutableStateOf(todayStr) }
    var endDate by remember { mutableStateOf(todayStr) }
    // 2. Свой автомобиль или клиентский
    var machineType by remember { mutableStateOf("client") } // "own" | "client"
    // 3. Данные автомобиля
    var selectedAssetId by remember { mutableStateOf(assets.firstOrNull()?.id ?: "") }
    var showAssetDropdown by remember { mutableStateOf(false) }
    var clientModel by remember { mutableStateOf("") }
    var clientReg by remember { mutableStateOf("") }
    var odometer by remember { mutableStateOf("") }

    // 4. Перечень работ (1 строка - название, 2 строка - минуты)
    var works by remember { mutableStateOf<List<MechanicWorkDraftInput>>(emptyList()) }
    var workNameInput by remember { mutableStateOf("") }
    var workMinutesInput by remember { mutableStateOf("") }

    // 5. Чекбокс запчастей автосервиса
    var partsProvidedByService by remember { mutableStateOf(false) }
    var parts by remember { mutableStateOf<List<MechanicPartDraftInput>>(emptyList()) }
    var partNameInput by remember { mutableStateOf("") }
    var partQtyInput by remember { mutableStateOf("1") }

    var mechanicNote by remember { mutableStateOf("") }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }

    val activeRate = if (machineType == "own") rates.hourlyRateOwn else rates.hourlyRateClient
    val salaryPct = rates.mechanicSalaryPct
    val calcWorkPay = { mins: Int -> ((mins / 60.0) * activeRate * (salaryPct / 100.0)) }

    val pendingMins = if (workNameInput.isNotBlank()) (workMinutesInput.toIntOrNull() ?: 0) else 0
    val totalMinutes = works.sumOf { it.minutes } + pendingMins
    val totalEstimatedPay = calcWorkPay(totalMinutes)

    val hasOilWork = works.any { isOilOrFilterWorkName(it.name) } || isOilOrFilterWorkName(workNameInput)

    val submitForm = { submitImmediately: Boolean ->
        scope.launch {
            errorMsg = null
            val finalWorks = works.toMutableList()
            val typedMins = workMinutesInput.toIntOrNull() ?: 0
            if (workNameInput.isNotBlank() && typedMins > 0) {
                finalWorks.add(MechanicWorkDraftInput(workNameInput.trim(), typedMins))
            }

            val finalParts = parts.toMutableList()
            if (partsProvidedByService && partNameInput.isNotBlank()) {
                val qty = partQtyInput.toDoubleOrNull() ?: 1.0
                finalParts.add(MechanicPartDraftInput(partNameInput.trim(), if (qty > 0) qty else 1.0, "шт"))
            }

            if (machineType == "own" && selectedAssetId.isBlank()) {
                errorMsg = "Выберите автомобиль из автопарка"
                return@launch
            }
            if (machineType == "client") {
                if (clientModel.isBlank()) {
                    errorMsg = "Для клиентского авто обязательно укажите Модель"
                    return@launch
                }
                if (clientReg.isBlank()) {
                    errorMsg = "Для клиентского авто обязательно укажите Госномер"
                    return@launch
                }
                val odoVal = odometer.toLongOrNull() ?: 0L
                if (odoVal <= 0L) {
                    errorMsg = "Для клиентского авто обязательно укажите Одометр (пробег)"
                    return@launch
                }
            }
            if (machineType == "own" && hasOilWork && (odometer.toLongOrNull() ?: 0L) <= 0L) {
                errorMsg = "При замене масла или фильтров укажите текущий одометр"
                return@launch
            }
            if (submitImmediately && finalWorks.isEmpty()) {
                errorMsg = "Добавьте хотя бы одну выполненную работу и время в минутах"
                return@launch
            }

            isSaving = true
            val res = SaldaApiClient.createMechanicOrder(
                mechanicId = user.id,
                orderDate = startDate.ifBlank { todayStr },
                startedAt = startDate.ifBlank { todayStr },
                completedAt = endDate.ifBlank { todayStr },
                machineType = machineType,
                assetId = if (machineType == "own") selectedAssetId else null,
                clientVehicleModel = if (machineType == "client") clientModel.trim() else null,
                clientVehicleReg = if (machineType == "client") clientReg.trim().uppercase() else null,
                odometer = odometer.toLongOrNull(),
                works = finalWorks,
                partsProvidedByService = partsProvidedByService,
                parts = if (partsProvidedByService) finalParts else emptyList(),
                mechanicNote = mechanicNote.trim().takeIf { it.isNotBlank() },
                submitImmediately = submitImmediately
            )
            isSaving = false
            res.onSuccess {
                onCreated()
            }.onFailure { err ->
                errorMsg = err.message ?: "Ошибка сохранения заказ-наряда"
            }
        }
    }

    Scaffold(
        containerColor = SberBg,
        topBar = {
            Surface(color = SberCard, shadowElevation = 1.dp) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад", tint = SberTextPrimary)
                    }
                    Column {
                        Text(
                            text = "СТО · НОВЫЙ ДОКУМЕНТ",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = SberGreen
                        )
                        Text(
                            text = "Открыть заказ-наряд",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = SberTextPrimary
                        )
                    }
                }
            }
        },
        bottomBar = {
            Surface(color = SberCard, shadowElevation = 8.dp) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "ВАША ЗП ЗА НАРЯД",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = SberTextSecondary
                            )
                            Text(
                                text = "Время: $totalMinutes мин",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = SberTextSecondary
                            )
                        }
                        Text(
                            text = "+${formatRub(totalEstimatedPay)}",
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Black,
                            color = SberGreen
                        )
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { submitForm(false) },
                            enabled = !isSaving,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.height(50.dp)
                        ) {
                            Text("В работу", fontWeight = FontWeight.ExtraBold, color = SberTextPrimary)
                        }
                        Button(
                            onClick = { submitForm(true) },
                            enabled = !isSaving,
                            colors = ButtonDefaults.buttonColors(containerColor = SberGreen),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(50.dp)
                        ) {
                            Text(
                                text = if (isSaving) "Сохранение..." else "✓ Записать и закрыть наряд",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 13.sp,
                                color = Color.White
                            )
                        }
                    }
                }
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // ШАГ 1 и 2: Дата + Тип авто
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = SberCard),
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, SberBorder)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "1. ДАТЫ ВЫПОЛНЕНИЯ РАБОТ",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = SberTextSecondary
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Начало",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SberTextSecondary
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                OutlinedTextField(
                                    value = startDate,
                                    onValueChange = {
                                        startDate = it
                                        if (endDate < it) endDate = it
                                    },
                                    placeholder = { Text("ГГГГ-ММ-ДД") },
                                    singleLine = true,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Окончание",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SberTextSecondary
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                OutlinedTextField(
                                    value = endDate,
                                    onValueChange = { endDate = it },
                                    placeholder = { Text("ГГГГ-ММ-ДД") },
                                    singleLine = true,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "2. ЧЕЙ АВТОМОБИЛЬ",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = SberTextSecondary
                            )
                            Surface(color = SberMint, shape = RoundedCornerShape(8.dp)) {
                                Text(
                                    text = "Ставка ${activeRate.toInt()} ₽/ч · ЗП ${(activeRate * salaryPct / 100).toInt()} ₽/ч",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SberDarkGreen,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            val isOwnSel = machineType == "own"
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { machineType = "own" },
                                color = if (isOwnSel) SberMint else SberBg,
                                shape = RoundedCornerShape(14.dp),
                                border = BorderStroke(if (isOwnSel) 1.5.dp else 1.dp, if (isOwnSel) SberGreen else SberBorder)
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(
                                        text = "🚛 Свой автопарк",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SberTextPrimary
                                    )
                                    Text(
                                        text = "${rates.hourlyRateOwn.toInt()} ₽/час",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isOwnSel) SberDarkGreen else SberTextSecondary
                                    )
                                }
                            }

                            val isClientSel = machineType == "client"
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { machineType = "client" },
                                color = if (isClientSel) SberMint else SberBg,
                                shape = RoundedCornerShape(14.dp),
                                border = BorderStroke(if (isClientSel) 1.5.dp else 1.dp, if (isClientSel) SberGreen else SberBorder)
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(
                                        text = "🚗 Клиентский",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SberTextPrimary
                                    )
                                    Text(
                                        text = "${rates.hourlyRateClient.toInt()} ₽/час",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isClientSel) SberDarkGreen else SberTextSecondary
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ШАГ 3: Автомобиль и Одометр
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = SberCard),
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, SberBorder)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "3. ДАННЫЕ АВТОМОБИЛЯ",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = SberTextSecondary
                            )
                            if (machineType == "client") {
                                Surface(color = SberAmberBg, shape = RoundedCornerShape(8.dp)) {
                                    Text(
                                        text = "Обязательно *",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SberAmberText,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        if (machineType == "own") {
                            val selectedAsset = assets.firstOrNull { it.id == selectedAssetId }
                            Box {
                                OutlinedButton(
                                    onClick = { showAssetDropdown = true },
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = if (selectedAsset != null) {
                                            "${selectedAsset.shortName} (${selectedAsset.regNumber})"
                                        } else {
                                            "Выберите машину из автопарка *"
                                        },
                                        color = SberTextPrimary,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                DropdownMenu(
                                    expanded = showAssetDropdown,
                                    onDismissRequest = { showAssetDropdown = false }
                                ) {
                                    assets.forEach { a ->
                                        DropdownMenuItem(
                                            text = { Text("${a.shortName} · ${a.regNumber}") },
                                            onClick = {
                                                selectedAssetId = a.id
                                                if (odometer.isBlank() && a.odometerCurrent > 0L) {
                                                    odometer = a.odometerCurrent.toString()
                                                }
                                                showAssetDropdown = false
                                            }
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            OutlinedTextField(
                                value = odometer,
                                onValueChange = { odometer = it.filter { ch -> ch.isDigit() } },
                                label = {
                                    Text(if (hasOilWork) "Одометр, км * (ТО/масло)" else "Одометр, км (при наличии)")
                                },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            )
                        } else {
                            OutlinedTextField(
                                value = clientModel,
                                onValueChange = { clientModel = it },
                                label = { Text("Модель автомобиля * (напр. ГАЗель Next)") },
                                singleLine = true,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(
                                    value = clientReg,
                                    onValueChange = { clientReg = it.uppercase() },
                                    label = { Text("Госномер *") },
                                    singleLine = true,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.weight(1f)
                                )
                                OutlinedTextField(
                                    value = odometer,
                                    onValueChange = { odometer = it.filter { ch -> ch.isDigit() } },
                                    label = { Text("Одометр, км *") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    singleLine = true,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }
            }

            // ШАГ 4: Перечень выполненных работ (Строка 1 - название, Строка 2 - время в минутах)
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = SberCard),
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, SberBorder)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "4. ПЕРЕЧЕНЬ ВЫПОЛНЕННЫХ РАБОТ (${works.size})",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = SberTextSecondary
                        )

                        if (works.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(10.dp))
                            works.forEachIndexed { idx, w ->
                                Surface(
                                    color = SberBg,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 3.dp)
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(10.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = "${idx + 1}. ${w.name}",
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = SberTextPrimary
                                            )
                                            Text(
                                                text = "⏱ Время: ${w.minutes} мин · +${formatRub(calcWorkPay(w.minutes))} в ЗП",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = SberGreen
                                            )
                                        }
                                        IconButton(
                                            onClick = { works = works.filterIndexed { i, _ -> i != idx } }
                                        ) {
                                            Icon(Icons.Default.Close, contentDescription = "Удалить", tint = SberRedText)
                                        }
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = "Строка 1 — Наименование работы",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = SberTextSecondary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        OutlinedTextField(
                            value = workNameInput,
                            onValueChange = { workNameInput = it },
                            placeholder = { Text("Например: Замена глушителя (бочка)") },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = "Строка 2 — Время в минутах",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = SberTextSecondary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = workMinutesInput,
                                onValueChange = { workMinutesInput = it.filter { ch -> ch.isDigit() } },
                                placeholder = { Text("Минуты (напр. 60)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.weight(1f)
                            )
                            Button(
                                onClick = {
                                    val mins = workMinutesInput.toIntOrNull() ?: 0
                                    if (workNameInput.isNotBlank() && mins > 0) {
                                        works = works + MechanicWorkDraftInput(workNameInput.trim(), mins)
                                        workNameInput = ""
                                        workMinutesInput = ""
                                        errorMsg = null
                                    } else {
                                        errorMsg = "Укажите название работы и время в минутах"
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = SberGreen),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.height(52.dp)
                            ) {
                                Text("+ Добавить", fontWeight = FontWeight.ExtraBold, color = Color.White)
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            items(listOf(30, 45, 60, 90, 120, 180)) { m ->
                                val selected = workMinutesInput == m.toString()
                                Surface(
                                    color = if (selected) SberGreen else SberBg,
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.clickable { workMinutesInput = m.toString() }
                                ) {
                                    Text(
                                        text = "$m мин",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (selected) Color.White else SberTextPrimary,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ШАГ 5: Чек-бокс с галочкой «Запчасти предоставил автосервис (мы)»
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = SberCard),
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, SberBorder)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { partsProvidedByService = !partsProvidedByService },
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = partsProvidedByService,
                                onCheckedChange = { partsProvidedByService = it },
                                colors = CheckboxDefaults.colors(checkedColor = SberGreen)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Запчасти предоставил автосервис (мы)",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SberTextPrimary
                                )
                                Text(
                                    text = "Механик или мастер-приёмщик ездили за запчастями или их привезли в гараж",
                                    fontSize = 11.sp,
                                    color = SberTextSecondary
                                )
                            }
                        }

                        if (partsProvidedByService) {
                            Spacer(modifier = Modifier.height(10.dp))
                            HorizontalDivider(color = SberBorder)
                            Spacer(modifier = Modifier.height(10.dp))

                            if (parts.isNotEmpty()) {
                                parts.forEachIndexed { idx, p ->
                                    Surface(
                                        color = SberMint,
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 3.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(horizontal = 12.dp, vertical = 8.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = "${idx + 1}. ${p.name} — ${p.quantity.toInt()} ${p.unit}",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = SberDarkGreen,
                                                modifier = Modifier.weight(1f)
                                            )
                                            IconButton(
                                                onClick = { parts = parts.filterIndexed { i, _ -> i != idx } },
                                                modifier = Modifier.size(28.dp)
                                            ) {
                                                Icon(Icons.Default.Close, contentDescription = "Удалить", tint = SberRedText)
                                            }
                                        }
                                    }
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                            }

                            Text(
                                text = "Впишите купленные запчасти по одной:",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = SberTextSecondary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            OutlinedTextField(
                                value = partNameInput,
                                onValueChange = { partNameInput = it },
                                placeholder = { Text("Название запчасти (напр. Глушитель бочка)") },
                                singleLine = true,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                OutlinedTextField(
                                    value = partQtyInput,
                                    onValueChange = { partQtyInput = it.filter { ch -> ch.isDigit() || ch == '.' } },
                                    label = { Text("Кол-во (шт)") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    singleLine = true,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.weight(1f)
                                )
                                Button(
                                    onClick = {
                                        val qty = partQtyInput.toDoubleOrNull() ?: 1.0
                                        if (partNameInput.isNotBlank()) {
                                            parts = parts + MechanicPartDraftInput(
                                                name = partNameInput.trim(),
                                                quantity = if (qty > 0) qty else 1.0,
                                                unit = "шт"
                                            )
                                            partNameInput = ""
                                            partQtyInput = "1"
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = SberTextPrimary),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.height(52.dp)
                                ) {
                                    Text("+ Запчасть", fontWeight = FontWeight.ExtraBold, color = Color.White)
                                }
                            }
                        }
                    }
                }
            }

            // Комментарий
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = SberCard),
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, SberBorder)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "КОММЕНТАРИЙ / РЕКОМЕНДАЦИИ (НЕОБЯЗАТЕЛЬНО)",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = SberTextSecondary
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        OutlinedTextField(
                            value = mechanicNote,
                            onValueChange = { mechanicNote = it },
                            placeholder = { Text("Заметка по ремонту...") },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }

            if (errorMsg != null) {
                item {
                    Surface(
                        color = SberRedBg,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = errorMsg ?: "",
                            color = SberRedText,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.ExtraBold,
                            modifier = Modifier.padding(14.dp)
                        )
                    }
                }
            }
        }
    }
}

// ── ЭКРАН ДЕТАЛЕЙ ЗАКАЗ-НАРЯДА ──────────────────────────────────────────────

@Composable
private fun MechanicOrderDetailScreen(
    orderId: String,
    user: User,
    onBack: () -> Unit
) {
    BackHandler { onBack() }
    val scope = rememberCoroutineScope()
    var order by remember { mutableStateOf<MechanicOrder?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    var workNameInput by remember { mutableStateOf("") }
    var workMinutesInput by remember { mutableStateOf("") }
    var partNameInput by remember { mutableStateOf("") }
    var partQtyInput by remember { mutableStateOf("1") }
    var odometerInput by remember { mutableStateOf("") }
    var isMutating by remember { mutableStateOf(false) }

    val loadOrder = {
        scope.launch {
            isLoading = order == null
            val loaded = SaldaApiClient.getMechanicOrderDetail(orderId, user.id)
            order = loaded
            isLoading = false
        }
    }

    LaunchedEffect(orderId) {
        loadOrder()
    }

    val ord = order
    val isApproved = ord?.lifecycleStatus == "approved"
    val isEditable = ord != null && !isApproved

    Scaffold(
        containerColor = SberBg,
        topBar = {
            Surface(color = SberCard, shadowElevation = 1.dp) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад", tint = SberTextPrimary)
                    }
                    Text(
                        text = if (ord != null) "Заказ-наряд #${ord.orderNumber}" else "Заказ-наряд",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = SberTextPrimary
                    )
                }
            }
        },
        bottomBar = {
            if (ord != null && !isApproved) {
                val pay = if (ord.mechanicPay > 0) ord.mechanicPay else ord.estimatedPay
                Surface(color = SberCard, shadowElevation = 8.dp) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("РАСЧЁТНАЯ ЗП", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = SberTextSecondary)
                            Text("+${formatRub(pay)}", fontSize = 20.sp, fontWeight = FontWeight.Black, color = SberGreen)
                        }
                        if (ord.status != "completed") {
                            Button(
                                onClick = {
                                    scope.launch {
                                        isMutating = true
                                        errorMsg = null
                                        val odo = odometerInput.toLongOrNull()
                                            ?: ord.odometerEnd.takeIf { it > 0L }
                                            ?: ord.odometerStart.takeIf { it > 0L }
                                        val res = SaldaApiClient.updateMechanicOrder(
                                            orderId = ord.id,
                                            status = "completed",
                                            odometerEnd = odo,
                                            mechanicId = user.id
                                        )
                                        isMutating = false
                                        res.onSuccess { onBack() }
                                            .onFailure { errorMsg = it.message }
                                    }
                                },
                                enabled = !isMutating,
                                colors = ButtonDefaults.buttonColors(containerColor = SberGreen),
                                shape = RoundedCornerShape(14.dp)
                            ) {
                                Text("✓ Закрыть наряд", fontWeight = FontWeight.ExtraBold, color = Color.White)
                            }
                        } else {
                            Surface(color = SberAmberBg, shape = RoundedCornerShape(12.dp)) {
                                Text(
                                    text = "⏳ На проверке у администратора",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SberAmberText,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    ) { paddingValues ->
        if (isLoading || ord == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = SberGreen)
            }
        } else {
            val isOwn = ord.machineType == "own"
            val vehicleTitle = if (isOwn) {
                ord.asset?.shortName ?: "Свой автопарк"
            } else {
                ord.clientVehicleBrand ?: ord.clientVehicleModel ?: "Клиентский авто"
            }
            val vehicleReg = if (isOwn) ord.asset?.regNumber else ord.clientVehicleReg
            val odo = if (ord.odometerEnd > 0L) ord.odometerEnd else ord.odometerStart

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Шапка карточки
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = SberCard),
                        shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(1.dp, SberBorder)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column {
                                    Text(
                                        text = if (isOwn) "🚛 Свой автопарк (${ord.hourlyRate.toInt()} ₽/ч)" else "🚗 Клиентский авто (${ord.hourlyRate.toInt()} ₽/ч)",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SberGreen
                                    )
                                    Text(
                                        text = "$vehicleTitle ${vehicleReg ?: ""}".trim(),
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SberTextPrimary
                                    )
                                    Text(
                                        text = "Дата: ${formatIsoDateShort(ord.createdAt)} · Одометр: ${if (odo > 0L) "$odo км" else "не указан"}",
                                        fontSize = 12.sp,
                                        color = SberTextSecondary
                                    )
                                }
                            }
                        }
                    }
                }

                // Список работ
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = SberCard),
                        shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(1.dp, SberBorder)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "ПЕРЕЧЕНЬ РАБОТ (${ord.works.size})",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = SberTextSecondary
                            )
                            Spacer(modifier = Modifier.height(8.dp))

                            ord.works.forEachIndexed { idx, w ->
                                val workPay = ((w.effectiveMinutes / 60.0) * ord.hourlyRate * (ord.salaryPct / 100.0))
                                Surface(
                                    color = SberBg,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 3.dp)
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(10.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = "${idx + 1}. ${w.displayName}",
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = SberTextPrimary
                                            )
                                            Text(
                                                text = "⏱ Время: ${w.effectiveMinutes} мин · +${formatRub(workPay)} в ЗП",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = SberGreen
                                            )
                                        }
                                        if (isEditable) {
                                            IconButton(
                                                onClick = {
                                                    scope.launch {
                                                        SaldaApiClient.deleteMechanicOrderWork(ord.id, w.id, user.id)
                                                        loadOrder()
                                                    }
                                                }
                                            ) {
                                                Icon(Icons.Default.Close, contentDescription = "Удалить", tint = SberRedText)
                                            }
                                        }
                                    }
                                }
                            }

                            if (isEditable) {
                                Spacer(modifier = Modifier.height(10.dp))
                                OutlinedTextField(
                                    value = workNameInput,
                                    onValueChange = { workNameInput = it },
                                    placeholder = { Text("Наименование работы") },
                                    singleLine = true,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedTextField(
                                        value = workMinutesInput,
                                        onValueChange = { workMinutesInput = it.filter { ch -> ch.isDigit() } },
                                        placeholder = { Text("Время в минутах") },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                        singleLine = true,
                                        shape = RoundedCornerShape(12.dp),
                                        modifier = Modifier.weight(1f)
                                    )
                                    Button(
                                        onClick = {
                                            val mins = workMinutesInput.toIntOrNull() ?: 0
                                            if (workNameInput.isNotBlank() && mins > 0) {
                                                scope.launch {
                                                    SaldaApiClient.addMechanicOrderWork(ord.id, workNameInput.trim(), mins, user.id)
                                                    workNameInput = ""
                                                    workMinutesInput = ""
                                                    loadOrder()
                                                }
                                            }
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = SberGreen),
                                        shape = RoundedCornerShape(12.dp),
                                        modifier = Modifier.height(52.dp)
                                    ) {
                                        Text("+ Работа", fontWeight = FontWeight.ExtraBold, color = Color.White)
                                    }
                                }
                            }
                        }
                    }
                }

                // Запчасти автосервиса
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = SberCard),
                        shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(1.dp, SberBorder)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "ЗАПЧАСТИ АВТОСЕРВИСА (${ord.parts.size})",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = SberTextSecondary
                            )
                            Spacer(modifier = Modifier.height(8.dp))

                            ord.parts.forEachIndexed { idx, p ->
                                Surface(
                                    color = SberMint,
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 3.dp)
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 12.dp, vertical = 8.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "${idx + 1}. ${p.displayName} — ${p.quantity.toInt()} ${p.displayUnit}",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = SberDarkGreen
                                        )
                                        if (isEditable) {
                                            IconButton(
                                                onClick = {
                                                    scope.launch {
                                                        SaldaApiClient.deleteMechanicOrderPart(ord.id, p.id, user.id)
                                                        loadOrder()
                                                    }
                                                },
                                                modifier = Modifier.size(28.dp)
                                            ) {
                                                Icon(Icons.Default.Close, contentDescription = "Удалить", tint = SberRedText)
                                            }
                                        }
                                    }
                                }
                            }

                            if (isEditable) {
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = partNameInput,
                                    onValueChange = { partNameInput = it },
                                    placeholder = { Text("Название купленной запчасти") },
                                    singleLine = true,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedTextField(
                                        value = partQtyInput,
                                        onValueChange = { partQtyInput = it.filter { ch -> ch.isDigit() } },
                                        placeholder = { Text("Кол-во") },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                        singleLine = true,
                                        shape = RoundedCornerShape(12.dp),
                                        modifier = Modifier.weight(1f)
                                    )
                                    Button(
                                        onClick = {
                                            val qty = partQtyInput.toDoubleOrNull() ?: 1.0
                                            if (partNameInput.isNotBlank()) {
                                                scope.launch {
                                                    SaldaApiClient.addMechanicOrderPart(ord.id, partNameInput.trim(), qty, "шт", user.id)
                                                    partNameInput = ""
                                                    partQtyInput = "1"
                                                    loadOrder()
                                                }
                                            }
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = SberTextPrimary),
                                        shape = RoundedCornerShape(12.dp),
                                        modifier = Modifier.height(52.dp)
                                    ) {
                                        Text("+ Запчасть", fontWeight = FontWeight.ExtraBold, color = Color.White)
                                    }
                                }
                            }
                        }
                    }
                }

                if (errorMsg != null) {
                    item {
                        Surface(color = SberRedBg, shape = RoundedCornerShape(12.dp)) {
                            Text(
                                text = errorMsg ?: "",
                                color = SberRedText,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

// ── ЭКРАН ЗАРПЛАТЫ И ВЫПЛАТ МЕХАНИКА ────────────────────────────────────────

@Composable
private fun MechanicSalaryScreen(
    user: User,
    onBack: () -> Unit,
    onOpenOrder: (String) -> Unit
) {
    BackHandler { onBack() }
    val cal = remember { Calendar.getInstance() }
    var year by remember { mutableStateOf(cal.get(Calendar.YEAR)) }
    var month by remember { mutableStateOf(cal.get(Calendar.MONTH) + 1) }
    var tab by remember { mutableStateOf(0) } // 0 = Начисления, 1 = Выплаты
    var data by remember { mutableStateOf(MechanicSalaryData()) }
    var isLoading by remember { mutableStateOf(true) }

    val monthNames = listOf(
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    )

    LaunchedEffect(year, month) {
        isLoading = true
        data = SaldaApiClient.getMechanicSalary(user.id, year, month)
        isLoading = false
    }

    Scaffold(
        containerColor = SberBg,
        topBar = {
            Surface(color = SberCard, shadowElevation = 1.dp) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад", tint = SberTextPrimary)
                        }
                        Text(
                            text = "Зарплата и выплаты",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = SberTextPrimary
                        )
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = {
                            if (month == 1) {
                                year -= 1
                                month = 12
                            } else month -= 1
                        }) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = "Пред")
                        }
                        Text(
                            text = "${monthNames.getOrElse(month - 1) { "" }} $year",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        IconButton(onClick = {
                            if (month == 12) {
                                year += 1
                                month = 1
                            } else month += 1
                        }) {
                            Icon(Icons.Default.ChevronRight, contentDescription = "След")
                        }
                    }
                }
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = SberCard),
                    shape = RoundedCornerShape(22.dp),
                    border = BorderStroke(1.dp, SberBorder)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("К ВЫПЛАТЕ НА РУКИ СЕЙЧАС", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = SberTextSecondary)
                        Text(formatRub(data.summary.toPay), fontSize = 28.sp, fontWeight = FontWeight.Black, color = SberGreen)
                        if (data.summary.draftPay > 0) {
                            Text(
                                text = "⏳ +${formatRub(data.summary.draftPay)} на проверке в гараже",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = SberDarkGreen
                            )
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Surface(color = SberBg, shape = RoundedCornerShape(12.dp), modifier = Modifier.weight(1f)) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    Text("НАЧИСЛЕНО", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = SberTextSecondary)
                                    Text(formatRub(data.summary.totalAccrued), fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                                }
                            }
                            Surface(color = SberBg, shape = RoundedCornerShape(12.dp), modifier = Modifier.weight(1f)) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    Text("ВЫПЛАЧЕНО", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = SberTextSecondary)
                                    Text(formatRub(data.summary.totalPaid), fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = SberGreen)
                                }
                            }
                        }
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SberCard, RoundedCornerShape(14.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Button(
                        onClick = { tab = 0 },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (tab == 0) SberGreen else Color.Transparent,
                            contentColor = if (tab == 0) Color.White else SberTextSecondary
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("За наряды (${data.accruals.size})", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                    }
                    Button(
                        onClick = { tab = 1 },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (tab == 1) SberGreen else Color.Transparent,
                            contentColor = if (tab == 1) Color.White else SberTextSecondary
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("История выплат (${data.payouts.size})", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                    }
                }
            }

            if (isLoading) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().height(100.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = SberGreen)
                    }
                }
            } else if (tab == 0) {
                items(data.accruals, key = { "acc_${it.id}" }) { acc ->
                    val isPaid = acc.settlementStatus == "completed"
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(enabled = acc.serviceOrder?.id != null) {
                                acc.serviceOrder?.id?.let { onOpenOrder(it) }
                            },
                        colors = CardDefaults.cardColors(containerColor = SberCard),
                        shape = RoundedCornerShape(16.dp),
                        border = BorderStroke(1.dp, SberBorder)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = acc.serviceOrder?.orderNumber?.let { "Наряд #$it" } ?: "Начисление ЗП",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SberTextPrimary
                                )
                                Text(
                                    text = acc.description,
                                    fontSize = 11.sp,
                                    color = SberTextSecondary,
                                    maxLines = 2
                                )
                                Text(
                                    text = formatIsoDateShort(acc.transactionDate ?: acc.createdAt),
                                    fontSize = 11.sp,
                                    color = SberTextSecondary
                                )
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("+${formatRub(acc.amount)}", fontSize = 15.sp, fontWeight = FontWeight.Black, color = SberGreen)
                                Text(
                                    text = if (isPaid) "✓ Выплачено" else "К выплате",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = if (isPaid) SberDarkGreen else SberAmberText
                                )
                            }
                        }
                    }
                }
            } else {
                items(data.payouts, key = { "pay_${it.id}" }) { p ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = SberCard),
                        shape = RoundedCornerShape(16.dp),
                        border = BorderStroke(1.dp, SberBorder)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = p.walletLabel,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SberDarkGreen
                                )
                                Text(
                                    text = p.description,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SberTextPrimary
                                )
                                Text(
                                    text = formatIsoDateShort(p.date),
                                    fontSize = 11.sp,
                                    color = SberTextSecondary
                                )
                            }
                            Text(
                                text = "+${formatRub(p.amount)}",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Black,
                                color = SberGreen
                            )
                        }
                    }
                }
            }
        }
    }
}

// ── ЭКРАН ВСЕХ НАРЯДОВ С ФИЛЬТРАМИ ──────────────────────────────────────────

@Composable
private fun AllMechanicOrdersScreen(
    orders: List<MechanicOrder>,
    onBack: () -> Unit,
    onOpenCreate: () -> Unit,
    onOpenOrder: (String) -> Unit
) {
    BackHandler { onBack() }
    var filter by remember { mutableStateOf("all") }

    val filtered = orders.filter { o ->
        when (filter) {
            "approved" -> o.lifecycleStatus == "approved"
            "review" -> o.status == "completed" && o.lifecycleStatus == "draft"
            "active" -> o.status == "in_progress" || o.status == "created" || o.lifecycleStatus == "returned"
            else -> true
        }
    }

    Scaffold(
        containerColor = SberBg,
        topBar = {
            Surface(color = SberCard, shadowElevation = 1.dp) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад", tint = SberTextPrimary)
                        }
                        Text(
                            text = "История нарядов (${orders.size})",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = SberTextPrimary
                        )
                    }
                    Button(
                        onClick = onOpenCreate,
                        colors = ButtonDefaults.buttonColors(containerColor = SberGreen),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("+ Наряд", fontWeight = FontWeight.ExtraBold, color = Color.White)
                    }
                }
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val tabs = listOf(
                        "all" to "Все (${orders.size})",
                        "approved" to "Закрытые (${orders.count { it.lifecycleStatus == "approved" }})",
                        "review" to "На проверке (${orders.count { it.status == "completed" && it.lifecycleStatus == "draft" }})",
                        "active" to "В работе (${orders.count { it.status == "in_progress" || it.status == "created" }})"
                    )
                    items(tabs) { (key, label) ->
                        val sel = filter == key
                        Surface(
                            color = if (sel) SberGreen else SberCard,
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, if (sel) SberGreen else SberBorder),
                            modifier = Modifier.clickable { filter = key }
                        ) {
                            Text(
                                text = label,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = if (sel) Color.White else SberTextPrimary,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                            )
                        }
                    }
                }
            }

            items(filtered, key = { "all_${it.id}" }) { ord ->
                MechanicOrderCard(order = ord, onClick = { onOpenOrder(ord.id) })
            }
        }
    }
}
