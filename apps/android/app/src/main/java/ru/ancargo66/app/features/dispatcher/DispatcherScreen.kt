package ru.ancargo66.app.features.dispatcher

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import ru.ancargo66.app.R
import ru.ancargo66.app.core.model.*
import ru.ancargo66.app.core.network.SaldaApiClient
import ru.ancargo66.app.features.driver.TripDetailScreen
import ru.ancargo66.app.ui.theme.*

@Composable
fun DispatcherScreen(
    user: User,
    onLogout: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) } // 0: Ревью, 1: В пути, 2: Счета, 3: Штат
    var adminSummary by remember { mutableStateOf<AdminSummary?>(null) }
    var reviewTrips by remember { mutableStateOf<List<TripDetail>>(emptyList()) }
    var activeTrips by remember { mutableStateOf<List<TripDetail>>(emptyList()) }
    var wallets by remember { mutableStateOf<List<WalletBalance>>(emptyList()) }
    var loaders by remember { mutableStateOf<List<User>>(emptyList()) }
    var selectedTripIdForDetails by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var approvingTripId by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()

    val refreshAll: () -> Unit = {
        scope.launch {
            isLoading = true
            try {
                adminSummary = SaldaApiClient.getAdminSummary(user.id)
                reviewTrips = SaldaApiClient.getAdminTrips(filter = "review", adminId = user.id)
                activeTrips = SaldaApiClient.getAdminTrips(filter = "active", adminId = user.id)
                wallets = SaldaApiClient.getWallets(userId = user.id)
                loaders = SaldaApiClient.getLoaders()
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
    if (detailId != null) {
        TripDetailScreen(
            tripId = detailId,
            userId = user.id,
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
                                color = Zinc500
                            )
                        }
                    }

                    OutlinedButton(
                        onClick = onLogout,
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Zinc500),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCBD5E1)),
                        modifier = Modifier.bouncyTouch()
                    ) {
                        Text("Выйти", fontSize = 12.sp, fontWeight = FontWeight.Bold)
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

            // 2. БЫСТРЫЕ ДЕЙСТВИЯ (2 крупные кнопки)
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = { selectedTab = 2 },
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
                        onClick = { selectedTab = 2 },
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
                        Text("Штат (${loaders.size})", modifier = Modifier.padding(vertical = 12.dp), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // 6. СПИСКИ СООТВЕТСТВУЮЩИХ РАЗДЕЛОВ
            when (selectedTab) {
                0 -> { // Рейсы на проверке
                    if (reviewTrips.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 24.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("Все рейсы проверены и утверждены 👍", color = Zinc500, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            }
                        }
                    } else {
                        items(reviewTrips, key = { it.id }) { trip ->
                            val activeOrders = trip.tripOrders.filter { it.lifecycleStatus != "cancelled" }
                            val rev = activeOrders.sumOf { it.amount }
                            val driverPay = activeOrders.sumOf { it.driverPay }

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
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text(
                                                text = "Рейс №${trip.tripNumber} • ${trip.asset?.shortName ?: "Без авто"}",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 15.sp,
                                                color = Zinc900
                                            )
                                            Text(
                                                text = "Водитель: ${trip.driver?.name ?: "—"}",
                                                fontSize = 12.sp,
                                                color = Zinc500
                                            )
                                        }
                                        Surface(
                                            color = AmberPending.copy(alpha = 0.15f),
                                            shape = RoundedCornerShape(6.dp)
                                        ) {
                                            Text(
                                                text = "ЖДЁТ АПРУВА",
                                                color = AmberPending,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 10.sp,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "Выручка: ${rev.toInt()} ₽ • ЗП: ${driverPay.toInt()} ₽",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Zinc700
                                        )

                                        Button(
                                            onClick = {
                                                scope.launch {
                                                    approvingTripId = trip.id
                                                    SaldaApiClient.approveTrip(trip.id, user.id)
                                                    approvingTripId = null
                                                    refreshAll()
                                                }
                                            },
                                            colors = ButtonDefaults.buttonColors(containerColor = GreenOnline),
                                            shape = RoundedCornerShape(8.dp),
                                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                                            enabled = approvingTripId != trip.id
                                        ) {
                                            Text(if (approvingTripId == trip.id) "..." else "Одобрить", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                1 -> { // Активные рейсы
                    if (activeTrips.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 24.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("Сейчас нет активных рейсов на линии", color = Zinc500, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            }
                        }
                    } else {
                        items(activeTrips, key = { it.id }) { trip ->
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
                                    Column {
                                        Text(
                                            text = "Рейс №${trip.tripNumber} • ${trip.asset?.shortName ?: "Без авто"}",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp,
                                            color = Zinc900
                                        )
                                        Text(
                                            text = "Водитель: ${trip.driver?.name ?: "—"} • ${trip.asset?.regNumber ?: ""}",
                                            fontSize = 12.sp,
                                            color = Zinc500
                                        )
                                    }
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
                                            color = Zinc500
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

                3 -> { // Грузчики / Штат
                    items(loaders, key = { it.id }) { loader ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(14.dp),
                            border = CardDefaults.outlinedCardBorder()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(
                                        color = SaldaOrange50,
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier.size(36.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text("👷", fontSize = 18.sp)
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column {
                                        Text(text = loader.name, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                        Text(text = loader.phone ?: "Сотрудник ПРР", fontSize = 11.sp, color = Zinc500)
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
