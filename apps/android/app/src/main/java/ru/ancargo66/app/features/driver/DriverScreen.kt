package ru.ancargo66.app.features.driver

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import ru.ancargo66.app.core.model.*
import ru.ancargo66.app.core.network.SaldaApiClient
import ru.ancargo66.app.ui.theme.*

@Composable
fun DriverScreen(
    user: User,
    onLogout: () -> Unit
) {
    var summary by remember { mutableStateOf<DriverSummary?>(SaldaApiClient.getCachedSummary()) }
    var assets by remember { mutableStateOf<List<Asset>>(SaldaApiClient.getCachedAssets() ?: emptyList()) }
    var selectedTripIdForDetails by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(SaldaApiClient.getCachedSummary() == null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    var showVehiclePicker by remember { mutableStateOf(false) }
    var currentAssetId by remember { mutableStateOf(user.currentAssetId) }
    var isStartingTrip by remember { mutableStateOf(false) }
    var startTripError by remember { mutableStateOf<String?>(null) }
    var financeInitialTab by remember { mutableStateOf<Int?>(null) }
    var showCreatePrrDialog by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    val refreshData = {
        scope.launch {
            if (summary == null) isLoading = true
            errorMessage = null
            try {
                // Параллельная загрузка сводки и списка машин вместо последовательной
                coroutineScope {
                    val sumDeferred = async { SaldaApiClient.getDriverSummary(user.id, forceRefresh = true) }
                    val astsDeferred = async { SaldaApiClient.getDriverAssets(user.id) }
                    summary = sumDeferred.await()
                    val asts = astsDeferred.await()
                    assets = asts
                    if (currentAssetId == null && asts.isNotEmpty()) {
                        currentAssetId = asts.first().id
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
                            color = SaldaOrange50,
                            shape = RoundedCornerShape(20.dp),
                            modifier = Modifier.size(44.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.LocalShipping, contentDescription = null, tint = SaldaOrangePrimary)
                            }
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
                    IconButton(onClick = onLogout) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Выйти", tint = Zinc500)
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
                // Карточка подотчёта (На руках)
                item {
                    val bal = summary?.accountableBalance ?: "0"
                    Card(
                        onClick = { financeInitialTab = 0 },
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        shape = RoundedCornerShape(12.dp),
                        border = CardDefaults.outlinedCardBorder()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "НА РУКАХ",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = Zinc400,
                                letterSpacing = 1.sp
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "$bal ₽",
                                fontSize = 26.sp,
                                fontWeight = FontWeight.Black,
                                color = Zinc900
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Подотчётные наличные →",
                                fontSize = 12.sp,
                                color = Zinc500
                            )
                        }
                    }
                }

                // Карточка ЗП за месяц
                item {
                    val approvedPay = summary?.monthPayApproved ?: "0.00"
                    val draftPay = summary?.monthPayDraft ?: "0.00"
                    val hasDraft = (draftPay.toDoubleOrNull() ?: 0.0) > 0.0
                    val pendingCount = summary?.pendingPayrollCount ?: 0

                    Card(
                        onClick = { financeInitialTab = 1 },
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        shape = RoundedCornerShape(12.dp),
                        border = CardDefaults.outlinedCardBorder()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "ЗП ЗА МЕСЯЦ",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Zinc400,
                                    letterSpacing = 1.sp
                                )
                                if (pendingCount > 0) {
                                    Surface(
                                        color = AmberPending,
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Text(
                                            text = "$pendingCount ожидает подтв.",
                                            color = Color.White,
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Black,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "$approvedPay ₽",
                                fontSize = 26.sp,
                                fontWeight = FontWeight.Black,
                                color = GreenOnline
                            )
                            if (hasDraft) {
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "В черновиках: $draftPay ₽",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = AmberPending
                                )
                            }
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = if (pendingCount > 0) "⚠️ Требует подтверждения →" else "Детализация и подтверждение →",
                                fontSize = 12.sp,
                                color = if (pendingCount > 0) AmberPending else Zinc500,
                                fontWeight = if (pendingCount > 0) FontWeight.Bold else FontWeight.Normal
                            )
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

                item {
                    Spacer(modifier = Modifier.height(20.dp))
                }
            }
        }
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
                                currentAssetId = v.id
                                scope.launch {
                                    SaldaApiClient.switchDriverAsset(user.id, v.id)
                                    showVehiclePicker = false
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
