package ru.ancargo66.app.features.driver

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import ru.ancargo66.app.core.model.*
import ru.ancargo66.app.core.network.SaldaApiClient
import ru.ancargo66.app.ui.theme.*

private fun computeOrderPayroll(
    amount: Double,
    direction: String,
    isDriverLoader: Boolean,
    isPrr: Boolean
): Pair<Double, Double> {
    if (amount <= 0.0) return Pair(0.0, 0.0)
    val effDir = if (isPrr) "loaders_only" else direction
    if (effDir == "ekb") return Pair(0.0, 0.0)

    if (effDir == "loaders_only") {
        val loaderPay = Math.round(amount * 0.7).toDouble()
        return Pair(0.0, loaderPay)
    }

    val baseRate = when (effDir) {
        "local" -> 1000.0
        "n_salda" -> 1500.0
        "n_salda_dam" -> 2000.0
        "nikitino" -> 1500.0
        "neloba" -> 2500.0
        "basyanovka", "akinfievo" -> 4000.0
        else -> 1000.0
    }

    val totalLoadersCount = if (isDriverLoader) 1 else 0
    if (totalLoadersCount == 0) {
        val carPay = Math.round(amount * 0.3).toDouble()
        return Pair(carPay, 0.0)
    }

    val loaderUnitRate = 1000.0
    val nominalRate = baseRate + totalLoadersCount * loaderUnitRate
    val machinePool: Double
    val loadersPool: Double
    if (amount >= nominalRate) {
        machinePool = Math.round(amount * (baseRate / nominalRate)).toDouble()
        loadersPool = amount - machinePool
    } else {
        machinePool = minOf(amount, baseRate)
        loadersPool = maxOf(0.0, amount - machinePool)
    }

    val carPay = Math.round(machinePool * 0.3).toDouble()
    val loaderPay = Math.round(loadersPool * 0.7).toDouble()
    return Pair(carPay, loaderPay)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TripDetailScreen(
    tripId: String,
    userId: String,
    onBack: () -> Unit,
    onTripUpdated: () -> Unit
) {
    var tripDetail by remember { mutableStateOf<TripDetail?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val isPrr = tripDetail?.asset?.regNumber == "БЕЗ АВТО" || tripDetail?.tripType == "loaders_only"

    // Диалоги
    var showAddOrderDialog by remember { mutableStateOf(false) }
    var showAddExpenseDialog by remember { mutableStateOf(false) }
    var showFinishDialog by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var finishError by remember { mutableStateOf<String?>(null) }

    // Справочники
    var categories by remember { mutableStateOf<List<ExpenseCategory>>(emptyList()) }
    var counterparties by remember { mutableStateOf<List<Counterparty>>(emptyList()) }
    var allLoaders by remember { mutableStateOf<List<User>>(emptyList()) }

    // Поля нового заказа
    var orderAmountInput by remember { mutableStateOf("") }
    var orderPayInput by remember { mutableStateOf("") }
    var orderDescInput by remember { mutableStateOf("") }
    var orderDirectionInput by remember { mutableStateOf("local") }
    var orderPaymentMethodInput by remember { mutableStateOf("cash") }
    var selectedCounterpartyId by remember { mutableStateOf<String?>(null) }
    var orderClientSearch by remember { mutableStateOf("") }
    var isDriverLoaderChecked by remember { mutableStateOf(false) }
    var orderSelectedLoaders by remember { mutableStateOf<List<LoaderPayItem>>(emptyList()) }
    var orderGeostroyRoute by remember { mutableStateOf("") }
    var orderGeostroyDate by remember { mutableStateOf("") }
    var orderTerritoryAddress by remember { mutableStateOf("") }
    var orderTerritoryWork by remember { mutableStateOf("") }

    fun recalculatePay(amtStr: String, dir: String, isLoader: Boolean) {
        val amt = amtStr.toDoubleOrNull() ?: 0.0
        if (dir == "ekb") return
        val (carPay, loaderPay) = computeOrderPayroll(amt, dir, isLoader, isPrr)
        val total = carPay + loaderPay
        if (total > 0) {
            orderPayInput = "${total.toInt()}"
        } else if (amt == 0.0) {
            orderPayInput = ""
        }
    }

    // Поля нового расхода
    var expenseAmountInput by remember { mutableStateOf("") }
    var selectedCategoryId by remember { mutableStateOf<String?>(null) }
    var expensePaymentMethod by remember { mutableStateOf("fuel_card") }
    var expenseDescInput by remember { mutableStateOf("") }

    // Поля завершения рейса
    var endOdometerInput by remember { mutableStateOf("") }
    var driverNoteInput by remember { mutableStateOf("") }

    val scope = rememberCoroutineScope()

    val loadTrip = {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val trip = SaldaApiClient.getTripDetail(tripId, userId)
                tripDetail = trip
                if (endOdometerInput.isBlank()) {
                    val defaultOdo = if (trip.odometerEnd != null && trip.odometerEnd > 0) trip.odometerEnd else trip.odometerStart + 35
                    endOdometerInput = defaultOdo.toString()
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Ошибка загрузки рейса"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(tripId) {
        isLoading = true
        errorMessage = null
        try {
            // Параллельная загрузка рейса, категорий, клиентов и грузчиков
            coroutineScope {
                val tripDeferred = async { SaldaApiClient.getTripDetail(tripId, userId) }
                val catDeferred = async { SaldaApiClient.getExpenseCategories(userId) }
                val cpDeferred = async { SaldaApiClient.getCounterparties(userId) }
                val loadersDeferred = async { SaldaApiClient.getLoaders() }

                val trip = tripDeferred.await()
                tripDetail = trip
                if (endOdometerInput.isBlank()) {
                    val defaultOdo = if (trip.odometerEnd != null && trip.odometerEnd > 0) trip.odometerEnd else trip.odometerStart + 35
                    endOdometerInput = defaultOdo.toString()
                }

                val cats = catDeferred.await()
                categories = cats
                if (cats.isNotEmpty() && selectedCategoryId == null) {
                    selectedCategoryId = cats.first().id
                }

                val cps = cpDeferred.await()
                counterparties = cps
                if (selectedCounterpartyId == null && cps.isNotEmpty()) {
                    val generic = cps.find { it.name == "Частный клиент" } ?: cps.firstOrNull()
                    selectedCounterpartyId = generic?.id
                }

                allLoaders = loadersDeferred.await()
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Ошибка загрузки данных рейса"
        } finally {
            isLoading = false
        }
    }

    val trip = tripDetail
    val isActive = trip?.status == "in_progress" || trip?.status == "active"
    val isDraftReview = trip?.status == "completed" && trip.lifecycleStatus == "draft"

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = if (trip != null) "Рейс №${trip.tripNumber}" else "Загрузка рейса...",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = Zinc900
                        )
                        if (trip != null) {
                            Text(
                                text = when {
                                    isActive -> "В пути (активный)"
                                    isDraftReview -> "На проверке у администратора"
                                    trip.lifecycleStatus == "approved" -> "Утверждён администратором"
                                    else -> "Завершён"
                                },
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = when {
                                    isActive -> SaldaOrangePrimary
                                    isDraftReview -> AmberPending
                                    trip.lifecycleStatus == "approved" -> GreenOnline
                                    else -> Zinc500
                                }
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад", tint = Zinc700)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        bottomBar = {
            if (isActive && trip != null) {
                Surface(
                    color = Color.White,
                    shadowElevation = 8.dp,
                    border = CardDefaults.outlinedCardBorder()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Button(
                                onClick = {
                                    if (isPrr) {
                                        orderDirectionInput = "loaders_only"
                                        isDriverLoaderChecked = true
                                    } else {
                                        orderDirectionInput = "local"
                                        isDriverLoaderChecked = false
                                    }
                                    orderAmountInput = ""
                                    orderPayInput = ""
                                    orderDescInput = ""
                                    selectedCounterpartyId = null
                                    orderClientSearch = ""
                                    showAddOrderDialog = true
                                },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = SaldaOrangePrimary),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Заказ", fontWeight = FontWeight.Bold)
                            }

                            Button(
                                onClick = { showAddExpenseDialog = true },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = Zinc800),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Default.LocalGasStation, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("ГСМ", fontWeight = FontWeight.Bold)
                            }
                        }

                        Button(
                            onClick = {
                                finishError = null
                                showFinishDialog = true
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Zinc900),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.Default.Flag, contentDescription = null, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("ЗАВЕРШИТЬ РЕЙС", fontWeight = FontWeight.Black, fontSize = 15.sp)
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = SaldaOrangePrimary)
            }
        } else if (errorMessage != null || trip == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = errorMessage ?: "Рейс не найден",
                        color = RedAlert,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = { loadTrip() },
                        colors = ButtonDefaults.buttonColors(containerColor = SaldaOrangePrimary)
                    ) {
                        Text("Повторить")
                    }
                }
            }
        } else {
            val activeOrders = trip.tripOrders.filter { it.lifecycleStatus != "cancelled" }
            val totalRevenue = activeOrders.sumOf { it.amount }
            val totalDriverPay = activeOrders.sumOf { it.driverPay }
            val totalExpenses = trip.tripExpenses.sumOf { it.amount }
            val totalLoadersPay = activeOrders.sumOf { ord ->
                if (ord.loadersData.isNotEmpty()) {
                    ord.loadersData.sumOf { it.pay.toDoubleOrNull() ?: 0.0 }
                } else {
                    ord.loaderPay + ord.loader2Pay
                }
            }

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Zinc50)
                    .padding(innerPadding)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Карточка автомобиля и водителя
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
                            Surface(
                                color = SaldaOrange50,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.size(46.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = if (trip.asset?.regNumber == "БЕЗ АВТО") Icons.Default.Handyman else Icons.Default.LocalShipping,
                                        contentDescription = null,
                                        tint = SaldaOrangePrimary,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = if (trip.asset?.regNumber == "БЕЗ АВТО") "Погрузо-разгрузочные работы (Без авто)"
                                           else "${trip.asset?.shortName ?: "Автомобиль"} • ${trip.asset?.regNumber ?: "—"}",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = Zinc900
                                )
                                Text(
                                    text = "Водитель: ${trip.driver?.name ?: "—"} • Старт: ${trip.odometerStart} км",
                                    fontSize = 12.sp,
                                    color = Zinc500
                                )
                            }
                        }
                    }
                }

                // Сетка статистики (2x2) точно как в MiniApp
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            StatBox(
                                label = "ЗАКАЗЫ",
                                value = "${activeOrders.size}",
                                modifier = Modifier.weight(1f)
                            )
                            StatBox(
                                label = "ВЫРУЧКА",
                                value = "${totalRevenue.toInt()} ₽",
                                valueColor = SaldaOrangePrimary,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            StatBox(
                                label = "ЗП ВОДИТЕЛЯ",
                                value = "${totalDriverPay.toInt()} ₽",
                                valueColor = GreenOnline,
                                modifier = Modifier.weight(1f)
                            )
                            StatBox(
                                label = "ГСМ",
                                value = "${totalExpenses.toInt()} ₽",
                                valueColor = if (totalExpenses > 0) RedAlert else Zinc900,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        if (totalLoadersPay > 0) {
                            StatBox(
                                label = "ЗП ГРУЗЧИКИ",
                                value = "${totalLoadersPay.toInt()} ₽",
                                valueColor = Zinc700,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }

                // Заголовок: Заказы
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "ТЕКУЩИЕ ЗАКАЗЫ (${activeOrders.size})",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            color = Zinc400,
                            letterSpacing = 1.sp
                        )
                    }
                }

                if (activeOrders.isEmpty()) {
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
                                    .padding(24.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("📋", fontSize = 28.sp)
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text("В этом рейсе пока нет заказов", color = Zinc500, fontSize = 13.sp)
                                }
                            }
                        }
                    }
                } else {
                    items(activeOrders, key = { it.id }) { ord ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(10.dp),
                            border = CardDefaults.outlinedCardBorder()
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.Top
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            // Бейдж способа оплаты
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
                                                        "cash" -> "💵 Наличные"
                                                        "qr", "card_driver" -> "⚡ QR-код"
                                                        "debt_cash" -> "⏳ Долг"
                                                        else -> "🏛️ Безнал"
                                                    },
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = when (ord.paymentMethod) {
                                                        "cash" -> GreenOnline
                                                        "qr", "card_driver" -> Color(0xFF9333EA)
                                                        "debt_cash" -> RedAlert
                                                        else -> Color(0xFF2563EB)
                                                    },
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }

                                            // Бейдж направления
                                            Surface(
                                                color = Zinc100,
                                                shape = RoundedCornerShape(4.dp)
                                            ) {
                                                Text(
                                                    text = when (ord.direction) {
                                                        "local" -> "В. Салда"
                                                        "n_salda" -> "Н. Салда"
                                                        "tagil" -> "Тагил"
                                                        "ekb" -> "Екатеринбург"
                                                        "loaders_only" -> "Без авто"
                                                        else -> ord.direction ?: "Город"
                                                    },
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.SemiBold,
                                                    color = Zinc700,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }

                                        Spacer(modifier = Modifier.height(6.dp))

                                        // Название клиента / контрагента
                                        Text(
                                            text = ord.counterparty?.name ?: ord.description ?: "Частный заказ",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp,
                                            color = Zinc900
                                        )

                                        if (!ord.description.isNullOrBlank() && ord.counterparty?.name != null) {
                                            Text(
                                                text = "📝 ${ord.description}",
                                                fontSize = 12.sp,
                                                color = Zinc600,
                                                modifier = Modifier.padding(top = 2.dp)
                                            )
                                        }

                                        Spacer(modifier = Modifier.height(4.dp))

                                        // ЗП водителя
                                        if (ord.driverPay > 0) {
                                            Text(
                                                text = "ЗП водителя: ${ord.driverPay.toInt()} ₽",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = GreenOnline
                                            )
                                        }

                                        // Грузчики
                                        if (ord.loadersData.isNotEmpty()) {
                                            Column(modifier = Modifier.padding(top = 2.dp)) {
                                                ord.loadersData.forEach { loader ->
                                                    Text(
                                                        text = "👷 ${loader.name ?: "Грузчик"}: ${loader.pay} ₽",
                                                        fontSize = 11.sp,
                                                        color = Color(0xFF1E40AF),
                                                        fontWeight = FontWeight.SemiBold
                                                    )
                                                }
                                            }
                                        } else if (ord.loaderPay > 0 || ord.loader2Pay > 0) {
                                            Text(
                                                text = "Грузчики: ${(ord.loaderPay + ord.loader2Pay).toInt()} ₽",
                                                fontSize = 11.sp,
                                                color = Color(0xFF1E40AF),
                                                fontWeight = FontWeight.SemiBold
                                            )
                                        }
                                    }

                                    Column(horizontalAlignment = Alignment.End) {
                                        Text(
                                            text = "${ord.amount.toInt()} ₽",
                                            fontWeight = FontWeight.Black,
                                            fontSize = 17.sp,
                                            color = Zinc900
                                        )

                                        if (isActive) {
                                            IconButton(
                                                onClick = {
                                                    scope.launch {
                                                        SaldaApiClient.cancelTripOrder(trip.id, ord.id, userId)
                                                        loadTrip()
                                                    }
                                                },
                                                modifier = Modifier.size(32.dp)
                                            ) {
                                                Icon(
                                                    Icons.Default.Delete,
                                                    contentDescription = "Отменить заказ",
                                                    tint = Zinc400,
                                                    modifier = Modifier.size(18.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Заголовок: Расходы
                item {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "ЗАПРАВКИ И РАСХОДЫ (${trip.tripExpenses.size})",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = Zinc400,
                        letterSpacing = 1.sp
                    )
                }

                if (trip.tripExpenses.isEmpty()) {
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
                                    .padding(18.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("⛽ Расходов пока нет", color = Zinc500, fontSize = 13.sp)
                            }
                        }
                    }
                } else {
                    items(trip.tripExpenses, key = { it.id }) { exp ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(10.dp),
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
                                        text = exp.category?.name ?: "ГСМ / Топливо",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = Zinc900
                                    )
                                    Text(
                                        text = if (exp.paymentMethod == "fuel_card") "Топливная карта Опти24" else "Наличные из подотчёта",
                                        fontSize = 11.sp,
                                        color = Zinc500
                                    )
                                    if (!exp.description.isNullOrBlank()) {
                                        Text(text = exp.description, fontSize = 11.sp, color = Zinc600)
                                    }
                                }
                                Text(
                                    text = "- ${exp.amount.toInt()} ₽",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = RedAlert
                                )
                            }
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(40.dp))
                }
            }
        }
    }

    // ── Диалог добавления заказа ────────────────────────────────────────────
    if (showAddOrderDialog) {
        val selectedClient = counterparties.find { it.id == selectedCounterpartyId }
        val isGeostroy = selectedClient?.name?.contains("Геострой", ignoreCase = true) == true
        val isTerritory = selectedClient?.name?.contains("Территория", ignoreCase = true) == true

        AlertDialog(
            onDismissRequest = { if (!isSubmitting) showAddOrderDialog = false },
            title = { Text("Добавить заказ", fontWeight = FontWeight.Bold, fontSize = 18.sp) },
            text = {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 480.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Направление
                    item {
                        Text("НАПРАВЛЕНИЕ РЕЙСА", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            val directions = if (isPrr) {
                                listOf("loaders_only" to "👷 ПРР (без авто)")
                            } else {
                                listOf(
                                    "local" to "🏙️ По городу",
                                    "n_salda" to "Н. Салда",
                                    "tagil" to "Тагил",
                                    "ekb" to "Екб"
                                )
                            }
                            directions.forEach { (dir, label) ->
                                FilterChip(
                                    selected = orderDirectionInput == dir,
                                    onClick = {
                                        orderDirectionInput = dir
                                        recalculatePay(orderAmountInput, dir, isDriverLoaderChecked)
                                    },
                                    label = { Text(label, fontSize = 11.sp) }
                                )
                            }
                        }
                    }

                    // Водитель-грузчик (только для рейсов с автомобилем)
                    if (!isPrr) {
                        item {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        val next = !isDriverLoaderChecked
                                        isDriverLoaderChecked = next
                                        recalculatePay(orderAmountInput, orderDirectionInput, next)
                                    }
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("👷", fontSize = 18.sp)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Водитель — грузчик", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Zinc800)
                                }
                                Switch(
                                    checked = isDriverLoaderChecked,
                                    onCheckedChange = { next ->
                                        isDriverLoaderChecked = next
                                        recalculatePay(orderAmountInput, orderDirectionInput, next)
                                    }
                                )
                            }
                        }
                    }

                    // Клиент / Контрагент
                    item {
                        Text("КЛИЕНТ / КОНТРАГЕНТ", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                        Spacer(modifier = Modifier.height(4.dp))
                        OutlinedTextField(
                            value = orderClientSearch,
                            onValueChange = { orderClientSearch = it },
                            placeholder = { Text(selectedClient?.name ?: "Поиск клиента...") },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Zinc500) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    // Топ клиенты
                    val displayedClients = if (orderClientSearch.isNotBlank()) {
                        counterparties.filter { it.name.contains(orderClientSearch, ignoreCase = true) }.take(6)
                    } else {
                        counterparties.take(5)
                    }

                    items(displayedClients, key = { it.id ?: it.name }) { cp ->
                        val isSelected = cp.id == selectedCounterpartyId
                        Surface(
                            onClick = {
                                selectedCounterpartyId = cp.id
                                orderClientSearch = ""
                                if (cp.name.contains("Геострой") || cp.name.contains("ВСМПО")) {
                                    orderPaymentMethodInput = "debt_cash"
                                }
                            },
                            color = if (isSelected) SaldaOrange50 else Color.White,
                            shape = RoundedCornerShape(8.dp),
                            border = CardDefaults.outlinedCardBorder().copy(
                                brush = androidx.compose.ui.graphics.SolidColor(if (isSelected) SaldaOrangePrimary else Zinc200)
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(text = cp.name, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal, fontSize = 13.sp)
                                if (isSelected) {
                                    Text("✓", color = SaldaOrangePrimary, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    // Спец поля для Геостройиндустрия
                    if (isGeostroy) {
                        item {
                            Surface(
                                color = Color(0xFFEFF6FF),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("Обязательно для ООО Геостройиндустрия:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1E40AF))
                                    OutlinedTextField(
                                        value = orderGeostroyRoute,
                                        onValueChange = { orderGeostroyRoute = it },
                                        label = { Text("Маршрут") },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                    OutlinedTextField(
                                        value = orderGeostroyDate,
                                        onValueChange = { orderGeostroyDate = it },
                                        label = { Text("Дата начала (ДД.ММ.ГГГГ)") },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            }
                        }
                    }

                    // Спец поля для Территория
                    if (isTerritory) {
                        item {
                            Surface(
                                color = Color(0xFFEFF6FF),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("Обязательно для Территория:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1E40AF))
                                    OutlinedTextField(
                                        value = orderTerritoryAddress,
                                        onValueChange = { orderTerritoryAddress = it },
                                        label = { Text("Адрес (улица + дом)") },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                    OutlinedTextField(
                                        value = orderTerritoryWork,
                                        onValueChange = { orderTerritoryWork = it },
                                        label = { Text("Вид работы") },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            }
                        }
                    }

                    // Сумма и ЗП
                    item {
                        Text("СТОИМОСТЬ И ОПЛАТА", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                        Spacer(modifier = Modifier.height(4.dp))
                        OutlinedTextField(
                            value = orderAmountInput,
                            onValueChange = {
                                orderAmountInput = it
                                recalculatePay(it, orderDirectionInput, isDriverLoaderChecked)
                            },
                            label = { Text("Сумма заказа (₽)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = orderPayInput,
                            onValueChange = { orderPayInput = it },
                            label = { Text("ЗП водителя (₽) — авторасчёт") },
                            placeholder = { Text("Рассчитывается автоматически") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = orderDescInput,
                            onValueChange = { orderDescInput = it },
                            label = { Text("Примечание / Адрес") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    // Способ оплаты
                    item {
                        Text("СПОСОБ ОПЛАТЫ", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            listOf("cash" to "💵 Нал", "qr" to "⚡ QR", "debt_cash" to "⏳ Долг").forEach { (method, label) ->
                                FilterChip(
                                    selected = orderPaymentMethodInput == method,
                                    onClick = { orderPaymentMethodInput = method },
                                    label = { Text(label, fontSize = 11.sp) }
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val amt = orderAmountInput.toDoubleOrNull() ?: return@Button
                        val (defCarPay, defLoaderPay) = computeOrderPayroll(amt, orderDirectionInput, isDriverLoaderChecked, isPrr)
                        val totalDefPay = defCarPay + defLoaderPay
                        val pay = orderPayInput.toDoubleOrNull() ?: (if (totalDefPay > 0) totalDefPay else (if (isPrr) amt * 0.7 else amt * 0.3))
                        val finalDesc = when {
                            isGeostroy -> "МАРШРУТ: $orderGeostroyRoute ДАТА НАЧАЛА: $orderGeostroyDate"
                            isTerritory -> "АДРЕС: $orderTerritoryAddress РАБОТА: $orderTerritoryWork"
                            orderDescInput.isNotBlank() -> orderDescInput
                            else -> null
                        }

                        scope.launch {
                            isSubmitting = true
                            SaldaApiClient.addTripOrder(
                                tripId = tripId,
                                amount = amt,
                                driverPay = pay,
                                description = finalDesc,
                                direction = orderDirectionInput,
                                paymentMethod = orderPaymentMethodInput,
                                counterpartyId = selectedCounterpartyId,
                                driverCarPay = defCarPay,
                                driverLoaderPay = defLoaderPay,
                                isDriverLoader = isDriverLoaderChecked,
                                userId = userId
                            )
                            isSubmitting = false
                            showAddOrderDialog = false
                            orderAmountInput = ""
                            orderPayInput = ""
                            orderDescInput = ""
                            loadTrip()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = SaldaOrangePrimary),
                    enabled = !isSubmitting && orderAmountInput.isNotBlank()
                ) {
                    Text(if (isSubmitting) "Сохранение..." else "Добавить заказ")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddOrderDialog = false }) {
                    Text("Отмена", color = Zinc500)
                }
            }
        )
    }

    // ── Диалог добавления расхода ───────────────────────────────────────────
    if (showAddExpenseDialog) {
        AlertDialog(
            onDismissRequest = { showAddExpenseDialog = false },
            title = { Text("Добавить расход (ГСМ)", fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = expenseAmountInput,
                        onValueChange = { expenseAmountInput = it },
                        label = { Text("Сумма расхода (₽)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = expenseDescInput,
                        onValueChange = { expenseDescInput = it },
                        label = { Text("Примечание (литры, АЗС)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf("fuel_card" to "Топливная карта", "cash" to "Наличные").forEach { (method, label) ->
                            FilterChip(
                                selected = expensePaymentMethod == method,
                                onClick = { expensePaymentMethod = method },
                                label = { Text(label, fontSize = 11.sp) }
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val amt = expenseAmountInput.toDoubleOrNull() ?: return@Button
                        val catId = selectedCategoryId ?: categories.firstOrNull()?.id ?: return@Button
                        scope.launch {
                            isSubmitting = true
                            SaldaApiClient.addTripExpense(
                                tripId = tripId,
                                categoryId = catId,
                                amount = amt,
                                paymentMethod = expensePaymentMethod,
                                description = expenseDescInput.ifBlank { null },
                                userId = userId
                            )
                            isSubmitting = false
                            showAddExpenseDialog = false
                            expenseAmountInput = ""
                            expenseDescInput = ""
                            loadTrip()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = SaldaOrangePrimary),
                    enabled = !isSubmitting && expenseAmountInput.isNotBlank()
                ) {
                    Text(if (isSubmitting) "Сохранение..." else "Добавить")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddExpenseDialog = false }) {
                    Text("Отмена", color = Zinc500)
                }
            }
        )
    }

    // ── Диалог завершения рейса ─────────────────────────────────────────────
    if (showFinishDialog && trip != null) {
        val activeOrders = trip.tripOrders.filter { it.lifecycleStatus != "cancelled" }
        val cashRevenue = activeOrders.filter { it.paymentMethod == "cash" }.sumOf { it.amount }
        val cashExpenses = trip.tripExpenses.filter { it.paymentMethod == "cash" }.sumOf { it.amount }
        val cashToSurrender = maxOf(0.0, cashRevenue - cashExpenses)

        AlertDialog(
            onDismissRequest = { if (!isSubmitting) showFinishDialog = false },
            title = {
                Text("Завершение рейса №${trip.tripNumber}", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            },
            text = {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    // Сводка сдачи наличных
                    Surface(
                        color = Zinc100,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Сдать в кассу наличными:", fontSize = 11.sp, color = Zinc500, fontWeight = FontWeight.SemiBold)
                            Text("${cashToSurrender.toInt()} ₽", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Zinc900)
                            Text("Выручка налом (${cashRevenue.toInt()} ₽) минус расходы (${cashExpenses.toInt()} ₽)", fontSize = 10.sp, color = Zinc500)
                        }
                    }

                    OutlinedTextField(
                        value = endOdometerInput,
                        onValueChange = { endOdometerInput = it },
                        label = { Text("Конечный одометр (км)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = driverNoteInput,
                        onValueChange = { driverNoteInput = it },
                        label = { Text("Комментарий водителя") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (finishError != null) {
                        Text(
                            text = finishError ?: "",
                            color = RedAlert,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val endOdo = endOdometerInput.toLongOrNull()
                        scope.launch {
                            isSubmitting = true
                            finishError = null
                            val res = SaldaApiClient.finishTrip(
                                tripId = tripId,
                                endOdometer = endOdo,
                                driverNote = driverNoteInput.ifBlank { null },
                                userId = userId
                            )
                            isSubmitting = false
                            if (res.isSuccess) {
                                showFinishDialog = false
                                onTripUpdated()
                            } else {
                                finishError = res.exceptionOrNull()?.message ?: "Не удалось завершить рейс"
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = GreenOnline),
                    enabled = !isSubmitting
                ) {
                    Text(if (isSubmitting) "Завершаем..." else "Подтвердить")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showFinishDialog = false },
                    enabled = !isSubmitting
                ) {
                    Text("Отмена", color = Zinc500)
                }
            }
        )
    }
}

@Composable
fun StatBox(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    valueColor: Color = Zinc900
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(10.dp),
        border = CardDefaults.outlinedCardBorder()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = label,
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                color = Zinc400,
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = value,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = valueColor
            )
        }
    }
}
