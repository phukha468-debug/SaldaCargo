package ru.ancargo66.app.features.dispatcher

import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import ru.ancargo66.app.core.model.*
import ru.ancargo66.app.core.network.SaldaApiClient
import ru.ancargo66.app.features.driver.TripDetailScreen
import ru.ancargo66.app.ui.theme.*

@Composable
fun DispatcherScreen(
    user: User,
    onLogout: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) } // 0: Ревью, 1: Активные, 2: Касса, 3: Грузчики
    var adminSummary by remember { mutableStateOf<AdminSummary?>(null) }
    var reviewTrips by remember { mutableStateOf<List<TripDetail>>(emptyList()) }
    var activeTrips by remember { mutableStateOf<List<TripDetail>>(emptyList()) }
    var wallets by remember { mutableStateOf<List<WalletBalance>>(emptyList()) }
    var loaders by remember { mutableStateOf<List<User>>(emptyList()) }
    var selectedTripIdForDetails by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var approvingTripId by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()

    val refreshAll = {
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
                                Icon(Icons.Default.Dashboard, contentDescription = null, tint = SaldaOrangePrimary)
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(text = user.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Zinc900)
                            Text(text = "Диспетчер • Офис", fontSize = 12.sp, color = Zinc500)
                        }
                    }
                    IconButton(onClick = onLogout) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Выйти", tint = Zinc500)
                    }
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Zinc50)
                .padding(innerPadding)
                .padding(16.dp)
        ) {
            // Верхняя сводка
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(10.dp),
                    border = CardDefaults.outlinedCardBorder()
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text("НА ПРОВЕРКЕ", fontSize = 9.sp, fontWeight = FontWeight.Black, color = AmberPending)
                        Text("${adminSummary?.pendingReview ?: reviewTrips.size}", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Zinc900)
                    }
                }

                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(10.dp),
                    border = CardDefaults.outlinedCardBorder()
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text("АКТИВНЫЕ", fontSize = 9.sp, fontWeight = FontWeight.Black, color = SaldaOrangePrimary)
                        Text("${adminSummary?.activeTrips ?: activeTrips.size}", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Zinc900)
                    }
                }

                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(10.dp),
                    border = CardDefaults.outlinedCardBorder()
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text("ВЫРУЧКА СЕГОДНЯ", fontSize = 9.sp, fontWeight = FontWeight.Black, color = GreenOnline)
                        Text("${adminSummary?.todayRevenue ?: "0"} ₽", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = GreenOnline)
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Табы управления
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = Zinc100,
                contentColor = SaldaOrangePrimary
            ) {
                Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }) {
                    Text("Проверка (${reviewTrips.size})", modifier = Modifier.padding(8.dp), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
                Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }) {
                    Text("В пути (${activeTrips.size})", modifier = Modifier.padding(8.dp), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
                Tab(selected = selectedTab == 2, onClick = { selectedTab = 2 }) {
                    Text("Касса / Счета", modifier = Modifier.padding(8.dp), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
                Tab(selected = selectedTab == 3, onClick = { selectedTab = 3 }) {
                    Text("Грузчики (${loaders.size})", modifier = Modifier.padding(8.dp), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = SaldaOrangePrimary)
                }
            } else {
                when (selectedTab) {
                    0 -> { // Рейсы на проверке
                        if (reviewTrips.isEmpty()) {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text("Все рейсы проверены и утверждены 👍", color = Zinc500, fontSize = 14.sp)
                            }
                        } else {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                items(reviewTrips, key = { it.id }) { trip ->
                                    val activeOrders = trip.tripOrders.filter { it.lifecycleStatus != "cancelled" }
                                    val rev = activeOrders.sumOf { it.amount }
                                    val driverPay = activeOrders.sumOf { it.driverPay }

                                    Card(
                                        onClick = { selectedTripIdForDetails = trip.id },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = CardDefaults.cardColors(containerColor = Color.White),
                                        shape = RoundedCornerShape(12.dp),
                                        border = CardDefaults.outlinedCardBorder()
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
                    }

                    1 -> { // Активные рейсы
                        if (activeTrips.isEmpty()) {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text("Сейчас нет активных рейсов на линии", color = Zinc500, fontSize = 14.sp)
                            }
                        } else {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                items(activeTrips, key = { it.id }) { trip ->
                                    Card(
                                        onClick = { selectedTripIdForDetails = trip.id },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = CardDefaults.cardColors(containerColor = Color.White),
                                        shape = RoundedCornerShape(12.dp),
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
                    }

                    2 -> { // Касса и счета (Т-Банк, Сейф, Опти24)
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            items(wallets, key = { it.id }) { w ->
                                Card(
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
                                        Text(
                                            text = "${w.balance.toInt()} ₽",
                                            fontWeight = FontWeight.Black,
                                            fontSize = 17.sp,
                                            color = Zinc900
                                        )
                                    }
                                }
                            }
                        }
                    }

                    3 -> { // Грузчики
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(loaders, key = { it.id }) { loader ->
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = Color.White),
                                    shape = RoundedCornerShape(10.dp),
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
    }
}
