package ru.ancargo66.app.features.driver

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import ru.ancargo66.app.R
import ru.ancargo66.app.core.model.*
import ru.ancargo66.app.core.network.SaldaApiClient
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.saveable.rememberSaveable
import ru.ancargo66.app.features.auth.PinScreen
import ru.ancargo66.app.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

private fun formatMonthRussian(yyyyMm: String): String {
    val parts = yyyyMm.split("-")
    if (parts.size != 2) return yyyyMm
    val monthNames = listOf(
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    )
    val mIndex = (parts[1].toIntOrNull() ?: 1) - 1
    val mName = if (mIndex in 0..11) monthNames[mIndex] else parts[1]
    return "$mName ${parts[0]}"
}

private fun formatDayRussian(yyyyMmDd: String): String {
    val parts = yyyyMmDd.split("-")
    if (parts.size != 3) return yyyyMmDd
    val monthNamesGenitive = listOf(
        "января", "февраля", "марта", "апреля", "мая", "июня",
        "июля", "августа", "сентября", "октября", "ноября", "декабря"
    )
    val dayNum = parts[2].toIntOrNull() ?: parts[2]
    val mIndex = (parts[1].toIntOrNull() ?: 1) - 1
    val mName = if (mIndex in 0..11) monthNamesGenitive[mIndex] else parts[1]
    return "$dayNum $mName ${parts[0]}"
}

private fun shiftMonthKey(current: String, delta: Int): String {
    return try {
        val sdf = SimpleDateFormat("yyyy-MM", Locale.US)
        val cal = Calendar.getInstance()
        cal.time = sdf.parse(current) ?: Date()
        cal.add(Calendar.MONTH, delta)
        sdf.format(cal.time)
    } catch (_: Exception) { current }
}

private fun shiftDayKey(current: String, delta: Int): String {
    return try {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val cal = Calendar.getInstance()
        cal.time = sdf.parse(current) ?: Date()
        cal.add(Calendar.DAY_OF_MONTH, delta)
        sdf.format(cal.time)
    } catch (_: Exception) { current }
}

@Composable
fun DriverScreen(
    user: User,
    onLogout: () -> Unit
) {
    var summary by remember { mutableStateOf<DriverSummary?>(SaldaApiClient.getCachedSummary()) }
    var assets by remember { mutableStateOf<List<Asset>>(SaldaApiClient.getCachedAssets() ?: emptyList()) }
    var selectedTripIdForDetails by rememberSaveable { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(SaldaApiClient.getCachedSummary() == null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    var showVehiclePicker by remember { mutableStateOf(false) }
    var currentAssetId by rememberSaveable { mutableStateOf(user.currentAssetId) }
    var isStartingTrip by remember { mutableStateOf(false) }
    var startTripError by remember { mutableStateOf<String?>(null) }
    var financeInitialTab by rememberSaveable { mutableStateOf<Int?>(null) }
    var showCreatePrrDialog by rememberSaveable { mutableStateOf(false) }
    var showChangePinScreen by rememberSaveable { mutableStateOf(false) }
    var showAllTripsModal by rememberSaveable { mutableStateOf(false) }
    var allTrips by remember { mutableStateOf<List<TripSummaryItem>>(emptyList()) }
    var isLoadingAllTrips by remember { mutableStateOf(false) }

    // Фильтр истории рейсов (Все, За месяц, За день)
    var tripsFilterMode by rememberSaveable { mutableStateOf("ALL") } // "ALL", "MONTH", "DAY"
    var selectedMonthKey by rememberSaveable { mutableStateOf("") }
    var selectedDayKey by rememberSaveable { mutableStateOf("") }

    val scope = rememberCoroutineScope()

    LaunchedEffect(showAllTripsModal) {
        if (showAllTripsModal) {
            isLoadingAllTrips = true
            try {
                val fetched = SaldaApiClient.getDriverTrips(user.id)
                allTrips = fetched
                if (selectedMonthKey.isBlank()) {
                    val latest = fetched.firstOrNull()?.startedAt?.take(7)
                    selectedMonthKey = if (!latest.isNullOrBlank()) latest else SimpleDateFormat("yyyy-MM", Locale.US).format(Date())
                }
                if (selectedDayKey.isBlank()) {
                    val latest = fetched.firstOrNull()?.startedAt?.take(10)
                    selectedDayKey = if (!latest.isNullOrBlank()) latest else SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                }
            } catch (_: Exception) {
            } finally {
                isLoadingAllTrips = false
            }
        }
    }

    val refreshData = {
        scope.launch {
            if (summary == null) isLoading = true
            errorMessage = null
            try {
                // Параллельная загрузка сводки и списка машин вместо последовательной
                coroutineScope {
                    val sumDeferred = async { SaldaApiClient.getDriverSummary(user.id, forceRefresh = summary == null) }
                    val astsDeferred = async { SaldaApiClient.getDriverAssets(user.id) }
                    summary = sumDeferred.await()
                    val asts = astsDeferred.await()
                    assets = asts
                    if (currentAssetId == null && asts.isNotEmpty()) {
                        currentAssetId = user.currentAssetId ?: asts.first().id
                    }
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Ошибка загрузки данных"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(user.id) {
        refreshData()
    }

    // Если открыт экран смены PIN-кода
    if (showChangePinScreen) {
        PinScreen(
            user = user,
            isChangePinMode = true,
            onSuccess = { showChangePinScreen = false },
            onCancel = { showChangePinScreen = false }
        )
        return
    }

    // Если открыт экран финансов водителя
    val finTab = financeInitialTab
    if (finTab != null) {
        DriverFinanceScreen(
            user = user,
            initialTab = finTab,
            onBack = { financeInitialTab = null }
        )
        return
    }

    // Если открыт экран деталей рейса
    val detailId = selectedTripIdForDetails
    if (detailId != null) {
        TripDetailScreen(
            tripId = detailId,
            userId = user.id,
            isAdmin = user.roles.any { it == "admin" || it == "owner" || it == "director" },
            onBack = { selectedTripIdForDetails = null },
            onTripUpdated = {
                refreshData()
                selectedTripIdForDetails = null
            }
        )
        return
    }

    val currentAsset = assets.firstOrNull { it.id == currentAssetId } ?: assets.firstOrNull()
    val activeTrip = summary?.activeTrip
    val reviewTrips = summary?.reviewTrips ?: emptyList()
    val recentTrips = summary?.recentTrips ?: emptyList()

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
                            color = Color.White,
                            shape = RoundedCornerShape(10.dp),
                            shadowElevation = 1.dp,
                            modifier = Modifier.size(42.dp)
                        ) {
                            Image(
                                painter = painterResource(R.drawable.logo),
                                contentDescription = "TK501 Logo",
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(2.dp)
                                    .clip(RoundedCornerShape(8.dp))
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "Привет, ${user.name}! 👋",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Zinc900
                            )
                            Text(text = "Водитель • СалдаКарго", fontSize = 12.sp, color = Zinc500)
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { showChangePinScreen = true }) {
                            Icon(Icons.Default.Lock, contentDescription = "Сменить PIN", tint = Zinc700)
                        }
                        IconButton(onClick = onLogout) {
                            Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Выйти", tint = Zinc700)
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        if (isLoading && summary == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = SaldaOrangePrimary)
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Zinc50)
                    .padding(innerPadding)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Карточка ЗП и заработка водителя за текущий месяц
                item {
                    val approvedPay = summary?.monthPayApproved ?: "0.00"
                    val draftPay = summary?.monthPayDraft ?: "0.00"
                    val hasDraft = (draftPay.toDoubleOrNull() ?: 0.0) > 0.0
                    val pendingCount = summary?.pendingPayrollCount ?: 0

                    Card(
                        onClick = { financeInitialTab = 1 },
                        modifier = Modifier
                            .fillMaxWidth()
                            .bouncyTouch(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        shape = RoundedCornerShape(18.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp, pressedElevation = 4.dp)
                    ) {
                        Column(modifier = Modifier.padding(18.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "МОЙ ДОХОД ЗА МЕСЯЦ",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Zinc400,
                                    letterSpacing = 1.2.sp
                                )
                                Surface(
                                    color = Color(0xFFECFDF5),
                                    shape = RoundedCornerShape(8.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFA7F3D0))
                                ) {
                                    Text(
                                        text = "Зарплата →",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = GreenOnline,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "${approvedPay.toDoubleOrNull()?.toInt() ?: approvedPay} ₽",
                                fontSize = 30.sp,
                                fontWeight = FontWeight.Black,
                                color = Zinc900
                            )
                            if (hasDraft) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(
                                        color = AmberPending.copy(alpha = 0.15f),
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text(
                                            text = "+${draftPay.toDoubleOrNull()?.toInt() ?: draftPay} ₽ на проверке",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = AmberPending,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            }
                            if (pendingCount > 0) {
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "Ожидают подтверждения: $pendingCount выплат",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = RedAlert
                                )
                            }
                        }
                    }
                }

                // Карточка автомобиля (если нет активного рейса)
                if (activeTrip == null) {
                    item {
                        Card(
                            onClick = { showVehiclePicker = true },
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
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(
                                        color = SaldaOrange50,
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.size(42.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text(
                                                text = if (currentAsset?.regNumber == "БЕЗ АВТО") "👷" else "🚚",
                                                fontSize = 20.sp
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text(
                                            text = "АКТИВНЫЙ АВТОМОБИЛЬ",
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Black,
                                            color = Zinc400,
                                            letterSpacing = 1.sp
                                        )
                                        Text(
                                            text = currentAsset?.let { "${it.shortName} • ${it.regNumber}" } ?: "Не выбран",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp,
                                            color = Zinc900
                                        )
                                    }
                                }
                                Surface(
                                    color = SaldaOrange50,
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text(
                                        text = "СМЕНИТЬ",
                                        color = SaldaOrangePrimary,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Black,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                // Кнопки старта рейса (если нет активного рейса и нет блокирующих ревью)
                if (activeTrip == null) {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (startTripError != null) {
                                Surface(
                                    color = RedAlert.copy(alpha = 0.1f),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = startTripError ?: "",
                                        color = RedAlert,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(10.dp)
                                    )
                                }
                            }

                            Button(
                                onClick = {
                                    val asset = currentAsset
                                    if (asset == null) {
                                        showVehiclePicker = true
                                        startTripError = "Выберите автомобиль перед началом рейса"
                                        return@Button
                                    }
                                    scope.launch {
                                        isStartingTrip = true
                                        startTripError = null
                                        try {
                                            val newTrip = SaldaApiClient.startTrip(
                                                driverId = user.id,
                                                assetId = asset.id,
                                                odometerStart = asset.odometerCurrent,
                                                isPrr = asset.regNumber == "БЕЗ АВТО"
                                            )
                                            selectedTripIdForDetails = newTrip.id
                                            refreshData()
                                        } catch (e: Exception) {
                                            startTripError = e.message ?: "Ошибка создания рейса"
                                        } finally {
                                            isStartingTrip = false
                                        }
                                    }
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(54.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = SaldaOrangePrimary),
                                shape = RoundedCornerShape(12.dp),
                                enabled = !isStartingTrip
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.Center
                                ) {
                                    Text(
                                        text = if (currentAsset?.regNumber == "БЕЗ АВТО") "👷" else "🚚",
                                        fontSize = 20.sp
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = if (isStartingTrip) "СОЗДАЁМ РЕЙС..." else if (currentAsset?.regNumber == "БЕЗ АВТО") "НАЧАТЬ РЕЙС (БЕЗ АВТО)" else "НАЧАТЬ РЕЙС",
                                        fontWeight = FontWeight.Black,
                                        fontSize = 16.sp
                                    )
                                }
                            }
                        }
                    }
                } else {
                    // Баннер АКТИВНОГО РЕЙСА (стиль MAX MiniApp)
                    item {
                        Card(
                            onClick = { selectedTripIdForDetails = activeTrip.id },
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = SaldaOrange50),
                            shape = RoundedCornerShape(12.dp),
                            border = CardDefaults.outlinedCardBorder().copy(
                                brush = androidx.compose.ui.graphics.SolidColor(SaldaOrangePrimary),
                                width = 2.dp
                            )
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "АКТИВНЫЙ РЕЙС",
                                        fontWeight = FontWeight.Black,
                                        fontSize = 10.sp,
                                        color = SaldaOrangePrimary,
                                        letterSpacing = 1.sp
                                    )
                                    Surface(
                                        color = GreenOnline,
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text(
                                            text = "⏱ В ПУТИ",
                                            color = Color.White,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "Рейс №${activeTrip.tripNumber} · ${activeTrip.asset?.shortName ?: "Без авто"}",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 18.sp,
                                    color = Zinc900
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Text(
                                    text = "ОТКРЫТЬ РЕЙС →",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 13.sp,
                                    color = SaldaOrangePrimary
                                )
                            }
                        }
                    }
                }

                // Секция: НА ПРОВЕРКЕ У АДМИНИСТРАТОРА (reviewTrips)
                if (reviewTrips.isNotEmpty()) {
                    item {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "НА ПРОВЕРКЕ У АДМИНИСТРАТОРА (${reviewTrips.size})",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = AmberPending,
                            letterSpacing = 1.sp
                        )
                    }

                    items(reviewTrips, key = { it.id }) { trip ->
                        val orders = trip.tripOrders.filter { it.lifecycleStatus != "cancelled" }
                        val rev = orders.sumOf { it.amount }
                        val pay = orders.sumOf { it.driverPay }

                        Card(
                            onClick = { selectedTripIdForDetails = trip.id },
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7).copy(alpha = 0.5f)),
                            shape = RoundedCornerShape(12.dp),
                            border = CardDefaults.outlinedCardBorder().copy(
                                brush = androidx.compose.ui.graphics.SolidColor(Color(0xFFF59E0B)),
                                width = 1.dp
                            )
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "ЖДЁТ ПРОВЕРКИ",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFFB45309)
                                    )
                                    Text(
                                        text = "Рейс №${trip.tripNumber}",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Zinc700
                                    )
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "${trip.asset?.shortName ?: "Без авто"}",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 16.sp,
                                    color = Zinc900
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "Администратор ещё не проверил",
                                        fontSize = 11.sp,
                                        color = Color(0xFFB45309),
                                        fontWeight = FontWeight.Medium
                                    )
                                    Column(horizontalAlignment = Alignment.End) {
                                        Text(
                                            text = "${rev.toInt()} ₽",
                                            fontWeight = FontWeight.Black,
                                            fontSize = 14.sp,
                                            color = Zinc900
                                        )
                                        Text(
                                            text = "ЗП: ${pay.toInt()} ₽",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = GreenOnline
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Секция: ПОСЛЕДНИЕ РЕЙСЫ (recentTrips)
                if (recentTrips.isNotEmpty()) {
                    item {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "ПОСЛЕДНИЕ РЕЙСЫ",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = Zinc400,
                            letterSpacing = 1.sp
                        )
                    }

                    items(recentTrips, key = { it.id }) { trip ->
                        val orders = trip.tripOrders.filter { it.lifecycleStatus != "cancelled" }
                        val rev = orders.sumOf { it.amount }
                        val pay = orders.sumOf { it.driverPay }

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
                                        text = "Рейс №${trip.tripNumber} · ${trip.asset?.shortName ?: "Без авто"}",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = Zinc900
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = "Выручка: ${rev.toInt()} ₽",
                                        fontSize = 12.sp,
                                        color = Zinc500
                                    )
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        text = "ЗП: ${pay.toInt()} ₽",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = GreenOnline
                                    )
                                    Surface(
                                        color = GreenOnline.copy(alpha = 0.1f),
                                        shape = RoundedCornerShape(4.dp),
                                        modifier = Modifier.padding(top = 2.dp)
                                    ) {
                                        Text(
                                            text = "Утверждён",
                                            color = GreenOnline,
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Кнопка перехода ко всей истории рейсов
                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedButton(
                        onClick = { showAllTripsModal = true },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Zinc300),
                        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White)
                    ) {
                        Icon(Icons.Default.History, contentDescription = null, tint = Zinc700, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "📜 ВСЯ ИСТОРИЯ РЕЙСОВ",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = Zinc900
                        )
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(20.dp))
                }
            }
        }
    }

    // Модалка истории всех рейсов водителя с компактным фильтром по времени
    if (showAllTripsModal) {
        BackHandler { showAllTripsModal = false }

        // Расчёт отфильтрованных рейсов
        val filteredTrips = when (tripsFilterMode) {
            "MONTH" -> allTrips.filter { it.startedAt?.take(7) == selectedMonthKey }
            "DAY" -> allTrips.filter { it.startedAt?.take(10) == selectedDayKey }
            else -> allTrips
        }

        val totalPayForPeriod = filteredTrips.sumOf { tr ->
            tr.tripOrders.filter { it.lifecycleStatus != "cancelled" }.sumOf { it.driverPay }
        }

        // Дни, в которые есть рейсы в выбранном месяце
        val activeDaysInMonth = allTrips
            .mapNotNull { it.startedAt?.take(10) }
            .filter { it.startsWith(selectedMonthKey) }
            .distinct()
            .sortedDescending()

        AlertDialog(
            onDismissRequest = { showAllTripsModal = false },
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("История рейсов", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    IconButton(onClick = { showAllTripsModal = false }, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = Zinc500)
                    }
                }
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Компактные переключатели режима фильтрации: [Все] [Месяц] [День]
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Zinc100, shape = RoundedCornerShape(10.dp))
                            .padding(3.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        listOf("ALL" to "Все", "MONTH" to "Месяц", "DAY" to "День").forEach { (mode, label) ->
                            val isSelected = tripsFilterMode == mode
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable {
                                        tripsFilterMode = mode
                                        if (mode == "DAY" && selectedDayKey.isBlank()) {
                                            selectedDayKey = allTrips.firstOrNull()?.startedAt?.take(10)
                                                ?: SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                                        }
                                        if (mode == "MONTH" && selectedMonthKey.isBlank()) {
                                            selectedMonthKey = allTrips.firstOrNull()?.startedAt?.take(7)
                                                ?: SimpleDateFormat("yyyy-MM", Locale.US).format(Date())
                                        }
                                    },
                                color = if (isSelected) SaldaOrangePrimary else Color.Transparent,
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    text = label,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) Color.White else Zinc600,
                                    modifier = Modifier.padding(vertical = 6.dp),
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                )
                            }
                        }
                    }

                    // Переключатель периода для месяца
                    if (tripsFilterMode == "MONTH") {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color.White, shape = RoundedCornerShape(10.dp))
                                .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(10.dp))
                                .padding(horizontal = 6.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            IconButton(
                                onClick = { selectedMonthKey = shiftMonthKey(selectedMonthKey, -1) },
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Пред. месяц", tint = Zinc700, modifier = Modifier.size(16.dp))
                            }
                            Text(
                                text = formatMonthRussian(selectedMonthKey.ifBlank { SimpleDateFormat("yyyy-MM", Locale.US).format(Date()) }),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Black,
                                color = Zinc900
                            )
                            IconButton(
                                onClick = { selectedMonthKey = shiftMonthKey(selectedMonthKey, 1) },
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(Icons.Default.ArrowForward, contentDescription = "След. месяц", tint = Zinc700, modifier = Modifier.size(16.dp))
                            }
                        }
                    }

                    // Переключатель периода для дня
                    if (tripsFilterMode == "DAY") {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color.White, shape = RoundedCornerShape(10.dp))
                                    .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(10.dp))
                                    .padding(horizontal = 6.dp, vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                IconButton(
                                    onClick = { selectedDayKey = shiftDayKey(selectedDayKey, -1) },
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Пред. день", tint = Zinc700, modifier = Modifier.size(16.dp))
                                }
                                Text(
                                    text = formatDayRussian(selectedDayKey.ifBlank { SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()) }),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Zinc900
                                )
                                IconButton(
                                    onClick = { selectedDayKey = shiftDayKey(selectedDayKey, 1) },
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(Icons.Default.ArrowForward, contentDescription = "След. день", tint = Zinc700, modifier = Modifier.size(16.dp))
                                }
                            }

                            // Быстрые чипы дней с рейсами
                            if (activeDaysInMonth.isNotEmpty()) {
                                LazyRow(
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    items(activeDaysInMonth) { dayStr ->
                                        val dayPart = dayStr.split("-").lastOrNull() ?: dayStr
                                        val isCur = selectedDayKey == dayStr
                                        Surface(
                                            modifier = Modifier.clickable { selectedDayKey = dayStr },
                                            color = if (isCur) SaldaOrange50 else Zinc100,
                                            border = androidx.compose.foundation.BorderStroke(1.dp, if (isCur) SaldaOrangePrimary else Zinc200),
                                            shape = RoundedCornerShape(6.dp)
                                        ) {
                                            Text(
                                                text = "$dayPart число",
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = if (isCur) SaldaOrangePrimary else Zinc600,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Сводка по выбранному фильтру
                    Surface(
                        color = Zinc50,
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Zinc200),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Рейсов: ${filteredTrips.size}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Zinc600
                            )
                            Text(
                                text = "ЗП: ${totalPayForPeriod.toInt()} ₽",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                color = GreenOnline
                            )
                        }
                    }

                    // Список рейсов
                    if (isLoadingAllTrips) {
                        Box(modifier = Modifier.fillMaxWidth().height(160.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = SaldaOrangePrimary)
                        }
                    } else if (filteredTrips.isEmpty()) {
                        Box(modifier = Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("Нет рейсов за выбранный период", color = Zinc400, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                if (tripsFilterMode != "ALL") {
                                    Spacer(modifier = Modifier.height(6.dp))
                                    TextButton(onClick = { tripsFilterMode = "ALL" }) {
                                        Text("Показать все рейсы", fontSize = 11.sp, color = SaldaOrangePrimary)
                                    }
                                }
                            }
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 380.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(filteredTrips, key = { it.id }) { trip ->
                                val orders = trip.tripOrders.filter { it.lifecycleStatus != "cancelled" }
                                val rev = orders.sumOf { it.amount }
                                val pay = orders.sumOf { it.driverPay }
                                val isApproved = trip.lifecycleStatus == "approved"
                                val isDraft = trip.lifecycleStatus == "draft"

                                Card(
                                    onClick = {
                                        showAllTripsModal = false
                                        selectedTripIdForDetails = trip.id
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = Color.White),
                                    border = CardDefaults.outlinedCardBorder(),
                                    shape = RoundedCornerShape(10.dp)
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
                                                text = "Рейс №${trip.tripNumber} · ${trip.asset?.shortName ?: "Без авто"}",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp,
                                                color = Zinc900
                                            )
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Text(
                                                text = "${trip.startedAt?.take(10) ?: ""} · Выручка: ${rev.toInt()} ₽",
                                                fontSize = 11.sp,
                                                color = Zinc500
                                            )
                                        }
                                        Column(horizontalAlignment = Alignment.End) {
                                            Text(
                                                text = "ЗП: ${pay.toInt()} ₽",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 12.sp,
                                                color = GreenOnline
                                            )
                                            Surface(
                                                color = if (isApproved) GreenOnline.copy(alpha = 0.1f) else Color(0xFFFEF3C7),
                                                shape = RoundedCornerShape(4.dp),
                                                modifier = Modifier.padding(top = 2.dp)
                                            ) {
                                                Text(
                                                    text = if (isApproved) "Утверждён" else if (isDraft) "На проверке" else trip.lifecycleStatus,
                                                    color = if (isApproved) GreenOnline else Color(0xFFB45309),
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                                )
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
                TextButton(onClick = { showAllTripsModal = false }) {
                    Text("Закрыть", color = Zinc700)
                }
            }
        )
    }

    // Модалка создания ПРР заказа
    if (showCreatePrrDialog) {
        CreatePrrDialog(
            userId = user.id,
            onDismiss = { showCreatePrrDialog = false },
            onSuccess = {
                showCreatePrrDialog = false
                refreshData()
            }
        )
    }

    // Модалка выбора автомобиля
    if (showVehiclePicker) {
        AlertDialog(
            onDismissRequest = { showVehiclePicker = false },
            title = {
                Text("Выбрать автомобиль", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            },
            text = {
                LazyColumn(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(assets, key = { it.id }) { v ->
                        val isSelected = v.id == currentAssetId
                        val isPrr = v.regNumber == "БЕЗ АВТО"

                        Card(
                            onClick = {
                                val selectedId = v.id
                                currentAssetId = selectedId
                                showVehiclePicker = false
                                scope.launch {
                                    SaldaApiClient.switchDriverAsset(user.id, selectedId)
                                    refreshData()
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = if (isSelected) SaldaOrange50 else Color.White
                            ),
                            border = CardDefaults.outlinedCardBorder().copy(
                                brush = androidx.compose.ui.graphics.SolidColor(
                                    if (isSelected) SaldaOrangePrimary else Zinc200
                                ),
                                width = if (isSelected) 2.dp else 1.dp
                            ),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = "${if (isPrr) "👷" else "🚚"} ${v.shortName}",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = Zinc900
                                    )
                                    Text(
                                        text = if (isPrr) "Погрузка без транспорта (ПРР)" else "${v.regNumber} • ${v.odometerCurrent} км",
                                        fontSize = 11.sp,
                                        color = Zinc500
                                    )
                                }
                                if (isSelected) {
                                    Surface(
                                        color = SaldaOrangePrimary,
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Text(
                                            text = "Выбран",
                                            color = Color.White,
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
            },
            confirmButton = {
                TextButton(onClick = { showVehiclePicker = false }) {
                    Text("Закрыть", color = Zinc700)
                }
            }
        )
    }
}
