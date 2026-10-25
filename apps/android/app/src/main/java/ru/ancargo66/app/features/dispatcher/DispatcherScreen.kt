package ru.ancargo66.app.features.dispatcher

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import ru.ancargo66.app.R
import ru.ancargo66.app.core.model.*
import ru.ancargo66.app.core.network.SaldaApiClient
import ru.ancargo66.app.features.auth.PinScreen
import ru.ancargo66.app.features.driver.TripDetailScreen
import ru.ancargo66.app.ui.theme.*

@Composable
fun DispatcherScreen(
    user: User,
    onLogout: () -> Unit
) {
    var showChangePinScreen by rememberSaveable { mutableStateOf(false) }
    var selectedTab by remember { mutableStateOf(0) } // 0: Ревью, 1: В пути, 2: Счета, 3: Штат
    var adminSummary by remember { mutableStateOf<AdminSummary?>(null) }
    var reviewTrips by remember { mutableStateOf<List<TripDetail>>(emptyList()) }
    var activeTrips by remember { mutableStateOf<List<TripDetail>>(emptyList()) }
    var wallets by remember { mutableStateOf<List<WalletBalance>>(emptyList()) }
    var allStaff by remember { mutableStateOf<List<User>>(emptyList()) }
    var staffFilter by remember { mutableStateOf("all") } // all, driver, loader, workshop, cleaner, management

    var selectedTripIdForDetails by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var approvingTripId by remember { mutableStateOf<String?>(null) }
    var returningTripId by remember { mutableStateOf<String?>(null) }

    // Диалоги Дохода и Расхода
    var showAddIncomeDialog by rememberSaveable { mutableStateOf(false) }
    var showAddExpenseDialog by rememberSaveable { mutableStateOf(false) }

    // Диалог удаления рейса
    var tripToDelete by remember { mutableStateOf<TripDetail?>(null) }
    var isDeletingTrip by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    val refreshAll: () -> Unit = {
        scope.launch {
            isLoading = true
            try {
                adminSummary = SaldaApiClient.getAdminSummary(user.id)
                reviewTrips = SaldaApiClient.getAdminTrips(filter = "review", adminId = user.id)
                activeTrips = SaldaApiClient.getAdminTrips(filter = "active", adminId = user.id)
                wallets = SaldaApiClient.getWallets(userId = user.id)
                allStaff = SaldaApiClient.getUsers()
            } catch (_: Exception) {}
            finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        refreshAll()
    }

    // Если открыт детальный экран рейса
    val detailId = selectedTripIdForDetails
        if (showChangePinScreen) {
        PinScreen(
            user = user,
            isChangePinMode = true,
            onSuccess = { showChangePinScreen = false },
            onCancel = { showChangePinScreen = false }
        )
        return
    }

    if (detailId != null) {
        TripDetailScreen(
            tripId = detailId,
            userId = user.id,
            isAdmin = true,
            onBack = { selectedTripIdForDetails = null },
            onTripUpdated = {
                refreshAll()
                selectedTripIdForDetails = null
            }
        )
        return
    }

    val totalBalance = wallets.sumOf { it.balance }
    val bankWallet = wallets.firstOrNull { it.type == "bank" }
    val cashWallet = wallets.firstOrNull { it.type == "cash" }
    val fuelWallet = wallets.firstOrNull { it.type != "bank" && it.type != "cash" }
    val pendingCount = adminSummary?.pendingReview ?: reviewTrips.size
    val activeCount = adminSummary?.activeTrips ?: activeTrips.size
    val todayRevenue = adminSummary?.todayRevenue ?: "0.00"

    // Фильтрация штата
    val filteredStaff = remember(allStaff, staffFilter) {
        when (staffFilter) {
            "driver" -> allStaff.filter { u -> u.roles.contains("driver") }
            "loader" -> allStaff.filter { u -> u.roles.contains("loader") }
            "workshop" -> allStaff.filter { u ->
                u.roles.any { r -> listOf("mechanic", "mechanic_lead", "welder", "painter", "electrician", "handyman").contains(r) }
            }
            "cleaner" -> allStaff.filter { u ->
                u.roles.contains("cleaner") || (u.notes != null && u.notes.lowercase().contains("уборщиц")) ||
                u.name == "Татьяна" || u.name == "Ирина"
            }
            "management" -> allStaff.filter { u ->
                u.roles.any { r -> listOf("admin", "owner", "director").contains(r) }
            }
            else -> allStaff
        }
    }

    Scaffold(
        topBar = {
            Surface(
                color = Color.White,
                shadowElevation = 2.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0))
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
                            color = Color.White,
                            shape = RoundedCornerShape(12.dp),
                            shadowElevation = 2.dp,
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                            modifier = Modifier
                                .size(42.dp)
                                .bouncyTouch()
                        ) {
                            Image(
                                painter = painterResource(R.drawable.logo),
                                contentDescription = "TK501 Logo",
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(3.dp)
                                    .clip(RoundedCornerShape(8.dp))
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "Пульт ",
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Zinc900
                                )
                                Text(
                                    text = "Директора",
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.Black,
                                    color = SaldaOrangePrimary
                                )
                            }
                            Text(
                                text = "${user.name} • Управление",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Zinc700
                            )
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        IconButton(onClick = { showChangePinScreen = true }) {
                            Icon(Icons.Default.Lock, contentDescription = "Сменить PIN", tint = Zinc700)
                        }
                        OutlinedButton(
                            onClick = onLogout,
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Zinc700),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCBD5E1)),
                        modifier = Modifier.bouncyTouch()
                    ) {
                        Text("Выйти", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
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
            // 1. ВИДЖЕТ «КАПИТАЛ КОМПАНИИ»
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .bouncyTouch(),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(22.dp),
                    border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFFE2E8F0)),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "КАПИТАЛ КОМПАНИИ",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = Zinc400,
                                letterSpacing = 1.2.sp
                            )
                            IconButton(
                                onClick = refreshAll,
                                modifier = Modifier
                                    .size(28.dp)
                                    .bouncyTouch()
                            ) {
                                Icon(
                                    Icons.Default.Refresh,
                                    contentDescription = "Обновить",
                                    tint = if (isLoading) SaldaOrangePrimary else Zinc400,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        val formattedTotal = String.format("%,d", totalBalance.toLong()).replace(',', ' ')
                        Text(
                            text = "$formattedTotal ₽",
                            fontSize = 30.sp,
                            fontWeight = FontWeight.Black,
                            color = Zinc900,
                            letterSpacing = (-0.5).sp
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        // 3 микро-таблетки счетов
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // Р/Счет
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .bouncyClick { selectedTab = 2 },
                                color = Color(0xFFF0F9FF),
                                shape = RoundedCornerShape(14.dp),
                                border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFFBAE6FD)),
                                shadowElevation = 1.dp
                            ) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    Text("🏦 Р/СЧЁТ", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color(0xFF0369A1), letterSpacing = 0.5.sp)
                                    Spacer(modifier = Modifier.height(3.dp))
                                    val bVal = String.format("%,d", (bankWallet?.balance ?: 0.0).toLong()).replace(',', ' ')
                                    Text(
                                        text = "$bVal ₽",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color(0xFF0C4A6E),
                                        maxLines = 1
                                    )
                                }
                            }

                            // Сейф
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .bouncyClick { selectedTab = 2 },
                                color = Color(0xFFECFDF5),
                                shape = RoundedCornerShape(14.dp),
                                border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFFA7F3D0)),
                                shadowElevation = 1.dp
                            ) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    Text("💵 СЕЙФ", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color(0xFF047857), letterSpacing = 0.5.sp)
                                    Spacer(modifier = Modifier.height(3.dp))
                                    val cVal = String.format("%,d", (cashWallet?.balance ?: 0.0).toLong()).replace(',', ' ')
                                    Text(
                                        text = "$cVal ₽",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color(0xFF064E3B),
                                        maxLines = 1
                                    )
                                }
                            }

                            // Топливо
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .bouncyClick { selectedTab = 2 },
                                color = Color(0xFFFFFBEB),
                                shape = RoundedCornerShape(14.dp),
                                border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFFFDE68A)),
                                shadowElevation = 1.dp
                            ) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    Text("⛽ ТОПЛИВО", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color(0xFFB45309), letterSpacing = 0.5.sp)
                                    Spacer(modifier = Modifier.height(3.dp))
                                    val fVal = String.format("%,d", (fuelWallet?.balance ?: 0.0).toLong()).replace(',', ' ')
                                    Text(
                                        text = "$fVal ₽",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color(0xFF78350F),
                                        maxLines = 1
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 2. БЫСТРЫЕ ДЕЙСТВИЯ (Кнопки ДОХОД и РАСХОД с формами ввода)
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = { showAddIncomeDialog = true },
                        modifier = Modifier
                            .weight(1f)
                            .height(54.dp)
                            .bouncyTouch(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                        shape = RoundedCornerShape(16.dp),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp, pressedElevation = 6.dp)
                    ) {
                        Text("➕", fontSize = 16.sp)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("ДОХОД", fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                    }

                    Button(
                        onClick = { showAddExpenseDialog = true },
                        modifier = Modifier
                            .weight(1f)
                            .height(54.dp)
                            .bouncyTouch(),
                        colors = ButtonDefaults.buttonColors(containerColor = Zinc900),
                        shape = RoundedCornerShape(16.dp),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp, pressedElevation = 6.dp)
                    ) {
                        Text("➖", fontSize = 16.sp)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("РАСХОД", fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                    }
                }
            }

            // 3. ОПЕРАЦИОННАЯ СВОДКА
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .bouncyClick { selectedTab = 1 },
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        shape = RoundedCornerShape(18.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("В РЕЙСЕ СЕЙЧАС", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Zinc400)
                                Text("$activeCount авто", fontSize = 17.sp, fontWeight = FontWeight.Black, color = Zinc900)
                            }
                            Text("🚛", fontSize = 22.sp)
                        }
                    }

                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        shape = RoundedCornerShape(16.dp),
                        border = CardDefaults.outlinedCardBorder()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("ВЫРУЧКА СЕГОДНЯ", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Zinc400)
                                val revDouble = todayRevenue.toDoubleOrNull() ?: 0.0
                                val revFormatted = String.format("%,d", revDouble.toLong()).replace(',', ' ')
                                Text("$revFormatted ₽", fontSize = 15.sp, fontWeight = FontWeight.Black, color = Zinc900, maxLines = 1)
                            }
                            Text("📈", fontSize = 22.sp)
                        }
                    }
                }
            }

            // 4. СИГНАЛЬНЫЙ БАННЕР РЕВЬЮ (если есть)
            if (pendingCount > 0) {
                item {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .bouncyClick { selectedTab = 0 },
                        color = Color(0xFFFFF7ED),
                        shape = RoundedCornerShape(18.dp),
                        border = androidx.compose.foundation.BorderStroke(2.dp, SaldaOrangePrimary),
                        shadowElevation = 2.dp
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
                                    color = Color.White,
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.size(36.dp),
                                    shadowElevation = 1.dp
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text("📋", fontSize = 18.sp)
                                    }
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(
                                        text = "$pendingCount ${if (pendingCount == 1) "рейс ждёт" else "рейса ждут"} ревью",
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color(0xFF7C2D12)
                                    )
                                    Text(
                                        text = "Нажмите для утверждения →",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = SaldaOrangePrimary
                                    )
                                }
                            }
                            Surface(
                                color = SaldaOrangePrimary,
                                shape = RoundedCornerShape(10.dp),
                                shadowElevation = 2.dp
                            ) {
                                Text(
                                    text = "$pendingCount",
                                    color = Color.White,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Black,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }
                }
            }

            // 5. ТАБЫ РАЗДЕЛОВ
            item {
                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = Zinc100,
                    contentColor = SaldaOrangePrimary,
                    modifier = Modifier.clip(RoundedCornerShape(14.dp))
                ) {
                    Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }) {
                        Text("Ревью (${reviewTrips.size})", modifier = Modifier.padding(vertical = 12.dp), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                    Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }) {
                        Text("В пути (${activeTrips.size})", modifier = Modifier.padding(vertical = 12.dp), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                    Tab(selected = selectedTab == 2, onClick = { selectedTab = 2 }) {
                        Text("Счета (${wallets.size})", modifier = Modifier.padding(vertical = 12.dp), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                    Tab(selected = selectedTab == 3, onClick = { selectedTab = 3 }) {
                        Text("Штат (${allStaff.size})", modifier = Modifier.padding(vertical = 12.dp), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // 6. СПИСКИ СООТВЕТСТВУЮЩИХ РАЗДЕЛОВ
            when (selectedTab) {
                0 -> { // Рейсы на проверке (Ревью как в MiniApp боте)
                    if (reviewTrips.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 24.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("Все рейсы проверены и утверждены 👍", color = Zinc700, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            }
                        }
                    } else {
                        // Сводная плашка как в MiniApp боте
                        item {
                            val totalRev = reviewTrips.sumOf { t -> t.tripOrders.filter { it.lifecycleStatus != "cancelled" }.sumOf { it.amount } }
                            val totalDriverPay = reviewTrips.sumOf { t -> t.tripOrders.filter { it.lifecycleStatus != "cancelled" }.sumOf { it.driverPay } }
                            val totalLoadersPay = reviewTrips.sumOf { t ->
                                t.tripOrders.filter { it.lifecycleStatus != "cancelled" }.sumOf { o ->
                                    if (o.loadersData.isNotEmpty()) o.loadersData.sumOf { it.pay.toDoubleOrNull() ?: 0.0 }
                                    else o.loaderPay + o.loader2Pay
                                }
                            }
                            val totalExpenses = reviewTrips.sumOf { t -> t.tripExpenses.sumOf { it.amount } }
                            val totalCosts = totalDriverPay + totalLoadersPay + totalExpenses
                            val totalProfit = totalRev - totalCosts

                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = Zinc900),
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Text(
                                        text = "ИТОГО НА РЕВЬЮ · ${reviewTrips.size} РЕЙС${if (reviewTrips.size == 1) "" else if (reviewTrips.size < 5) "А" else "ОВ"}",
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Zinc400,
                                        letterSpacing = 1.sp
                                    )
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                                            Text("ВЫРУЧКА", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Zinc400)
                                            Text("${totalRev.toInt()} ₽", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White)
                                        }
                                        Text("−", color = Zinc600, fontWeight = FontWeight.Bold)
                                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                                            Text("РАСХОДЫ", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Zinc400)
                                            Text("${totalCosts.toInt()} ₽", fontSize = 13.sp, fontWeight = FontWeight.Black, color = RedAlert)
                                        }
                                        Text("=", color = Zinc600, fontWeight = FontWeight.Bold)
                                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                                            Text("ПРИБЫЛЬ", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Zinc400)
                                            Text(
                                                "${if (totalProfit >= 0) "+" else ""}${totalProfit.toInt()} ₽",
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.Black,
                                                color = if (totalProfit >= 0) GreenOnline else RedAlert
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        items(reviewTrips, key = { it.id }) { trip ->
                            val activeOrders = trip.tripOrders.filter { it.lifecycleStatus != "cancelled" }
                            val rev = activeOrders.sumOf { it.amount }
                            val driverPay = activeOrders.sumOf { it.driverPay }
                            val loaderPay = activeOrders.sumOf { o ->
                                if (o.loadersData.isNotEmpty()) o.loadersData.sumOf { it.pay.toDoubleOrNull() ?: 0.0 }
                                else o.loaderPay + o.loader2Pay
                            }
                            val expensesSum = trip.tripExpenses.sumOf { it.amount }
                            val profit = rev - driverPay - loaderPay - expensesSum
                            val isApproving = approvingTripId == trip.id
                            val isReturning = returningTripId == trip.id

                            Card(
                                onClick = { selectedTripIdForDetails = trip.id },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .bouncyTouch(),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                shape = RoundedCornerShape(18.dp),
                                border = androidx.compose.foundation.BorderStroke(1.5.dp, if (profit >= 0) Color(0xFFBBF7D0) else Color(0xFFFECDD3)),
                                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    // Заголовок карточки
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.Top
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Text(
                                                    text = if (trip.asset?.regNumber == "БЕЗ АВТО") "👷 ПРР (без авто)"
                                                           else "${trip.asset?.shortName ?: "Авто"} • №${trip.tripNumber}",
                                                    fontWeight = FontWeight.Black,
                                                    fontSize = 15.sp,
                                                    color = Zinc900
                                                )
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Surface(
                                                    color = AmberPending.copy(alpha = 0.15f),
                                                    shape = RoundedCornerShape(6.dp)
                                                ) {
                                                    Text(
                                                        text = "ЖДЁТ АПРУВА",
                                                        color = AmberPending,
                                                        fontWeight = FontWeight.Black,
                                                        fontSize = 9.sp,
                                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                    )
                                                }
                                            }
                                            Text(
                                                text = "Водитель: ${trip.driver?.name ?: "—"}",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Medium,
                                                color = Zinc700,
                                                modifier = Modifier.padding(top = 2.dp)
                                            )
                                        }

                                        Column(horizontalAlignment = Alignment.End) {
                                            Text(
                                                text = "${rev.toInt()} ₽",
                                                fontWeight = FontWeight.Black,
                                                fontSize = 17.sp,
                                                color = Zinc900
                                            )
                                            Text(
                                                text = "${if (profit >= 0) "+" else ""}${profit.toInt()} ₽ прибыль",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 11.sp,
                                                color = if (profit >= 0) GreenOnline else RedAlert
                                            )
                                        }
                                    }

                                    // Список заявок
                                    if (activeOrders.isNotEmpty()) {
                                        Spacer(modifier = Modifier.height(10.dp))
                                        Surface(
                                            color = Zinc50,
                                            shape = RoundedCornerShape(10.dp),
                                            border = androidx.compose.foundation.BorderStroke(1.dp, Zinc200)
                                        ) {
                                            Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                                activeOrders.forEach { ord ->
                                                    Row(
                                                        modifier = Modifier.fillMaxWidth(),
                                                        horizontalArrangement = Arrangement.SpaceBetween,
                                                        verticalAlignment = Alignment.CenterVertically
                                                    ) {
                                                        Column(modifier = Modifier.weight(1f)) {
                                                            Text(
                                                                text = ord.counterparty?.name ?: ord.description ?: "Заявка",
                                                                fontSize = 12.sp,
                                                                fontWeight = FontWeight.Bold,
                                                                color = Zinc800
                                                            )
                                                            Text(
                                                                text = "ЗП водителя: ${ord.driverPay.toInt()} ₽",
                                                                fontSize = 10.sp,
                                                                color = GreenOnline,
                                                                fontWeight = FontWeight.SemiBold
                                                            )
                                                        }
                                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                                            Surface(
                                                                color = when (ord.paymentMethod) {
                                                                    "cash" -> GreenOnline.copy(alpha = 0.15f)
                                                                    "qr", "card_driver" -> Color(0xFF9333EA).copy(alpha = 0.15f)
                                                                    "debt_cash" -> RedAlert.copy(alpha = 0.15f)
                                                                    else -> Color(0xFF2563EB).copy(alpha = 0.15f)
                                                                },
                                                                shape = RoundedCornerShape(4.dp)
                                                            ) {
                                                                Text(
                                                                    text = when (ord.paymentMethod) {
                                                                        "cash" -> "💵 Нал"
                                                                        "qr", "card_driver" -> "⚡ QR"
                                                                        "debt_cash" -> "⏳ Долг"
                                                                        else -> "🏛️ Безнал"
                                                                    },
                                                                    fontSize = 9.sp,
                                                                    fontWeight = FontWeight.Bold,
                                                                    color = when (ord.paymentMethod) {
                                                                        "cash" -> GreenOnline
                                                                        "qr", "card_driver" -> Color(0xFF9333EA)
                                                                        "debt_cash" -> RedAlert
                                                                        else -> Color(0xFF2563EB)
                                                                    },
                                                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                                                )
                                                            }
                                                            Spacer(modifier = Modifier.width(6.dp))
                                                            Text(
                                                                text = "${ord.amount.toInt()} ₽",
                                                                fontSize = 12.sp,
                                                                fontWeight = FontWeight.Black,
                                                                color = Zinc900
                                                            )
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    // Расходы рейса
                                    if (trip.tripExpenses.isNotEmpty()) {
                                        Spacer(modifier = Modifier.height(6.dp))
                                        trip.tripExpenses.forEach { exp ->
                                            Text(
                                                text = "↳ ${exp.category?.name ?: "Расход"}: -${exp.amount.toInt()} ₽",
                                                fontSize = 11.sp,
                                                color = RedAlert,
                                                fontWeight = FontWeight.Medium
                                            )
                                        }
                                    }

                                    // Заметка и пробег
                                    if (trip.odometerEnd != null && trip.odometerEnd > 0) {
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(
                                            text = "🛣 Пробег: ${trip.odometerEnd - trip.odometerStart} км",
                                            fontSize = 11.sp,
                                            color = Zinc700
                                        )
                                    }
                                    if (!trip.driverNote.isNullOrBlank()) {
                                        Text(
                                            text = "💬 ${trip.driverNote}",
                                            fontSize = 11.sp,
                                            color = Color(0xFFB45309),
                                            fontWeight = FontWeight.Medium
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(12.dp))

                                    // Кнопки управления: Детали, Удалить (🗑️), Вернуть, Одобрить
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        // Кнопка удаления рейса
                                        IconButton(
                                            onClick = {
                                                tripToDelete = trip
                                            },
                                            modifier = Modifier
                                                .size(40.dp)
                                                .background(RedAlert.copy(alpha = 0.1f), RoundedCornerShape(10.dp))
                                                .border(1.dp, RedAlert.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                                        ) {
                                            Icon(Icons.Default.Delete, contentDescription = "Удалить", tint = RedAlert, modifier = Modifier.size(18.dp))
                                        }

                                        // Кнопка вернуть на доработку
                                        OutlinedButton(
                                            onClick = {
                                                scope.launch {
                                                    returningTripId = trip.id
                                                    SaldaApiClient.returnTrip(trip.id, user.id)
                                                    returningTripId = null
                                                    refreshAll()
                                                }
                                            },
                                            modifier = Modifier
                                                .weight(1f)
                                                .height(40.dp),
                                            colors = ButtonDefaults.outlinedButtonColors(contentColor = AmberPending),
                                            border = androidx.compose.foundation.BorderStroke(1.dp, AmberPending),
                                            shape = RoundedCornerShape(10.dp),
                                            enabled = !isApproving && !isReturning
                                        ) {
                                            Text(if (isReturning) "..." else "↩ Вернуть", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        }

                                        // Кнопка одобрить
                                        Button(
                                            onClick = {
                                                scope.launch {
                                                    approvingTripId = trip.id
                                                    SaldaApiClient.approveTrip(trip.id, user.id)
                                                    approvingTripId = null
                                                    refreshAll()
                                                }
                                            },
                                            modifier = Modifier
                                                .weight(1.2f)
                                                .height(40.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = GreenOnline),
                                            shape = RoundedCornerShape(10.dp),
                                            enabled = !isApproving && !isReturning
                                        ) {
                                            Text(if (isApproving) "..." else "✓ Одобрить", fontSize = 12.sp, fontWeight = FontWeight.Black)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                1 -> { // Активные рейсы (В пути)
                    if (activeTrips.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 24.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("Сейчас нет активных рейсов на линии", color = Zinc700, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            }
                        }
                    } else {
                        items(activeTrips, key = { it.id }) { trip ->
                            val activeOrders = trip.tripOrders.filter { it.lifecycleStatus != "cancelled" }
                            val rev = activeOrders.sumOf { it.amount }

                            Card(
                                onClick = { selectedTripIdForDetails = trip.id },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .bouncyTouch(),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                shape = RoundedCornerShape(18.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp, pressedElevation = 4.dp)
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
                                            text = "Рейс №${trip.tripNumber} • ${trip.asset?.shortName ?: "Без авто"}",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp,
                                            color = Zinc900
                                        )
                                        Text(
                                            text = "Водитель: ${trip.driver?.name ?: "—"} • ${trip.asset?.regNumber ?: ""}",
                                            fontSize = 12.sp,
                                            color = Zinc700
                                        )
                                        Text(
                                            text = "Заказов: ${activeOrders.size} • Выручка: ${rev.toInt()} ₽",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = SaldaOrangePrimary,
                                            modifier = Modifier.padding(top = 2.dp)
                                        )
                                    }

                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Surface(
                                            color = SaldaOrange50,
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text(
                                                text = "В ПУТИ",
                                                color = SaldaOrangePrimary,
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Black,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                            )
                                        }

                                        Spacer(modifier = Modifier.width(8.dp))

                                        IconButton(
                                            onClick = { tripToDelete = trip },
                                            modifier = Modifier.size(36.dp)
                                        ) {
                                            Icon(Icons.Default.Delete, contentDescription = "Удалить", tint = Zinc400, modifier = Modifier.size(18.dp))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                2 -> { // Касса и счета (Т-Банк, Сейф, Опти24)
                    items(wallets, key = { it.id }) { w ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(16.dp),
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
                                        color = when (w.type) {
                                            "bank" -> Color(0xFFFEF08A)
                                            "cash" -> GreenOnline.copy(alpha = 0.15f)
                                            else -> SaldaOrange50
                                        },
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.size(42.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text(
                                                text = when (w.type) {
                                                    "bank" -> "🏛️"
                                                    "cash" -> "💵"
                                                    else -> "⛽"
                                                },
                                                fontSize = 20.sp
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text(text = w.name, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Zinc900)
                                        Text(
                                            text = when (w.type) {
                                                "bank" -> "Т-Банк (р/с ТК)"
                                                "cash" -> "Сейф ТК (наличные)"
                                                else -> "Топливные карты Опти24"
                                            },
                                            fontSize = 11.sp,
                                            color = Zinc700
                                        )
                                    }
                                }
                                val wFormatted = String.format("%,d", w.balance.toLong()).replace(',', ' ')
                                Text(
                                    text = "$wFormatted ₽",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 16.sp,
                                    color = Zinc900
                                )
                            }
                        }
                    }
                }

                3 -> { // Штат (С фильтром по должностям + Уборщицы)
                    item {
                        // Горизонтальный скролл фильтра по должностям
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = staffFilter == "all",
                                onClick = { staffFilter = "all" },
                                label = { Text("Все (${allStaff.size})", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                            FilterChip(
                                selected = staffFilter == "driver",
                                onClick = { staffFilter = "driver" },
                                label = { Text("Водители", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                            FilterChip(
                                selected = staffFilter == "loader",
                                onClick = { staffFilter = "loader" },
                                label = { Text("Грузчики", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                            FilterChip(
                                selected = staffFilter == "workshop",
                                onClick = { staffFilter = "workshop" },
                                label = { Text("Цех / СТО", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                            FilterChip(
                                selected = staffFilter == "cleaner",
                                onClick = { staffFilter = "cleaner" },
                                label = { Text("🧹 Уборщицы", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                            FilterChip(
                                selected = staffFilter == "management",
                                onClick = { staffFilter = "management" },
                                label = { Text("Руководство", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                        }
                    }

                    if (filteredStaff.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 24.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("Нет сотрудников по данному фильтру", color = Zinc700, fontSize = 13.sp)
                            }
                        }
                    } else {
                        items(filteredStaff, key = { it.id }) { employee ->
                            val isCleaner = employee.roles.contains("cleaner") ||
                                    (employee.notes != null && employee.notes.lowercase().contains("уборщиц")) ||
                                    employee.name == "Татьяна" || employee.name == "Ирина"

                            val roleTitle = when {
                                isCleaner -> "Уборщица"
                                employee.roles.contains("driver") -> "Водитель"
                                employee.roles.contains("loader") -> "Грузчик"
                                employee.roles.contains("mechanic_lead") -> "Мастер СТО"
                                employee.roles.contains("mechanic") -> "Механик"
                                employee.roles.contains("welder") -> "Сварщик"
                                employee.roles.contains("painter") -> "Маляр"
                                employee.roles.contains("electrician") -> "Электрик"
                                employee.roles.contains("admin") -> "Администратор"
                                employee.roles.contains("owner") -> "Владелец"
                                else -> "Сотрудник"
                            }

                            val icon = when {
                                isCleaner -> "🧹"
                                employee.roles.contains("driver") -> "🚛"
                                employee.roles.contains("loader") -> "👷"
                                employee.roles.contains("mechanic") || employee.roles.contains("mechanic_lead") -> "🔧"
                                employee.roles.contains("admin") || employee.roles.contains("owner") -> "👔"
                                else -> "👤"
                            }

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
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Surface(
                                            color = if (isCleaner) Color(0xFFF3E8FF) else SaldaOrange50,
                                            shape = RoundedCornerShape(10.dp),
                                            modifier = Modifier.size(42.dp)
                                        ) {
                                            Box(contentAlignment = Alignment.Center) {
                                                Text(icon, fontSize = 20.sp)
                                            }
                                        }
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Column {
                                            Text(text = employee.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Zinc900)
                                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                                                Surface(
                                                    color = if (isCleaner) Color(0xFF7E22CE).copy(alpha = 0.12f) else Zinc100,
                                                    shape = RoundedCornerShape(4.dp)
                                                ) {
                                                    Text(
                                                        text = roleTitle,
                                                        fontSize = 10.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = if (isCleaner) Color(0xFF7E22CE) else Zinc700,
                                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                    )
                                                }
                                                if (!employee.notes.isNullOrBlank()) {
                                                    Spacer(modifier = Modifier.width(6.dp))
                                                    Text(
                                                        text = employee.notes,
                                                        fontSize = 11.sp,
                                                        color = Zinc700
                                                    )
                                                }
                                            }
                                            if (!employee.phone.isNullOrBlank()) {
                                                Text(
                                                    text = "📞 ${employee.phone}",
                                                    fontSize = 11.sp,
                                                    color = Zinc700,
                                                    modifier = Modifier.padding(top = 2.dp)
                                                )
                                            }
                                        }
                                    }

                                    Surface(
                                        color = GreenOnline.copy(alpha = 0.1f),
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text(
                                            text = "В штате",
                                            color = GreenOnline,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Диалог добавления ДОХОДА ────────────────────────────────────────────
    if (showAddIncomeDialog) {
        AddAdminTransactionDialog(
            direction = "income",
            adminId = user.id,
            onDismiss = { showAddIncomeDialog = false },
            onSuccess = {
                showAddIncomeDialog = false
                refreshAll()
            }
        )
    }

    // ── Диалог добавления РАСХОДА ───────────────────────────────────────────
    if (showAddExpenseDialog) {
        AddAdminTransactionDialog(
            direction = "expense",
            adminId = user.id,
            onDismiss = { showAddExpenseDialog = false },
            onSuccess = {
                showAddExpenseDialog = false
                refreshAll()
            }
        )
    }

    // ── Диалог подтверждения удаления рейса ─────────────────────────────────
    val delTrip = tripToDelete
    if (delTrip != null) {
        AlertDialog(
            onDismissRequest = { if (!isDeletingTrip) tripToDelete = null },
            title = { Text("Удалить рейс №${delTrip.tripNumber}?", fontWeight = FontWeight.Bold) },
            text = {
                Text("Рейс ${delTrip.asset?.shortName ?: ""} (водитель: ${delTrip.driver?.name ?: "—"}) и все его заявки будут удалены безвозвратно. Удалить?")
            },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            isDeletingTrip = true
                            SaldaApiClient.deleteAdminTrip(delTrip.id, user.id)
                            isDeletingTrip = false
                            tripToDelete = null
                            refreshAll()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = RedAlert),
                    enabled = !isDeletingTrip
                ) {
                    Text(if (isDeletingTrip) "Удаление..." else "Удалить", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { tripToDelete = null },
                    enabled = !isDeletingTrip
                ) {
                    Text("Отмена", color = Zinc700)
                }
            }
        )
    }
}

/**
 * Диалог добавления дохода / расхода администратором (Пульт директора)
 */
@Composable
fun AddAdminTransactionDialog(
    direction: String, // "income" | "expense"
    adminId: String,
    onDismiss: () -> Unit,
    onSuccess: () -> Unit
) {
    var amountInput by rememberSaveable { mutableStateOf("") }
    var selectedCategoryIndex by rememberSaveable { mutableStateOf(0) }
    var paymentMethod by rememberSaveable { mutableStateOf("cash") } // "cash" | "bank_transfer"
    var descriptionInput by rememberSaveable { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    val categories = remember(direction) {
        if (direction == "income") {
            listOf(
                "74008cf7-0527-4e9f-afd2-d232b8f8125a" to "Выручка с рейса",
                "600e7f70-2797-474d-948b-432230036d67" to "Выручка с ремонта",
                "84562648-767a-47b8-8821-a5c938da6e75" to "Продажа актива",
                "68225ea2-d7de-4442-8ed8-ce2366b5d369" to "Прочий доход"
            )
        } else {
            listOf(
                "62cebf3f-9982-4cc6-904b-48c6169cf5e4" to "ГСМ",
                "9d18370d-3228-4f2a-8530-52b168cfa8d7" to "Запчасти",
                "8c5f3080-d0a8-49ea-b759-3286f2084940" to "Сторонний ремонт",
                "f4a66f83-63c0-4ba0-8eaa-0d42ce19d3ca" to "Налоги / Страховки",
                "73f565eb-f509-4538-9658-9cdff69bee37" to "Офис и связь",
                "df1022df-4ea6-46fc-b9aa-f3c9eb4e7f30" to "Прочий расход"
            )
        }
    }

    AlertDialog(
        onDismissRequest = { if (!isSubmitting) onDismiss() },
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(if (direction == "income") "➕ Добавить доход" else "➖ Добавить расход", fontWeight = FontWeight.Black, fontSize = 18.sp)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = amountInput,
                    onValueChange = { amountInput = it },
                    label = { Text("Сумма (₽) *") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Text("Категория:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Zinc700)
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    categories.forEachIndexed { index, pair ->
                        Surface(
                            onClick = { selectedCategoryIndex = index },
                            color = if (selectedCategoryIndex == index) SaldaOrange50 else Zinc50,
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (selectedCategoryIndex == index) SaldaOrangePrimary else Zinc200
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = pair.second,
                                fontSize = 12.sp,
                                fontWeight = if (selectedCategoryIndex == index) FontWeight.Bold else FontWeight.Medium,
                                color = if (selectedCategoryIndex == index) SaldaOrangePrimary else Zinc800,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)
                            )
                        }
                    }
                }

                Text("Счет / Способ оплаты:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Zinc700)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Button(
                        onClick = { paymentMethod = "cash" },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (paymentMethod == "cash") GreenOnline else Zinc100,
                            contentColor = if (paymentMethod == "cash") Color.White else Zinc700
                        ),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("💵 Сейф (нал)", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = { paymentMethod = "bank_transfer" },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (paymentMethod == "bank_transfer") Color(0xFF0284C7) else Zinc100,
                            contentColor = if (paymentMethod == "bank_transfer") Color.White else Zinc700
                        ),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("🏦 Р/Счет", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }

                OutlinedTextField(
                    value = descriptionInput,
                    onValueChange = { descriptionInput = it },
                    label = { Text("Примечание (необязательно)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                if (errorMsg != null) {
                    Text(text = errorMsg ?: "", color = RedAlert, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amt = amountInput.toDoubleOrNull()
                    if (amt == null || amt <= 0) {
                        errorMsg = "Введите корректную сумму"
                        return@Button
                    }
                    scope.launch {
                        isSubmitting = true
                        errorMsg = null
                        val catId = categories[selectedCategoryIndex].first
                        val ok = SaldaApiClient.addAdminTransaction(
                            direction = direction,
                            categoryId = catId,
                            amount = amt,
                            paymentMethod = paymentMethod,
                            description = descriptionInput.ifBlank { null },
                            adminId = adminId
                        )
                        isSubmitting = false
                        if (ok) {
                            onSuccess()
                        } else {
                            errorMsg = "Не удалось сохранить операцию"
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (direction == "income") Color(0xFF059669) else Zinc900
                ),
                enabled = !isSubmitting
            ) {
                Text(if (isSubmitting) "Сохранение..." else "Сохранить", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isSubmitting
            ) {
                Text("Отмена", color = Zinc700)
            }
        }
    )
}
