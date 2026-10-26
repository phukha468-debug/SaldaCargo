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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import ru.ancargo66.app.R
import ru.ancargo66.app.core.model.*
import ru.ancargo66.app.core.network.SaldaApiClient
import ru.ancargo66.app.features.auth.PinScreen
import ru.ancargo66.app.features.driver.TripDetailScreen
import ru.ancargo66.app.ui.theme.*
import java.util.Calendar

@Composable
fun DispatcherScreen(
    user: User,
    onLogout: () -> Unit
) {
    var showChangePinScreen by rememberSaveable { mutableStateOf(false) }
    var selectedTab by remember { mutableStateOf(0) } // 0: Ревью, 1: В пути, 2: Штат
    var reviewSubTab by rememberSaveable { mutableStateOf(0) } // 0: Авто (Водители), 1: Гараж (Механики)
    var adminSummary by remember { mutableStateOf<AdminSummary?>(null) }
    var reviewTrips by remember { mutableStateOf<List<TripDetail>>(emptyList()) }
    var reviewServiceOrders by remember { mutableStateOf<List<MechanicOrder>>(emptyList()) }
    var activeTrips by remember { mutableStateOf<List<TripDetail>>(emptyList()) }
    var wallets by remember { mutableStateOf<List<WalletBalance>>(emptyList()) }
    var allStaff by remember { mutableStateOf<List<User>>(emptyList()) }
    var staffFilter by remember { mutableStateOf("all") } // all, driver, loader, workshop, cleaner, debt

    // Зарплатный учет (Штат)
    val initCal = remember { Calendar.getInstance() }
    var payrollYear by remember { mutableStateOf(initCal.get(Calendar.YEAR)) }
    var payrollMonth by remember { mutableStateOf(initCal.get(Calendar.MONTH) + 1) } // 1..12
    var payrollStaff by remember { mutableStateOf<List<PayrollEmployee>>(emptyList()) }
    var isPayrollLoading by remember { mutableStateOf(false) }

    // Детали сотрудника и окно выплаты
    var selectedEmployeeForDetails by remember { mutableStateOf<PayrollEmployee?>(null) }
    var selectedEmployeeForSettle by remember { mutableStateOf<PayrollEmployee?>(null) }

    var selectedTripIdForDetails by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var approvingTripId by remember { mutableStateOf<String?>(null) }
    var returningTripId by remember { mutableStateOf<String?>(null) }
    var approvingOrderId by remember { mutableStateOf<String?>(null) }
    var returningOrderId by remember { mutableStateOf<String?>(null) }
    var deletingOrderId by remember { mutableStateOf<String?>(null) }
    var editingServiceOrder by remember { mutableStateOf<MechanicOrder?>(null) }
    var showWalletTransferDialog by remember { mutableStateOf(false) }

    // Управление подотчётом и переносом остатка на руках
    var cashHolds by remember { mutableStateOf<List<ru.ancargo66.app.core.model.DriverCashHold>>(emptyList()) }
    var showCashHoldDialog by remember { mutableStateOf(false) }
    var selectedHoldForCollect by remember { mutableStateOf<ru.ancargo66.app.core.model.DriverCashHold?>(null) }

    // Диалоги Дохода и Расхода
    var showAddIncomeDialog by rememberSaveable { mutableStateOf(false) }
    var showAddExpenseDialog by rememberSaveable { mutableStateOf(false) }

    // Диалог удаления рейса
    var tripToDelete by remember { mutableStateOf<TripDetail?>(null) }
    var isDeletingTrip by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    val loadPayroll: (Int, Int) -> Unit = { y, m ->
        scope.launch {
            isPayrollLoading = true
            try {
                payrollStaff = SaldaApiClient.getAdminPayroll(year = y, month = m, adminId = user.id)
            } catch (_: Exception) {}
            finally {
                isPayrollLoading = false
            }
        }
    }

    val refreshAll: () -> Unit = {
        scope.launch {
            isLoading = true
            try {
                coroutineScope {
                    val summaryDeferred = async { SaldaApiClient.getAdminSummary(user.id) }
                    val reviewTripsDeferred = async { SaldaApiClient.getAdminTrips(filter = "review", adminId = user.id) }
                    val reviewServiceDeferred = async { SaldaApiClient.getAdminServiceOrders(filter = "review", adminId = user.id) }
                    val activeTripsDeferred = async { SaldaApiClient.getAdminTrips(filter = "active", adminId = user.id) }
                    val walletsDeferred = async { SaldaApiClient.getWallets(userId = user.id) }
                    val allStaffDeferred = async { SaldaApiClient.getUsers() }
                    val payrollStaffDeferred = async { SaldaApiClient.getAdminPayroll(year = payrollYear, month = payrollMonth, adminId = user.id) }
                    val cashHoldsDeferred = async { SaldaApiClient.getDriverCashHolds(user.id) }

                    adminSummary = summaryDeferred.await()
                    reviewTrips = reviewTripsDeferred.await()
                    reviewServiceOrders = reviewServiceDeferred.await()
                    activeTrips = activeTripsDeferred.await()
                    wallets = walletsDeferred.await()
                    allStaff = allStaffDeferred.await()
                    payrollStaff = payrollStaffDeferred.await()
                    cashHolds = cashHoldsDeferred.await()
                }
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
    val pendingTripsCount = adminSummary?.pendingReview ?: reviewTrips.size
    val pendingGarageCount = if (reviewServiceOrders.isNotEmpty()) reviewServiceOrders.size else (adminSummary?.pendingGarageReview ?: 0)
    val pendingCount = pendingTripsCount + pendingGarageCount
    val activeCount = adminSummary?.activeTrips ?: activeTrips.size
    val todayRevenue = adminSummary?.todayRevenue ?: "0.00"

    val monthNames = remember {
        listOf(
            "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
            "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
        )
    }

    // Объединенный список сотрудников с зарплатными данными
    val payrollStaffList = remember(payrollStaff, allStaff) {
        if (payrollStaff.isNotEmpty()) {
            payrollStaff
        } else {
            allStaff.map { u ->
                PayrollEmployee(
                    id = u.id,
                    name = u.name,
                    role = u.roles.firstOrNull() ?: "staff",
                    roles = u.roles,
                    phone = u.phone,
                    notes = u.notes
                )
            }
        }
    }

    // Фильтрация штата
    val filteredStaff = remember(payrollStaffList, staffFilter) {
        when (staffFilter) {
            "driver" -> payrollStaffList.filter { it.roles.contains("driver") || it.role == "driver" }
            "loader" -> payrollStaffList.filter { it.roles.contains("loader") || it.role == "loader" }
            "workshop" -> payrollStaffList.filter {
                it.roles.any { r -> listOf("mechanic", "mechanic_lead", "welder", "painter", "electrician", "handyman").contains(r) } ||
                listOf("mechanic", "mechanic_lead", "welder", "painter", "electrician", "handyman").contains(it.role ?: "")
            }
            "cleaner" -> payrollStaffList.filter {
                it.roles.contains("cleaner") || it.role == "cleaner" || (it.notes != null && it.notes.lowercase().contains("уборщиц")) ||
                it.name == "Татьяна" || it.name == "Ирина"
            }
            "debt" -> payrollStaffList.filter { it.debtDouble > 0 }
            "management" -> payrollStaffList.filter {
                it.roles.any { r -> listOf("admin", "owner", "director").contains(r) }
            }
            else -> payrollStaffList
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

                    Button(
                        onClick = { showWalletTransferDialog = true },
                        modifier = Modifier
                            .weight(1.1f)
                            .height(54.dp)
                            .bouncyTouch(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                        shape = RoundedCornerShape(16.dp),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp, pressedElevation = 6.dp)
                    ) {
                        Text("↔", fontSize = 15.sp)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("ПЕРЕВОД", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp)
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Кнопка фиксации остатка подотчёта водителя
                Button(
                    onClick = { showCashHoldDialog = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .bouncyTouch(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEA580C)),
                    shape = RoundedCornerShape(14.dp),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 1.dp, pressedElevation = 4.dp)
                ) {
                    Text("📋", fontSize = 15.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "ЗАФИКСИРОВАТЬ ОСТАТОК НА РУКАХ (ПЕРЕНОС)",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 0.5.sp,
                        color = Color.White
                    )
                }
            }

            // Блок активных остатков на руках у водителей (переносы)
            if (cashHolds.isNotEmpty()) {
                item {
                    Surface(
                        color = Color(0xFFFFF7ED),
                        border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFFFDBA74)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("⚠️", fontSize = 16.sp)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "ОСТАТКИ НА РУКАХ (ПЕРЕНОСЫ)",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color(0xFFC2410C),
                                        letterSpacing = 0.5.sp
                                    )
                                }
                                Surface(
                                    color = Color(0xFFEA580C),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text(
                                        text = "${cashHolds.size}",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            cashHolds.forEach { hold ->
                                Surface(
                                    color = Color.White,
                                    shape = RoundedCornerShape(12.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFED7AA)),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp)
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = hold.driverName,
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Zinc900
                                            )
                                            if (hold.note.isNotBlank()) {
                                                Spacer(modifier = Modifier.height(2.dp))
                                                Text(
                                                    text = hold.note,
                                                    fontSize = 12.sp,
                                                    color = Zinc600,
                                                    maxLines = 2
                                                )
                                            }
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(
                                                text = "${hold.amount} ₽",
                                                fontSize = 16.sp,
                                                fontWeight = FontWeight.Black,
                                                color = Color(0xFFEA580C)
                                            )
                                        }

                                        Button(
                                            onClick = { selectedHoldForCollect = hold },
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF21A038)),
                                            shape = RoundedCornerShape(10.dp),
                                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                        ) {
                                            Text("Принять", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }
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
                            .bouncyClick {
                                selectedTab = 0
                                if (reviewTrips.isEmpty() && reviewServiceOrders.isNotEmpty()) {
                                    reviewSubTab = 1
                                }
                            },
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
                                        text = "Ждут ревью: Авто (${reviewTrips.size}) · Гараж (${reviewServiceOrders.size})",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color(0xFF7C2D12)
                                    )
                                    Text(
                                        text = "Нажмите для проверки водителей и механиков →",
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
                                    text = "${reviewTrips.size + reviewServiceOrders.size}",
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

            // 5. ОБЪЕМНЫЕ КНОПКИ РАЗДЕЛОВ: РЕВЬЮ / В ПУТИ / ШТАТ
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Кнопка: РЕВЬЮ
                    VolumetricTabCard(
                        title = "Ревью",
                        icon = "📋",
                        count = reviewTrips.size + reviewServiceOrders.size,
                        isSelected = selectedTab == 0,
                        selectedGradient = Brush.verticalGradient(
                            listOf(Color(0xFFFF9800), Color(0xFFEA580C))
                        ),
                        selectedShadowColor = Color(0xFFEA580C).copy(alpha = 0.35f),
                        badgeColor = if (reviewTrips.isNotEmpty() || reviewServiceOrders.isNotEmpty()) Color(0xFFDC2626) else Color.White.copy(alpha = 0.25f),
                        badgeTextColor = Color.White,
                        modifier = Modifier.weight(1f),
                        onClick = { selectedTab = 0 }
                    )

                    // Кнопка: В ПУТИ
                    VolumetricTabCard(
                        title = "В пути",
                        icon = "🚛",
                        count = activeTrips.size,
                        isSelected = selectedTab == 1,
                        selectedGradient = Brush.verticalGradient(
                            listOf(Color(0xFF38BDF8), Color(0xFF0284C7))
                        ),
                        selectedShadowColor = Color(0xFF0284C7).copy(alpha = 0.35f),
                        badgeColor = Color.White.copy(alpha = 0.25f),
                        badgeTextColor = Color.White,
                        modifier = Modifier.weight(1f),
                        onClick = { selectedTab = 1 }
                    )

                    // Кнопка: ШТАТ
                    VolumetricTabCard(
                        title = "Штат",
                        icon = "👥",
                        count = payrollStaffList.size,
                        isSelected = selectedTab == 2,
                        selectedGradient = Brush.verticalGradient(
                            listOf(Color(0xFFA855F7), Color(0xFF7C3AED))
                        ),
                        selectedShadowColor = Color(0xFF7C3AED).copy(alpha = 0.35f),
                        badgeColor = Color.White.copy(alpha = 0.25f),
                        badgeTextColor = Color.White,
                        modifier = Modifier.weight(1f),
                        onClick = { selectedTab = 2 }
                    )
                }
            }

            // 6. СПИСКИ СООТВЕТСТВУЮЩИХ РАЗДЕЛОВ
            when (selectedTab) {
                0 -> { // Раздел Ревью: 2 кнопки переключения (🚛 Авто / 🔧 Гараж)
                    item {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            color = Color.White,
                            shape = RoundedCornerShape(16.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Zinc200),
                            shadowElevation = 1.dp
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(6.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                // Кнопка 1: 🚛 АВТО (Водители)
                                Surface(
                                    modifier = Modifier
                                        .weight(1f)
                                        .bouncyClick { reviewSubTab = 0 },
                                    color = if (reviewSubTab == 0) Zinc900 else Zinc100,
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(vertical = 10.dp, horizontal = 12.dp),
                                        horizontalArrangement = Arrangement.Center,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "🚛 Авто",
                                            fontWeight = FontWeight.Black,
                                            fontSize = 13.sp,
                                            color = if (reviewSubTab == 0) Color.White else Zinc700
                                        )
                                        if (reviewTrips.isNotEmpty()) {
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Surface(
                                                color = if (reviewSubTab == 0) SaldaOrangePrimary else Zinc200,
                                                shape = RoundedCornerShape(8.dp)
                                            ) {
                                                Text(
                                                    text = "${reviewTrips.size}",
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = if (reviewSubTab == 0) Color.White else Zinc800,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                    }
                                }

                                // Кнопка 2: 🔧 ГАРАЖ (Механики)
                                Surface(
                                    modifier = Modifier
                                        .weight(1f)
                                        .bouncyClick { reviewSubTab = 1 },
                                    color = if (reviewSubTab == 1) Color(0xFF21A038) else Zinc100,
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(vertical = 10.dp, horizontal = 12.dp),
                                        horizontalArrangement = Arrangement.Center,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "🔧 Гараж",
                                            fontWeight = FontWeight.Black,
                                            fontSize = 13.sp,
                                            color = if (reviewSubTab == 1) Color.White else Zinc700
                                        )
                                        if (reviewServiceOrders.isNotEmpty()) {
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Surface(
                                                color = if (reviewSubTab == 1) Color.White else Color(0xFFDCFCE7),
                                                shape = RoundedCornerShape(8.dp)
                                            ) {
                                                Text(
                                                    text = "${reviewServiceOrders.size}",
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = Color(0xFF15803D),
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (reviewSubTab == 0) {
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
                    } else {
                        // ── РЕВЬЮ ГАРАЖА (Механики · Заказ-наряды) ───────────────────
                        if (reviewServiceOrders.isEmpty()) {
                            item {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 24.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        "Все заказ-наряды механиков проверены 👍",
                                        color = Zinc700,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        } else {
                            // Сводная плашка по Гаражу
                            item {
                                val totalMins = reviewServiceOrders.sumOf { o ->
                                    if (o.totalMinutes > 0L) o.totalMinutes
                                    else o.works.sumOf { it.effectiveMinutes }
                                }
                                val totalMechanicPay = reviewServiceOrders.sumOf { o ->
                                    if (o.mechanicPay > 0.0) o.mechanicPay else o.estimatedPay
                                }

                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0E7C5B)),
                                    shape = RoundedCornerShape(16.dp)
                                ) {
                                    Column(modifier = Modifier.padding(14.dp)) {
                                        Text(
                                            text = "НА РЕВЬЮ ГАРАЖА · ${reviewServiceOrders.size} НАРЯД${if (reviewServiceOrders.size == 1) "" else if (reviewServiceOrders.size < 5) "А" else "ОВ"}",
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Black,
                                            color = Color(0xFFA7F3D0),
                                            letterSpacing = 1.sp
                                        )
                                        Spacer(modifier = Modifier.height(10.dp))
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                                                Text("НАРЯДОВ", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color(0xFFA7F3D0))
                                                Text("${reviewServiceOrders.size}", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
                                            }
                                            Text("·", color = Color(0xFF6EE7B7), fontWeight = FontWeight.Bold)
                                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                                                Text("ВРЕМЯ РАБОТ", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color(0xFFA7F3D0))
                                                Text("$totalMins мин", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
                                            }
                                            Text("=", color = Color(0xFF6EE7B7), fontWeight = FontWeight.Bold)
                                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                                                Text("ЗП МЕХАНИКАМ", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color(0xFFA7F3D0))
                                                Text(
                                                    "${totalMechanicPay.toInt()} ₽",
                                                    fontSize = 14.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = Color(0xFFFEF08A)
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            items(reviewServiceOrders, key = { it.id }) { order ->
                                val isOwn = order.machineType == "own"
                                val hourlyRate = if (order.hourlyRate > 0) order.hourlyRate else if (isOwn) 1600.0 else 2000.0
                                val salaryPct = if (order.salaryPct > 0) order.salaryPct else 50.0
                                val totalMins = if (order.totalMinutes > 0L) order.totalMinutes else order.works.sumOf { it.effectiveMinutes }
                                val mechPay = if (order.mechanicPay > 0.0) order.mechanicPay else order.estimatedPay
                                val odo = if (order.odometerEnd > 0L) order.odometerEnd else order.odometerStart
                                val isApprovingOrder = approvingOrderId == order.id
                                val isReturningOrder = returningOrderId == order.id
                                val isDeletingOrder = deletingOrderId == order.id

                                val vehicleTitle = if (isOwn) {
                                    "${order.asset?.shortName ?: "Свой авто"} • ${order.asset?.regNumber ?: ""}"
                                } else {
                                    "${order.clientVehicleModel ?: order.clientVehicleBrand ?: "Клиентский авто"} • ${order.clientVehicleReg ?: ""}"
                                }

                                val dateText = order.createdAt?.take(10) ?: ""

                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = Color.White),
                                    shape = RoundedCornerShape(18.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFFBBF7D0)),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                                ) {
                                    Column(modifier = Modifier.padding(14.dp)) {
                                        // Шапка карточки наряда
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.Top
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                    Text(
                                                        text = "Наряд №${order.orderNumber}",
                                                        fontWeight = FontWeight.Black,
                                                        fontSize = 15.sp,
                                                        color = Zinc900
                                                    )
                                                    Spacer(modifier = Modifier.width(6.dp))
                                                    Surface(
                                                        color = if (isOwn) Color(0xFFE8F7EC) else Color(0xFFE0F2FE),
                                                        shape = RoundedCornerShape(6.dp)
                                                    ) {
                                                        Text(
                                                            text = if (isOwn) "🏢 СВОЙ (${hourlyRate.toInt()} ₽/ч)" else "🚗 КЛИЕНТ (${hourlyRate.toInt()} ₽/ч)",
                                                            color = if (isOwn) Color(0xFF15803D) else Color(0xFF0369A1),
                                                            fontWeight = FontWeight.Black,
                                                            fontSize = 9.sp,
                                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                        )
                                                    }
                                                }
                                                Text(
                                                    text = vehicleTitle,
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Zinc800,
                                                    modifier = Modifier.padding(top = 3.dp)
                                                )
                                                Text(
                                                    text = buildString {
                                                        append("👨‍🔧 Механик: ${order.mechanic?.name ?: "—"}")
                                                        if (dateText.isNotBlank()) append(" • 📅 $dateText")
                                                        if (odo > 0L) append(" • 🛣 $odo км")
                                                    },
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Medium,
                                                    color = Zinc600,
                                                    modifier = Modifier.padding(top = 2.dp)
                                                )
                                            }

                                            Column(horizontalAlignment = Alignment.End) {
                                                Text(
                                                    text = "${mechPay.toInt()} ₽",
                                                    fontWeight = FontWeight.Black,
                                                    fontSize = 17.sp,
                                                    color = Color(0xFF21A038)
                                                )
                                                Text(
                                                    text = "ЗП ($totalMins мин)",
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 10.sp,
                                                    color = Zinc500
                                                )
                                            }
                                        }

                                        // Перечень выполненных работ
                                        if (order.works.isNotEmpty()) {
                                            Spacer(modifier = Modifier.height(10.dp))
                                            Surface(
                                                color = Zinc50,
                                                shape = RoundedCornerShape(10.dp),
                                                border = androidx.compose.foundation.BorderStroke(1.dp, Zinc200)
                                            ) {
                                                Column(
                                                    modifier = Modifier.padding(10.dp),
                                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                                ) {
                                                    Text(
                                                        text = "ПЕРЕЧЕНЬ РАБОТ (${order.works.size})",
                                                        fontSize = 9.sp,
                                                        fontWeight = FontWeight.Black,
                                                        color = Zinc500
                                                    )
                                                    order.works.forEachIndexed { idx, w ->
                                                        val mins = w.effectiveMinutes
                                                        val wPrice = if (w.priceClient > 0) w.priceClient else (mins / 60.0) * hourlyRate
                                                        val wPay = (wPrice * salaryPct) / 100.0
                                                        Row(
                                                            modifier = Modifier.fillMaxWidth(),
                                                            horizontalArrangement = Arrangement.SpaceBetween,
                                                            verticalAlignment = Alignment.CenterVertically
                                                        ) {
                                                            Column(modifier = Modifier.weight(1f)) {
                                                                Text(
                                                                    text = "${idx + 1}. ${w.displayName}",
                                                                    fontSize = 12.sp,
                                                                    fontWeight = FontWeight.Bold,
                                                                    color = Zinc900
                                                                )
                                                                Text(
                                                                    text = "⏱ $mins мин • ЗП: ${wPay.toInt()} ₽",
                                                                    fontSize = 10.sp,
                                                                    fontWeight = FontWeight.SemiBold,
                                                                    color = Color(0xFF15803D)
                                                                )
                                                            }
                                                            Text(
                                                                text = "${wPrice.toInt()} ₽",
                                                                fontSize = 12.sp,
                                                                fontWeight = FontWeight.Black,
                                                                color = Zinc800
                                                            )
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        // Запчасти автосервиса
                                        if (order.partsProvidedByService || order.parts.isNotEmpty()) {
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Surface(
                                                color = Color(0xFFE8F7EC),
                                                shape = RoundedCornerShape(10.dp),
                                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFBBF7D0))
                                            ) {
                                                Column(
                                                    modifier = Modifier.padding(10.dp),
                                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                                ) {
                                                    Text(
                                                        text = "☑ ЗАПЧАСТИ ПРЕДОСТАВИЛ АВТОСЕРВИС (${order.parts.size})",
                                                        fontSize = 9.sp,
                                                        fontWeight = FontWeight.Black,
                                                        color = Color(0xFF15803D)
                                                    )
                                                    order.parts.forEach { p ->
                                                        Row(
                                                            modifier = Modifier.fillMaxWidth(),
                                                            horizontalArrangement = Arrangement.SpaceBetween
                                                        ) {
                                                            Text(
                                                                text = "• ${p.displayName}",
                                                                fontSize = 11.sp,
                                                                fontWeight = FontWeight.Bold,
                                                                color = Zinc800
                                                            )
                                                            Text(
                                                                text = "${p.quantity.toInt()} ${p.displayUnit}",
                                                                fontSize = 11.sp,
                                                                fontWeight = FontWeight.Black,
                                                                color = Color(0xFF15803D)
                                                            )
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        val cleanNote = (order.mechanicNote ?: "")
                                            .replace("[Запчасти предоставил автосервис]", "")
                                            .trim()
                                        if (cleanNote.isNotBlank()) {
                                            Spacer(modifier = Modifier.height(6.dp))
                                            Text(
                                                text = "💬 $cleanNote",
                                                fontSize = 11.sp,
                                                color = Color(0xFFB45309),
                                                fontWeight = FontWeight.Medium
                                            )
                                        }

                                        Spacer(modifier = Modifier.height(12.dp))

                                        // Кнопки управления: Удалить (🗑️), Вернуть, Одобрить
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            IconButton(
                                                onClick = {
                                                    scope.launch {
                                                        deletingOrderId = order.id
                                                        SaldaApiClient.deleteAdminServiceOrder(order.id, user.id)
                                                        deletingOrderId = null
                                                        refreshAll()
                                                    }
                                                },
                                                enabled = !isApprovingOrder && !isReturningOrder && !isDeletingOrder,
                                                modifier = Modifier
                                                    .size(40.dp)
                                                    .background(RedAlert.copy(alpha = 0.1f), RoundedCornerShape(10.dp))
                                                    .border(1.dp, RedAlert.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                                            ) {
                                                Icon(Icons.Default.Delete, contentDescription = "Удалить", tint = RedAlert, modifier = Modifier.size(18.dp))
                                            }

                                            OutlinedButton(
                                                onClick = { editingServiceOrder = order },
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .height(40.dp),
                                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Zinc700),
                                                border = androidx.compose.foundation.BorderStroke(1.dp, Zinc300),
                                                shape = RoundedCornerShape(10.dp),
                                                enabled = !isApprovingOrder && !isReturningOrder && !isDeletingOrder
                                            ) {
                                                Text("✏ Изменить", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            }

                                            OutlinedButton(
                                                onClick = {
                                                    scope.launch {
                                                        returningOrderId = order.id
                                                        SaldaApiClient.returnAdminServiceOrder(order.id, user.id)
                                                        returningOrderId = null
                                                        refreshAll()
                                                    }
                                                },
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .height(40.dp),
                                                colors = ButtonDefaults.outlinedButtonColors(contentColor = AmberPending),
                                                border = androidx.compose.foundation.BorderStroke(1.dp, AmberPending),
                                                shape = RoundedCornerShape(10.dp),
                                                enabled = !isApprovingOrder && !isReturningOrder && !isDeletingOrder
                                            ) {
                                                Text(if (isReturningOrder) "..." else "↩ Вернуть", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                            }

                                            Button(
                                                onClick = {
                                                    scope.launch {
                                                        approvingOrderId = order.id
                                                        SaldaApiClient.approveAdminServiceOrder(order.id, user.id)
                                                        approvingOrderId = null
                                                        refreshAll()
                                                    }
                                                },
                                                modifier = Modifier
                                                    .weight(1.2f)
                                                    .height(40.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF21A038)),
                                                shape = RoundedCornerShape(10.dp),
                                                enabled = !isApprovingOrder && !isReturningOrder && !isDeletingOrder
                                            ) {
                                                Text(if (isApprovingOrder) "..." else "✓ Одобрить", fontSize = 12.sp, fontWeight = FontWeight.Black)
                                            }
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

                2 -> { // Штат и управление зарплатами
                    // 1. Переключатель расчетного месяца
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(16.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 8.dp, vertical = 6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                IconButton(
                                    onClick = {
                                        if (payrollMonth == 1) {
                                            payrollMonth = 12
                                            payrollYear -= 1
                                        } else {
                                            payrollMonth -= 1
                                        }
                                        loadPayroll(payrollYear, payrollMonth)
                                    }
                                ) {
                                    Icon(Icons.Default.KeyboardArrowLeft, contentDescription = "Предыдущий месяц", tint = Zinc800)
                                }

                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        text = "🗓️ ${monthNames.getOrElse(payrollMonth - 1) { "" }} $payrollYear",
                                        fontWeight = FontWeight.Black,
                                        fontSize = 15.sp,
                                        color = Zinc900
                                    )
                                    if (isPayrollLoading) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(16.dp),
                                            strokeWidth = 2.dp,
                                            color = SaldaOrangePrimary
                                        )
                                    }
                                }

                                IconButton(
                                    onClick = {
                                        if (payrollMonth == 12) {
                                            payrollMonth = 1
                                            payrollYear += 1
                                        } else {
                                            payrollMonth += 1
                                        }
                                        loadPayroll(payrollYear, payrollMonth)
                                    }
                                ) {
                                    Icon(Icons.Default.KeyboardArrowRight, contentDescription = "Следующий месяц", tint = Zinc800)
                                }
                            }
                        }
                    }

                    // 2. Сводная плашка зарплатного фонда за месяц
                    item {
                        val totalEarned = payrollStaffList.sumOf { it.earnedDouble }
                        val totalPaid = payrollStaffList.sumOf { it.paidDouble }
                        val totalDebt = payrollStaffList.sumOf { maxOf(0.0, it.debtDouble) }

                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(16.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    text = "ФОНД ОПЛАТЫ ТРУДА ЗА МЕСЯЦ",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Zinc500,
                                    letterSpacing = 0.5.sp
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text("Начислено", fontSize = 11.sp, color = Zinc600, fontWeight = FontWeight.Medium)
                                        Text(
                                            text = "${String.format("%,d", totalEarned.toLong()).replace(',', ' ')} ₽",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Zinc900
                                        )
                                    }
                                    Column {
                                        Text("Выплачено", fontSize = 11.sp, color = Zinc600, fontWeight = FontWeight.Medium)
                                        Text(
                                            text = "${String.format("%,d", totalPaid.toLong()).replace(',', ' ')} ₽",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = GreenOnline
                                        )
                                    }
                                    Column(horizontalAlignment = Alignment.End) {
                                        Text("К выплате", fontSize = 11.sp, color = Zinc600, fontWeight = FontWeight.Medium)
                                        Text(
                                            text = "${String.format("%,d", totalDebt.toLong()).replace(',', ' ')} ₽",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Black,
                                            color = if (totalDebt > 0) RedAlert else GreenOnline
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // 3. Горизонтальный скролл фильтра по должностям
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            val debtCount = payrollStaffList.count { it.debtDouble > 0 }
                            FilterChip(
                                selected = staffFilter == "all",
                                onClick = { staffFilter = "all" },
                                label = { Text("Все (${payrollStaffList.size})", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                            FilterChip(
                                selected = staffFilter == "debt",
                                onClick = { staffFilter = "debt" },
                                label = {
                                    Text(
                                        text = "С долгом ($debtCount)",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (debtCount > 0) RedAlert else Zinc700
                                    )
                                }
                            )
                            FilterChip(
                                selected = staffFilter == "driver",
                                onClick = { staffFilter = "driver" },
                                label = { Text("🚛 Водители", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                            FilterChip(
                                selected = staffFilter == "loader",
                                onClick = { staffFilter = "loader" },
                                label = { Text("👷 Грузчики", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                            FilterChip(
                                selected = staffFilter == "workshop",
                                onClick = { staffFilter = "workshop" },
                                label = { Text("🔧 Цех / СТО", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                            FilterChip(
                                selected = staffFilter == "cleaner",
                                onClick = { staffFilter = "cleaner" },
                                label = { Text("🧹 Уборщицы", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                            FilterChip(
                                selected = staffFilter == "management",
                                onClick = { staffFilter = "management" },
                                label = { Text("👔 Руководство", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                        }
                    }

                    // 4. Список сотрудников с зарплатными карточками
                    if (filteredStaff.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("Нет сотрудников по данному фильтру", color = Zinc700, fontSize = 13.sp)
                            }
                        }
                    } else {
                        items(filteredStaff, key = { it.id }) { employee ->
                            val isCleaner = employee.roles.contains("cleaner") || employee.role == "cleaner" ||
                                    (employee.notes != null && employee.notes.lowercase().contains("уборщиц")) ||
                                    employee.name == "Татьяна" || employee.name == "Ирина"

                            val roleTitle = when {
                                isCleaner -> "Уборщица"
                                employee.roles.contains("driver") || employee.role == "driver" -> "Водитель"
                                employee.roles.contains("loader") || employee.role == "loader" -> "Грузчик"
                                employee.roles.contains("mechanic_lead") || employee.role == "mechanic_lead" -> "Мастер СТО"
                                employee.roles.contains("mechanic") || employee.role == "mechanic" -> "Механик"
                                employee.roles.contains("welder") || employee.role == "welder" -> "Сварщик"
                                employee.roles.contains("painter") || employee.role == "painter" -> "Маляр"
                                employee.roles.contains("electrician") || employee.role == "electrician" -> "Электрик"
                                employee.roles.contains("admin") || employee.role == "admin" -> "Администратор"
                                employee.roles.contains("owner") || employee.role == "owner" -> "Владелец"
                                else -> "Сотрудник"
                            }

                            val icon = when {
                                isCleaner -> "🧹"
                                employee.roles.contains("driver") || employee.role == "driver" -> "🚛"
                                employee.roles.contains("loader") || employee.role == "loader" -> "👷"
                                employee.roles.contains("mechanic") || employee.role == "mechanic" ||
                                        employee.roles.contains("mechanic_lead") || employee.role == "mechanic_lead" -> "🔧"
                                employee.roles.contains("admin") || employee.roles.contains("owner") -> "👔"
                                else -> "👤"
                            }

                            Card(
                                onClick = { selectedEmployeeForDetails = employee },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .bouncyTouch(),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                shape = RoundedCornerShape(16.dp),
                                border = androidx.compose.foundation.BorderStroke(
                                    width = if (employee.debtDouble > 0) 1.5.dp else 1.dp,
                                    color = if (employee.debtDouble > 0) RedAlert.copy(alpha = 0.35f) else Color(0xFFE2E8F0)
                                ),
                                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp, pressedElevation = 4.dp)
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    // Верхняя строка: Иконка, Имя, Должность, Кол-во смен
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Surface(
                                                color = if (isCleaner) Color(0xFFF3E8FF) else SaldaOrange50,
                                                shape = RoundedCornerShape(10.dp),
                                                modifier = Modifier.size(40.dp)
                                            ) {
                                                Box(contentAlignment = Alignment.Center) {
                                                    Text(icon, fontSize = 20.sp)
                                                }
                                            }
                                            Spacer(modifier = Modifier.width(10.dp))
                                            Column {
                                                Text(
                                                    text = employee.name,
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 15.sp,
                                                    color = Zinc900
                                                )
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    modifier = Modifier.padding(top = 2.dp)
                                                ) {
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
                                                    if (!employee.phone.isNullOrBlank()) {
                                                        Spacer(modifier = Modifier.width(6.dp))
                                                        Text(
                                                            text = employee.phone,
                                                            fontSize = 11.sp,
                                                            color = Zinc500
                                                        )
                                                    }
                                                }
                                            }
                                        }

                                        // Бейдж смен
                                        if (employee.shifts > 0) {
                                            Surface(
                                                color = Zinc100,
                                                shape = RoundedCornerShape(6.dp)
                                            ) {
                                                Text(
                                                    text = "${employee.shifts} смен",
                                                    color = Zinc800,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                                )
                                            }
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(12.dp))

                                    // Финансовые показатели сотрудника за месяц
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(Zinc50, RoundedCornerShape(10.dp))
                                            .padding(horizontal = 10.dp, vertical = 8.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text("Заработано", fontSize = 10.sp, color = Zinc500)
                                            Text(
                                                text = "${employee.earnedDouble.toInt()} ₽",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Zinc800
                                            )
                                        }
                                        Column {
                                            Text("Выплачено", fontSize = 10.sp, color = Zinc500)
                                            Text(
                                                text = "${employee.paidDouble.toInt()} ₽",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = GreenOnline
                                            )
                                        }
                                        Column(horizontalAlignment = Alignment.End) {
                                            Text(
                                                text = if (employee.debtDouble > 0) "Долг (к выплате)" else "Остаток",
                                                fontSize = 10.sp,
                                                color = if (employee.debtDouble > 0) RedAlert else Zinc500,
                                                fontWeight = if (employee.debtDouble > 0) FontWeight.Bold else FontWeight.Normal
                                            )
                                            Text(
                                                text = "${employee.debtDouble.toInt()} ₽",
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Black,
                                                color = if (employee.debtDouble > 0) RedAlert else GreenOnline
                                            )
                                        }
                                    }

                                    // Аванс если есть
                                    if (employee.advanceDouble > 0) {
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(
                                            text = "ℹ️ Непогашенный аванс: ${employee.advanceDouble.toInt()} ₽",
                                            fontSize = 11.sp,
                                            color = AmberPending,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))

                                    // Кнопки действий: Выплатить + Подробнее
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        // Кнопка подтверждения неподтвержденных смен
                                        if (employee.unconfirmedCount > 0) {
                                            OutlinedButton(
                                                onClick = {
                                                    scope.launch {
                                                        SaldaApiClient.confirmStaffUnconfirmed(employee.id, user.id)
                                                        loadPayroll(payrollYear, payrollMonth)
                                                    }
                                                },
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .height(38.dp),
                                                colors = ButtonDefaults.outlinedButtonColors(contentColor = AmberPending),
                                                border = androidx.compose.foundation.BorderStroke(1.dp, AmberPending),
                                                shape = RoundedCornerShape(10.dp)
                                            ) {
                                                Text("✓ Подтв. (${employee.unconfirmedCount})", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            }
                                        }

                                        // Главная кнопка: ВЫПЛАТИТЬ
                                        Button(
                                            onClick = {
                                                selectedEmployeeForSettle = employee
                                            },
                                            modifier = Modifier
                                                .weight(1.2f)
                                                .height(38.dp),
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = if (employee.debtDouble > 0) GreenOnline else Zinc800
                                            ),
                                            shape = RoundedCornerShape(10.dp)
                                        ) {
                                            Text(
                                                text = if (employee.debtDouble > 0) "💰 Выплатить ${employee.debtDouble.toInt()} ₽" else "💰 Выплатить",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Black
                                            )
                                        }

                                        // Кнопка перехода к деталям
                                        IconButton(
                                            onClick = { selectedEmployeeForDetails = employee },
                                            modifier = Modifier
                                                .size(38.dp)
                                                .background(Zinc100, RoundedCornerShape(10.dp))
                                        ) {
                                            Icon(Icons.Default.ChevronRight, contentDescription = "Подробнее", tint = Zinc700)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Диалог Деталей сотрудника (рейсы, начисления, выплаты) ─────────────
    val detailsEmp = selectedEmployeeForDetails
    if (detailsEmp != null) {
        StaffDetailsDialog(
            employee = detailsEmp,
            year = payrollYear,
            month = payrollMonth,
            adminId = user.id,
            onDismiss = { selectedEmployeeForDetails = null },
            onSettleClick = {
                selectedEmployeeForDetails = null
                selectedEmployeeForSettle = detailsEmp
            },
            onDataChanged = {
                refreshAll()
            }
        )
    }

    // ── Диалог Выплаты сотруднику ──────────────────────────────────────────
    val settleEmp = selectedEmployeeForSettle
    if (settleEmp != null) {
        StaffSettleDialog(
            employee = settleEmp,
            wallets = wallets,
            adminId = user.id,
            onDismiss = { selectedEmployeeForSettle = null },
            onSuccess = {
                selectedEmployeeForSettle = null
                refreshAll()
            }
        )
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

    if (showWalletTransferDialog) {
        WalletTransferDialog(
            wallets = wallets,
            adminId = user.id,
            onDismiss = { showWalletTransferDialog = false },
            onSuccess = {
                showWalletTransferDialog = false
                refreshAll()
            }
        )
    }

    editingServiceOrder?.let { orderToEdit ->
        ServiceOrderEditDialog(
            order = orderToEdit,
            adminId = user.id,
            onDismiss = { editingServiceOrder = null },
            onSuccess = {
                editingServiceOrder = null
                refreshAll()
            }
        )
    }

    if (showCashHoldDialog) {
        DriverCashHoldDialog(
            drivers = allStaff,
            adminId = user.id,
            onDismiss = { showCashHoldDialog = false },
            onSuccess = {
                showCashHoldDialog = false
                refreshAll()
            }
        )
    }

    selectedHoldForCollect?.let { holdToCollect ->
        DriverCashCollectDialog(
            hold = holdToCollect,
            adminId = user.id,
            onDismiss = { selectedHoldForCollect = null },
            onSuccess = {
                selectedHoldForCollect = null
                refreshAll()
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

/**
 * Объемная 3D кнопка вкладки (Ревью / В пути / Штат)
 */
@Composable
fun VolumetricTabCard(
    title: String,
    icon: String,
    count: Int,
    isSelected: Boolean,
    selectedGradient: Brush,
    selectedShadowColor: Color,
    badgeColor: Color,
    badgeTextColor: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = modifier
            .bouncyTouch()
            .height(72.dp),
        shape = RoundedCornerShape(16.dp),
        color = if (isSelected) Color.Transparent else Color.White,
        shadowElevation = if (isSelected) 6.dp else 2.dp,
        border = androidx.compose.foundation.BorderStroke(
            width = if (isSelected) 1.5.dp else 1.dp,
            color = if (isSelected) Color.White.copy(alpha = 0.45f) else Color(0xFFE2E8F0)
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .then(
                    if (isSelected) Modifier.background(selectedGradient)
                    else Modifier.background(Color.White)
                )
                .padding(horizontal = 8.dp, vertical = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(text = icon, fontSize = 16.sp)
                    Surface(
                        color = if (isSelected) badgeColor else Zinc100,
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            text = "$count",
                            color = if (isSelected) badgeTextColor else Zinc700,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = title,
                    fontSize = 12.sp,
                    fontWeight = if (isSelected) FontWeight.Black else FontWeight.Bold,
                    color = if (isSelected) Color.White else Zinc800
                )
            }
        }
    }
}

/**
 * Диалог подробностей начислений и истории выплат сотрудника (Штат)
 */
@Composable
fun StaffDetailsDialog(
    employee: PayrollEmployee,
    year: Int,
    month: Int,
    adminId: String,
    onDismiss: () -> Unit,
    onSettleClick: () -> Unit,
    onDataChanged: () -> Unit
) {
    var details by remember { mutableStateOf<StaffSettleDetails?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var detailTab by remember { mutableStateOf(0) } // 0: Начисления / Рейсы, 1: История выплат, 2: Авансы
    var isConfirming by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val loadDetails = {
        scope.launch {
            isLoading = true
            try {
                details = SaldaApiClient.getStaffSettleDetails(employee.id, year, month, adminId)
            } catch (_: Exception) {}
            finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(employee.id, year, month) {
        loadDetails()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = employee.name,
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp,
                        color = Zinc900
                    )
                    Surface(
                        color = SaldaOrange50,
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = employee.role ?: "Сотрудник",
                            color = SaldaOrangePrimary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
                if (!employee.phone.isNullOrBlank()) {
                    Text(
                        text = "📞 ${employee.phone}",
                        fontSize = 12.sp,
                        color = Zinc500,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 420.dp)
            ) {
                // Сводка за месяц
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Zinc100, RoundedCornerShape(12.dp))
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("Заработано", fontSize = 10.sp, color = Zinc600)
                        Text("${employee.earnedDouble.toInt()} ₽", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Zinc900)
                    }
                    Column {
                        Text("Выплачено", fontSize = 10.sp, color = Zinc600)
                        Text("${employee.paidDouble.toInt()} ₽", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GreenOnline)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("К выплате", fontSize = 10.sp, color = Zinc600)
                        Text(
                            "${employee.debtDouble.toInt()} ₽",
                            fontWeight = FontWeight.Black,
                            fontSize = 14.sp,
                            color = if (employee.debtDouble > 0) RedAlert else GreenOnline
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Вкладки деталей: Смены / Выплаты
                TabRow(
                    selectedTabIndex = detailTab,
                    containerColor = Zinc100,
                    contentColor = SaldaOrangePrimary,
                    modifier = Modifier.clip(RoundedCornerShape(10.dp))
                ) {
                    Tab(selected = detailTab == 0, onClick = { detailTab = 0 }) {
                        Text("Смены (${details?.pendingTransactions?.size ?: 0})", fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(vertical = 8.dp))
                    }
                    Tab(selected = detailTab == 1, onClick = { detailTab = 1 }) {
                        Text("История (${details?.history?.size ?: 0})", fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(vertical = 8.dp))
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                if (isLoading) {
                    Box(modifier = Modifier.fillMaxWidth().height(150.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = SaldaOrangePrimary, strokeWidth = 2.dp)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth().weight(1f, fill = false),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        when (detailTab) {
                            0 -> { // Смены и начисления
                                val pendList = details?.pendingTransactions ?: emptyList()
                                if (pendList.isEmpty()) {
                                    item {
                                        Text("Нет записей начислений за этот период", color = Zinc500, fontSize = 12.sp, modifier = Modifier.padding(vertical = 16.dp))
                                    }
                                } else {
                                    items(pendList) { t ->
                                        Card(
                                            modifier = Modifier.fillMaxWidth(),
                                            colors = CardDefaults.cardColors(containerColor = Zinc50),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth().padding(10.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Column(modifier = Modifier.weight(1f)) {
                                                    val title = t.trip?.tripNumber?.let { "Рейс №$it" } ?: (t.description ?: "Смена")
                                                    Text(title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Zinc800)
                                                    Text(t.transactionDate ?: t.createdAt ?: "", fontSize = 10.sp, color = Zinc500)
                                                }
                                                Text("+${t.amount.toInt()} ₽", fontWeight = FontWeight.Black, fontSize = 13.sp, color = GreenOnline)
                                            }
                                        }
                                    }
                                }
                            }
                            1 -> { // История выплат и списаний
                                val histList = details?.history ?: emptyList()
                                if (histList.isEmpty()) {
                                    item {
                                        Text("Выплат в этом месяце еще не было", color = Zinc500, fontSize = 12.sp, modifier = Modifier.padding(vertical = 16.dp))
                                    }
                                } else {
                                    items(histList) { h ->
                                        Card(
                                            modifier = Modifier.fillMaxWidth(),
                                            colors = CardDefaults.cardColors(containerColor = Zinc50),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth().padding(10.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Column(modifier = Modifier.weight(1f)) {
                                                    val title = h.description ?: if (h.isPayout) "Выплата зарплаты" else "Списание"
                                                    Text(title, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Zinc800)
                                                    Text(h.transactionDate ?: h.createdAt ?: "", fontSize = 10.sp, color = Zinc500)
                                                }
                                                Text("-${h.amount.toInt()} ₽", fontWeight = FontWeight.Black, fontSize = 13.sp, color = Zinc800)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onSettleClick,
                colors = ButtonDefaults.buttonColors(containerColor = GreenOnline),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("💰 Выплатить зарплату", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Закрыть", color = Zinc700)
            }
        }
    )
}

/**
 * Диалог выплаты заработной платы сотруднику (Штат)
 */
@Composable
fun StaffSettleDialog(
    employee: PayrollEmployee,
    wallets: List<WalletBalance>,
    adminId: String,
    onDismiss: () -> Unit,
    onSuccess: () -> Unit
) {
    val initialAmount = remember {
        if (employee.debtDouble > 0) employee.debtDouble.toInt().toString() else ""
    }
    var amountInput by rememberSaveable { mutableStateOf(initialAmount) }
    var selectedWalletId by rememberSaveable {
        mutableStateOf(wallets.firstOrNull { it.type == "cash" }?.id ?: wallets.firstOrNull()?.id ?: "")
    }
    var offsetAdvance by rememberSaveable { mutableStateOf(employee.advanceDouble > 0) }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = { if (!isSubmitting) onDismiss() },
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("💰 Выплата: ${employee.name}", fontWeight = FontWeight.Black, fontSize = 18.sp)
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Карточка текущего долга
                Surface(
                    color = SaldaOrange50,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Текущий долг к выплате", fontSize = 11.sp, color = Zinc600)
                            Text(
                                text = "${employee.debtDouble.toInt()} ₽",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Black,
                                color = if (employee.debtDouble > 0) RedAlert else GreenOnline
                            )
                        }
                        if (employee.advanceDouble > 0) {
                            Column(horizontalAlignment = Alignment.End) {
                                Text("Аванс", fontSize = 11.sp, color = Zinc600)
                                Text("${employee.advanceDouble.toInt()} ₽", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = AmberPending)
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = amountInput,
                    onValueChange = { amountInput = it },
                    label = { Text("Сумма выплаты (₽) *") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Быстрые кнопки суммы
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    if (employee.debtDouble > 0) {
                        Surface(
                            onClick = { amountInput = employee.debtDouble.toInt().toString() },
                            color = Zinc100,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Весь долг (${employee.debtDouble.toInt()} ₽)", fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp))
                        }
                    }
                    listOf(5000, 10000, 15000, 20000).forEach { quickAmt ->
                        Surface(
                            onClick = { amountInput = quickAmt.toString() },
                            color = Zinc100,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("${String.format("%,d", quickAmt).replace(',', ' ')} ₽", fontSize = 11.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp))
                        }
                    }
                }

                Text("Списать со счета / кошелька:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Zinc700)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    wallets.forEach { w ->
                        val isSelected = selectedWalletId == w.id
                        Surface(
                            onClick = { selectedWalletId = w.id },
                            color = if (isSelected) SaldaOrange50 else Zinc50,
                            shape = RoundedCornerShape(10.dp),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isSelected) SaldaOrangePrimary else Zinc200
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(if (w.type == "bank") "🏛️" else if (w.type == "cash") "💵" else "⛽", fontSize = 16.sp)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = w.name,
                                        fontSize = 12.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        color = Zinc900
                                    )
                                }
                                Text(
                                    text = "${String.format("%,d", w.balance.toLong()).replace(',', ' ')} ₽",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) SaldaOrangePrimary else Zinc700
                                )
                            }
                        }
                    }
                }

                if (employee.advanceDouble > 0) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { offsetAdvance = !offsetAdvance }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = offsetAdvance,
                            onCheckedChange = { offsetAdvance = it }
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Зачесть аванс (${employee.advanceDouble.toInt()} ₽)",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = Zinc800
                        )
                    }
                }

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
                        errorMsg = "Введите корректную сумму выплаты"
                        return@Button
                    }
                    if (selectedWalletId.isBlank()) {
                        errorMsg = "Выберите кошелек для списания"
                        return@Button
                    }
                    scope.launch {
                        isSubmitting = true
                        errorMsg = null
                        val offsetAmt = if (offsetAdvance) employee.advanceDouble else 0.0
                        val ok = SaldaApiClient.settleStaffPayroll(
                            userId = employee.id,
                            amount = amt,
                            fromWalletId = selectedWalletId,
                            offsetAmount = offsetAmt,
                            adminId = adminId
                        )
                        isSubmitting = false
                        if (ok) {
                            onSuccess()
                        } else {
                            errorMsg = "Не удалось провести выплату"
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = GreenOnline),
                shape = RoundedCornerShape(10.dp),
                enabled = !isSubmitting
            ) {
                Text(if (isSubmitting) "Проведение..." else "Подтвердить выплату", fontWeight = FontWeight.Black)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isSubmitting) {
                Text("Отмена", color = Zinc700)
            }
        }
    )
}
