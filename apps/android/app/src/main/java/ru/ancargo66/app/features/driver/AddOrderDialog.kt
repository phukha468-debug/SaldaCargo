package ru.ancargo66.app.features.driver

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.launch
import ru.ancargo66.app.core.model.Counterparty
import ru.ancargo66.app.core.model.LoaderPayItem
import ru.ancargo66.app.core.model.User
import ru.ancargo66.app.core.network.SaldaApiClient
import ru.ancargo66.app.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

// ─── Модели направлений ───────────────────────────────────────────────────────

data class OrderDirectionItem(
    val id: String,
    val label: String,
    val desc: String,
    val icon: String,
    val category: String, // "local" | "intercity"
    val baseMachinePrice: Double = 1000.0,
    val isAutomatic: Boolean = true
)

val ORDER_DIRECTIONS = listOf(
    // Местные
    OrderDirectionItem("local", "По городу", "Верхняя Салда (базовый тариф 1 000 ₽)", "🏙️", "local", 1000.0),
    OrderDirectionItem("n_salda", "Нижняя Салда", "Тариф машины 1 500 ₽", "🏙️", "local", 1500.0),
    OrderDirectionItem("n_salda_dam", "Нижняя Салда (после плотины)", "Тариф машины 2 000 ₽", "🌊", "local", 2000.0),
    OrderDirectionItem("nikitino", "Никитино", "Тариф машины 1 500 ₽", "🏡", "local", 1500.0),
    OrderDirectionItem("neloba", "Нелоба", "Тариф машины 2 500 ₽", "🌲", "local", 2500.0),
    OrderDirectionItem("basyanovka", "Басьяновка", "Тариф машины 4 000 ₽", "🏭", "local", 4000.0),
    OrderDirectionItem("akinfievo", "Акинфьево", "Тариф машины 4 000 ₽", "🗺️", "local", 4000.0),
    // Тагил и Межгород
    OrderDirectionItem("tagil_vagonka", "Тагил · Вагонка", "Дзержинский район (авторасчёт)", "🏭", "intercity", 1000.0),
    OrderDirectionItem("tagil_tagilstroy", "Тагил · Тагилстрой", "Тагилстроевский район (авторасчёт)", "🏭", "intercity", 1000.0),
    OrderDirectionItem("tagil_galinka", "Тагил · Центр / ГГМ", "Гальянка, Выя, Кр. Камень (авторасчёт)", "🏭", "intercity", 1000.0),
    OrderDirectionItem("ekb", "Екатеринбург", "Прямой рейс (ручной ввод ЗП)", "🏢", "intercity", 1000.0, isAutomatic = false),
    OrderDirectionItem("perm", "Пермь", "Межгород (авторасчёт)", "🌲", "intercity", 1000.0),
    OrderDirectionItem("chelyabinsk", "Челябинск", "Межгород (авторасчёт)", "🏭", "intercity", 1000.0),
    OrderDirectionItem("other", "Другой город", "Межгород по км (авторасчёт)", "🗺️", "intercity", 1000.0),
    OrderDirectionItem("loaders_only", "Погрузо-разгрузочные работы", "Только грузчики (ПРР без авто)", "👷", "local", 0.0)
)

data class OrderPayrollResult(
    val driverCarPay: Int,
    val driverLoaderPay: Int,
    val driverTotalPay: Int,
    val loaderPayEach: Int,
    val totalLoadersPay: Int,
    val companyShare: Int,
    val machinePool: Int,
    val loadersPool: Int,
    val isAutomatic: Boolean
)

fun calculateOrderPayroll(
    direction: String,
    amount: Double,
    isDriverLoader: Boolean,
    loadersCount: Int,
    minMachineBase: Double = 1000.0,
    loadingAmount: Double? = null
): OrderPayrollResult {
    val dirObj = ORDER_DIRECTIONS.find { it.id == direction }
    val isAutomatic = direction != "ekb"

    if (amount <= 0.0) {
        return OrderPayrollResult(0, 0, 0, 0, 0, 0, 0, 0, isAutomatic)
    }

    val totalLoadersCount = (if (isDriverLoader) 1 else 0) + loadersCount

    // Сценарий 1: ПРР без авто (Только грузчики)
    if (direction == "loaders_only") {
        val poolPerLoader = if (totalLoadersCount > 0) amount / totalLoadersCount else 0.0
        val loaderPayEach = Math.round(poolPerLoader * 0.7).toInt()
        val driverLoaderPay = if (isDriverLoader) loaderPayEach else 0
        val totalLoadersPay = loaderPayEach * loadersCount
        val companyShare = (amount - driverLoaderPay - totalLoadersPay).toInt()

        return OrderPayrollResult(
            driverCarPay = 0,
            driverLoaderPay = driverLoaderPay,
            driverTotalPay = driverLoaderPay,
            loaderPayEach = loaderPayEach,
            totalLoadersPay = totalLoadersPay,
            companyShare = companyShare,
            machinePool = 0,
            loadersPool = amount.toInt(),
            isAutomatic = isAutomatic
        )
    }

    // Сценарий 2: Обычный рейс с машиной.
    // Пока водитель собственноручно не ввёл сумму за погрузку > 0,
    // на машину приходится ровно 100% суммы заказа!
    val explicitLoading = if (loadingAmount != null && loadingAmount > 0.0) {
        minOf(amount, loadingAmount)
    } else {
        0.0
    }

    if (explicitLoading <= 0.0) {
        val driverCarPay = Math.round(amount * 0.3).toInt()
        val companyShare = (amount - driverCarPay).toInt()
        return OrderPayrollResult(
            driverCarPay = driverCarPay,
            driverLoaderPay = 0,
            driverTotalPay = driverCarPay,
            loaderPayEach = 0,
            totalLoadersPay = 0,
            companyShare = companyShare,
            machinePool = amount.toInt(),
            loadersPool = 0,
            isAutomatic = isAutomatic
        )
    }

    // Сценарий 3: Явно указана сумма за погрузку > 0
    val loadersPool = explicitLoading
    val machinePool = maxOf(0.0, amount - loadersPool)

    val driverCarPay = Math.round(machinePool * 0.3).toInt()
    val poolPerLoader = if (totalLoadersCount > 0) loadersPool / totalLoadersCount else 0.0
    val loaderPayEach = Math.round(poolPerLoader * 0.7).toInt()
    val driverLoaderPay = if (isDriverLoader) loaderPayEach else 0
    val driverTotalPay = driverCarPay + driverLoaderPay
    val totalLoadersPay = loaderPayEach * loadersCount
    val companyShare = (amount - driverTotalPay - totalLoadersPay).toInt()

    return OrderPayrollResult(
        driverCarPay = driverCarPay,
        driverLoaderPay = driverLoaderPay,
        driverTotalPay = driverTotalPay,
        loaderPayEach = loaderPayEach,
        totalLoadersPay = totalLoadersPay,
        companyShare = companyShare,
        machinePool = machinePool.toInt(),
        loadersPool = loadersPool.toInt(),
        isAutomatic = isAutomatic
    )
}

fun isNoCashClient(cp: Counterparty?): Boolean {
    if (cp == null) return false
    val name = cp.name.lowercase()
    val patterns = listOf("геострой", "всмпо", "увс", "территори", "эко-дело", "эко дело", "теострой")
    return patterns.any { name.contains(it) }
}

// ─── Диалог добавления заказа ────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddOrderDialog(
    tripId: String,
    userId: String,
    isTripPrr: Boolean,
    counterparties: List<Counterparty>,
    allLoaders: List<User>,
    onDismiss: () -> Unit,
    onSuccess: () -> Unit
) {
    var direction by rememberSaveable { mutableStateOf(if (isTripPrr) "loaders_only" else "local") }
    var isDriverLoader by rememberSaveable { mutableStateOf(isTripPrr) }
    var amountInput by rememberSaveable { mutableStateOf("") }
    var loadingAmountInput by rememberSaveable { mutableStateOf("") }
    var manualDriverPayInput by rememberSaveable { mutableStateOf("") }
    var selectedCounterpartyId by rememberSaveable { mutableStateOf<String?>(null) }
    var clientSearch by rememberSaveable { mutableStateOf("") }
    var paymentMethod by rememberSaveable { mutableStateOf("cash") } // cash, qr, debt_cash
    var descriptionInput by rememberSaveable { mutableStateOf("") }

    // Локальный список грузчиков с авто-подгрузкой при необходимости
    var localLoaders by remember { mutableStateOf(allLoaders) }
    var isLoadingLoaders by remember { mutableStateOf(false) }

    LaunchedEffect(allLoaders) {
        if (allLoaders.isNotEmpty()) {
            localLoaders = allLoaders
        } else {
            isLoadingLoaders = true
            try {
                localLoaders = SaldaApiClient.getLoaders(forceRefresh = true, userId = userId)
            } catch (_: Exception) {
            } finally {
                isLoadingLoaders = false
            }
        }
    }

    // Сторонние грузчики
    var selectedLoaders by remember { mutableStateOf<List<User>>(emptyList()) }
    var showLoaderPicker by remember { mutableStateOf(false) }
    var showDirectionPicker by remember { mutableStateOf(false) }

    // Спец поля для Геострой
    var geostroyRoute by rememberSaveable { mutableStateOf("") }
    var geostroyDate by rememberSaveable { mutableStateOf("") }

    // Спец поля для Территория
    var territoryAddress by rememberSaveable { mutableStateOf("") }
    var territoryWork by rememberSaveable { mutableStateOf("") }

    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    val isLoadersOnly = direction == "loaders_only" || isTripPrr
    val currentDirectionObj = ORDER_DIRECTIONS.find { it.id == direction } ?: ORDER_DIRECTIONS.first()
    val selectedClient = counterparties.find { it.id == selectedCounterpartyId }
    val genericClient = counterparties.find { it.name.contains("Частный клиент", ignoreCase = true) }

    val amountDouble = amountInput.toDoubleOrNull() ?: 0.0
    val loadingAmountDouble = loadingAmountInput.toDoubleOrNull()
    val isClientNoCash = isNoCashClient(selectedClient)

    val isGeostroy = selectedClient?.name?.contains("Геострой", ignoreCase = true) == true
    val isTerritory = selectedClient?.name?.contains("Территория", ignoreCase = true) == true

    // Авторасчёт ЗП
    val minBase = selectedClient?.minDeliveryBase ?: (if (selectedClient?.isDeliveryZoneClient == true) 800.0 else 1000.0)
    val payroll = calculateOrderPayroll(
        direction = if (isLoadersOnly) "loaders_only" else direction,
        amount = amountDouble,
        isDriverLoader = isDriverLoader,
        loadersCount = selectedLoaders.size,
        minMachineBase = minBase,
        loadingAmount = if (isLoadersOnly) null else loadingAmountDouble
    )

    // Если клиент безналичный — переключаем с наличных на долг
    LaunchedEffect(isClientNoCash) {
        if (isClientNoCash && paymentMethod == "cash") {
            paymentMethod = "debt_cash"
        }
    }

    BackHandler(enabled = !isSubmitting) { onDismiss() }

    Dialog(
        onDismissRequest = { if (!isSubmitting) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Zinc50)
                .swipeToBack(onBack = { if (!isSubmitting) onDismiss() })
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // 1. АБСОЛЮТНАЯ ЗАЩИТА СВЕРХУ:
                // Физический разделитель ровно на высоту статус-бара и выреза камеры
                Spacer(
                    modifier = Modifier
                        .fillMaxWidth()
                        .windowInsetsTopHeight(WindowInsets.statusBars)
                        .background(Color.White)
                )

                // Шапка
                Surface(
                    color = Color.White,
                    shadowElevation = 2.dp,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = onDismiss, modifier = Modifier.size(36.dp)) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад", tint = Zinc900)
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "ДОБАВИТЬ ЗАКАЗ",
                                fontWeight = FontWeight.Black,
                                fontSize = 17.sp,
                                color = Zinc900,
                                letterSpacing = 0.5.sp
                            )
                        }
                        IconButton(onClick = onDismiss, modifier = Modifier.size(36.dp)) {
                            Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = Zinc500)
                        }
                    }
                }

                // Скроллируемая форма
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 16.dp),
                    contentPadding = PaddingValues(vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // 1. Формат заказа: С машиной / Без машины
                    if (!isTripPrr) {
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("ФОРМАТ ЗАКАЗА", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400, letterSpacing = 1.sp)
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Zinc200, RoundedCornerShape(16.dp))
                                        .padding(4.dp),
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Surface(
                                        modifier = Modifier
                                            .weight(1f)
                                            .clickable {
                                                if (isLoadersOnly) {
                                                    direction = "local"
                                                    isDriverLoader = false
                                                }
                                            },
                                        color = if (!isLoadersOnly) Color.White else Color.Transparent,
                                        shape = RoundedCornerShape(12.dp),
                                        shadowElevation = if (!isLoadersOnly) 2.dp else 0.dp
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(vertical = 10.dp),
                                            horizontalArrangement = Arrangement.Center,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text("🚚", fontSize = 16.sp)
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(
                                                "С машиной",
                                                fontWeight = FontWeight.Black,
                                                fontSize = 12.sp,
                                                color = if (!isLoadersOnly) Zinc900 else Zinc500
                                            )
                                        }
                                    }

                                    Surface(
                                        modifier = Modifier
                                            .weight(1f)
                                            .clickable {
                                                direction = "loaders_only"
                                                isDriverLoader = true
                                            },
                                        color = if (isLoadersOnly) AmberPending else Color.Transparent,
                                        shape = RoundedCornerShape(12.dp),
                                        shadowElevation = if (isLoadersOnly) 2.dp else 0.dp
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(vertical = 10.dp),
                                            horizontalArrangement = Arrangement.Center,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text("👷", fontSize = 16.sp)
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(
                                                "Без машины (ПРР)",
                                                fontWeight = FontWeight.Black,
                                                fontSize = 12.sp,
                                                color = if (isLoadersOnly) Color.White else Zinc500
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 2. Направление заказа (если с машиной)
                    if (!isLoadersOnly) {
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("НАПРАВЛЕНИЕ ЗАКАЗА", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400, letterSpacing = 1.sp)
                                Surface(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { showDirectionPicker = true },
                                    color = SaldaOrange50,
                                    shape = RoundedCornerShape(16.dp),
                                    border = androidx.compose.foundation.BorderStroke(2.dp, SaldaOrangeLight)
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(14.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            modifier = Modifier.weight(1f),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(currentDirectionObj.icon, fontSize = 24.sp)
                                            Spacer(modifier = Modifier.width(12.dp))
                                            Column(modifier = Modifier.weight(1f, fill = false)) {
                                                Text(
                                                    text = currentDirectionObj.label,
                                                    fontSize = 15.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = Zinc900,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                                Text(
                                                    text = currentDirectionObj.desc,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Zinc500,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                            }
                                        }
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Surface(
                                            color = SaldaOrange50,
                                            shape = RoundedCornerShape(8.dp),
                                            border = androidx.compose.foundation.BorderStroke(1.dp, SaldaOrangePrimary)
                                        ) {
                                            Text(
                                                text = "Изменить",
                                                color = SaldaOrangePrimary,
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Black,
                                                maxLines = 1,
                                                softWrap = false,
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        item {
                            Surface(
                                color = Color(0xFFFFFBEB),
                                shape = RoundedCornerShape(16.dp),
                                border = androidx.compose.foundation.BorderStroke(2.dp, Color(0xFFFDE68A))
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("👷", fontSize = 24.sp)
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text("Заказ без машины (ПРР)", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color(0xFF78350F))
                                        Text("Разгрузка, погрузка другой машины, работы без авто", fontSize = 11.sp, color = Color(0xFF92400E))
                                    }
                                }
                            }
                        }
                    }

                    // 3. Выбор контрагента / Клиента
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("КЛИЕНТ / КОНТРАГЕНТ", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400, letterSpacing = 1.sp)

                            if (selectedClient != null) {
                                Surface(
                                    modifier = Modifier.fillMaxWidth(),
                                    color = if (selectedClient.isLegalEntity) Color(0xFFEFF6FF) else SaldaOrange50,
                                    shape = RoundedCornerShape(16.dp),
                                    border = androidx.compose.foundation.BorderStroke(
                                        2.dp,
                                        if (selectedClient.isLegalEntity) Color(0xFFBFDBFE) else SaldaOrangeLight
                                    )
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
                                                Text(
                                                    text = selectedClient.name,
                                                    fontSize = 15.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = if (selectedClient.isLegalEntity) Color(0xFF1E3A8A) else Color(0xFF7C2D12)
                                                )
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Surface(
                                                    color = if (selectedClient.isLegalEntity) Color(0xFFDBEAFE) else Color(0xFFFFEDD5),
                                                    shape = RoundedCornerShape(6.dp)
                                                ) {
                                                    Text(
                                                        text = if (selectedClient.isLegalEntity) "ЮЛ" else "ФЛ",
                                                        fontSize = 9.sp,
                                                        fontWeight = FontWeight.Black,
                                                        color = if (selectedClient.isLegalEntity) Color(0xFF1D4ED8) else SaldaOrangePrimary,
                                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                    )
                                                }
                                            }
                                            if (isClientNoCash) {
                                                Text(
                                                    text = "🚫 Только безнал / дебиторка",
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = RedAlert,
                                                    modifier = Modifier.padding(top = 2.dp)
                                                )
                                            }
                                        }

                                        IconButton(
                                            onClick = { selectedCounterpartyId = null },
                                            modifier = Modifier.size(32.dp)
                                        ) {
                                            Icon(Icons.Default.Close, contentDescription = "Сбросить", tint = Zinc400)
                                        }
                                    }
                                }
                            } else {
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    // Кнопка быстрого частного клиента
                                    if (genericClient != null) {
                                        Surface(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clickable { selectedCounterpartyId = genericClient.id },
                                            color = SaldaOrange50,
                                            shape = RoundedCornerShape(14.dp),
                                            border = androidx.compose.foundation.BorderStroke(2.dp, SaldaOrangePrimary)
                                        ) {
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(horizontal = 14.dp, vertical = 10.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                    Text("👤", fontSize = 18.sp)
                                                    Spacer(modifier = Modifier.width(8.dp))
                                                    Text(genericClient.name, fontWeight = FontWeight.Black, fontSize = 13.sp, color = Color(0xFF7C2D12))
                                                }
                                                Surface(
                                                    color = SaldaOrangePrimary,
                                                    shape = RoundedCornerShape(6.dp)
                                                ) {
                                                    Text(
                                                        "Выбрать",
                                                        color = Color.White,
                                                        fontSize = 10.sp,
                                                        fontWeight = FontWeight.Black,
                                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                                    )
                                                }
                                            }
                                        }
                                    }

                                    // Поле поиска клиентов
                                    OutlinedTextField(
                                        value = clientSearch,
                                        onValueChange = { clientSearch = it },
                                        placeholder = { Text("Поиск по базе постоянных клиентов...", fontSize = 13.sp) },
                                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Zinc400) },
                                        singleLine = true,
                                        shape = RoundedCornerShape(14.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    )

                                    // Подсказки клиентов
                                    val filteredList = if (clientSearch.isNotBlank()) {
                                        counterparties.filter { it.name.contains(clientSearch, ignoreCase = true) }.take(6)
                                    } else {
                                        counterparties.filter { it.id != genericClient?.id && it.isTop }.take(5)
                                    }

                                    if (filteredList.isNotEmpty()) {
                                        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            items(filteredList, key = { it.id ?: it.name }) { cp ->
                                                Surface(
                                                    modifier = Modifier.clickable {
                                                        selectedCounterpartyId = cp.id
                                                        clientSearch = ""
                                                    },
                                                    color = Color.White,
                                                    shape = RoundedCornerShape(10.dp),
                                                    border = androidx.compose.foundation.BorderStroke(1.dp, Zinc300)
                                                ) {
                                                    Row(
                                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                                        verticalAlignment = Alignment.CenterVertically
                                                    ) {
                                                        Text(if (cp.isLegalEntity) "🏢 " else "👤 ", fontSize = 11.sp)
                                                        Text(cp.name, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Zinc800)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 4. Сумма заказа, ₽
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("СУММА ЗАКАЗА, ₽", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400, letterSpacing = 1.sp)
                            OutlinedTextField(
                                value = amountInput,
                                onValueChange = { amountInput = it },
                                placeholder = { Text("2 000", fontSize = 22.sp, fontWeight = FontWeight.Black, color = Zinc300) },
                                textStyle = androidx.compose.ui.text.TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Black, color = Zinc900),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    // 5. Роль водителя (Я работал грузчиком)
                    item {
                        val loadingAmt = loadingAmountInput.toDoubleOrNull() ?: 0.0
                        val canBeDriverLoader = isLoadersOnly || loadingAmt > 0.0

                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (!canBeDriverLoader) {
                                        errorMessage = "Сначала укажите сумму за погрузку в графе ниже"
                                    } else {
                                        isDriverLoader = !isDriverLoader
                                    }
                                },
                            color = if (canBeDriverLoader) SaldaOrange50 else Zinc100,
                            shape = RoundedCornerShape(16.dp),
                            border = androidx.compose.foundation.BorderStroke(2.dp, if (canBeDriverLoader) SaldaOrangeLight else Zinc200)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    modifier = Modifier.weight(1f),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Checkbox(
                                        checked = isDriverLoader && canBeDriverLoader,
                                        onCheckedChange = { checked ->
                                            if (!canBeDriverLoader && checked) {
                                                errorMessage = "Сначала укажите сумму за погрузку в графе ниже"
                                            } else {
                                                isDriverLoader = checked
                                            }
                                        },
                                        enabled = canBeDriverLoader,
                                        colors = CheckboxDefaults.colors(checkedColor = SaldaOrangePrimary)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Column(modifier = Modifier.weight(1f, fill = false)) {
                                        Text(
                                            text = if (isLoadersOnly) "🚚 Я работал на разгрузке/погрузке" else "🚚 Я работал грузчиком",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Black,
                                            color = if (canBeDriverLoader) Zinc900 else Zinc500,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            text = if (isLoadersOnly) "Водитель получает 70% чека"
                                                   else if (!canBeDriverLoader) "Введите сумму за погрузку ниже, чтобы включить"
                                                   else "Оплата за авто + за работу грузчика",
                                            fontSize = 11.sp,
                                            color = if (!canBeDriverLoader) SaldaOrangePrimary else Zinc500
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.width(8.dp))
                                Surface(
                                    color = if (isDriverLoader && canBeDriverLoader) SaldaOrangePrimary else Zinc200,
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text(
                                        text = if (isDriverLoader && canBeDriverLoader) "ДА" else "НЕТ",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = if (isDriverLoader && canBeDriverLoader) Color.White else Zinc600,
                                        maxLines = 1,
                                        softWrap = false,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }
                    }

                    // 6. Сторонние грузчики
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "СТОРОННИЕ ГРУЗЧИКИ (${selectedLoaders.size})",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Zinc400,
                                    letterSpacing = 1.sp
                                )
                                if (selectedLoaders.isNotEmpty()) {
                                    Text(
                                        text = "ЗП грузчика: ${payroll.loaderPayEach} ₽/чел",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = BlueInfo
                                    )
                                }
                            }

                            selectedLoaders.forEachIndexed { idx, loader ->
                                Surface(
                                    color = Color(0xFFEFF6FF),
                                    shape = RoundedCornerShape(12.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFBFDBFE)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text("${idx + 1}. ${loader.name}", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFF1E3A8A))
                                            Text("ЗП: ${payroll.loaderPayEach} ₽", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Zinc900)
                                        }
                                        IconButton(
                                            onClick = { selectedLoaders = selectedLoaders.filter { it.id != loader.id } },
                                            modifier = Modifier.size(28.dp)
                                        ) {
                                            Icon(Icons.Default.Close, contentDescription = "Удалить", tint = RedAlert)
                                        }
                                    }
                                }
                            }

                            OutlinedButton(
                                onClick = { showLoaderPicker = true },
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Добавить грузчика из списка", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    // 7. СУММА ЗА ПОГРУЗКУ / СУММА ППР (только для рейсов с авто)
                    if (!isLoadersOnly) {
                        item {
                            Surface(
                                color = Color(0xFFFFFBEB),
                                shape = RoundedCornerShape(16.dp),
                                border = androidx.compose.foundation.BorderStroke(2.dp, Color(0xFFFDE68A))
                            ) {
                                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(
                                        text = "ВВЕДИТЕ СУММУ ЗА ПОГРУЗКУ (ПРР)",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color(0xFF78350F),
                                        letterSpacing = 1.sp
                                    )

                                    OutlinedTextField(
                                        value = loadingAmountInput,
                                        onValueChange = {
                                            loadingAmountInput = it
                                            val v = it.toDoubleOrNull() ?: 0.0
                                            if (!isLoadersOnly) {
                                                if (v <= 0.0) {
                                                    isDriverLoader = false
                                                } else if (selectedLoaders.isEmpty() && !isDriverLoader) {
                                                    isDriverLoader = true
                                                }
                                            }
                                        },
                                        placeholder = { Text("0 ₽", fontWeight = FontWeight.Bold) },
                                        textStyle = androidx.compose.ui.text.TextStyle(fontSize = 18.sp, fontWeight = FontWeight.Black),
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                        singleLine = true,
                                        shape = RoundedCornerShape(12.dp),
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedContainerColor = Color.White,
                                            unfocusedContainerColor = Color.White
                                        )
                                    )

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("🚗 На машину остаётся:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF92400E))
                                        Text("${payroll.machinePool} ₽", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF78350F))
                                    }
                                }
                            }
                        }
                    }

                    // 8. АВТОМАТИЧЕСКИЙ РАСЧЁТ ЗП (Dark Card)
                    item {
                        Surface(
                            color = Zinc900,
                            shape = RoundedCornerShape(20.dp),
                            shadowElevation = 4.dp
                        ) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = if (isLoadersOnly) "⚡ РАСЧЁТ (БЕЗ АВТО · ПРР)" else "⚡ РАСЧЁТ ЗП («${currentDirectionObj.label}»)",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Black,
                                        color = SaldaOrangeLight,
                                        letterSpacing = 0.5.sp
                                    )
                                    Text(
                                        text = if (payroll.isAutomatic) "Автоматически" else "Ручной ввод",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Zinc400
                                    )
                                }

                                if (payroll.isAutomatic) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Surface(
                                            modifier = Modifier.weight(1f),
                                            color = Zinc800,
                                            shape = RoundedCornerShape(12.dp)
                                        ) {
                                            Column(modifier = Modifier.padding(10.dp)) {
                                                Text("🚗 За машину (30%)", fontSize = 10.sp, color = Zinc400, fontWeight = FontWeight.Bold)
                                                Text("${payroll.driverCarPay} ₽", fontSize = 16.sp, fontWeight = FontWeight.Black, color = Color.White)
                                                Text("из ${payroll.machinePool} ₽", fontSize = 9.sp, color = Zinc500)
                                            }
                                        }

                                        Surface(
                                            modifier = Modifier.weight(1f),
                                            color = Zinc800,
                                            shape = RoundedCornerShape(12.dp)
                                        ) {
                                            Column(modifier = Modifier.padding(10.dp)) {
                                                Text("📦 За погрузку (70%)", fontSize = 10.sp, color = Zinc400, fontWeight = FontWeight.Bold)
                                                Text("${payroll.driverLoaderPay} ₽", fontSize = 16.sp, fontWeight = FontWeight.Black, color = Color.White)
                                                Text(if (isDriverLoader) "из ${payroll.loadersPool} ₽" else "не отмечен", fontSize = 9.sp, color = Zinc500)
                                            }
                                        }
                                    }

                                    HorizontalDivider(color = Zinc800, thickness = 1.dp)

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text("ИТОГО ВОДИТЕЛЮ ЗА ЗАКАЗ", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Zinc400)
                                            Text("${payroll.driverTotalPay} ₽", fontSize = 24.sp, fontWeight = FontWeight.Black, color = SaldaOrangePrimary)
                                        }

                                        if (selectedLoaders.isNotEmpty()) {
                                            Column(horizontalAlignment = Alignment.End) {
                                                Text("ЗП ГРУЗЧИКАМ (${selectedLoaders.size})", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Zinc400)
                                                Text("${payroll.totalLoadersPay} ₽", fontSize = 16.sp, fontWeight = FontWeight.Black, color = Color(0xFF93C5FD))
                                            }
                                        }
                                    }
                                } else {
                                    // Ручной ввод ЗП водителя (например для Екб)
                                    val suggested = Math.round(amountDouble * 0.3).toInt()
                                    OutlinedTextField(
                                        value = manualDriverPayInput,
                                        onValueChange = { manualDriverPayInput = it },
                                        label = { Text("ЗП водителя (подсказка: ~$suggested ₽)", color = Zinc400) },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                        singleLine = true,
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            focusedBorderColor = SaldaOrangePrimary,
                                            unfocusedBorderColor = Zinc700
                                        ),
                                        shape = RoundedCornerShape(12.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            }
                        }
                    }

                    // 9. СПОСОБ ОПЛАТЫ (3 карточки)
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("СПОСОБ ОПЛАТЫ", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400, letterSpacing = 1.sp)

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                // QR
                                Surface(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(84.dp)
                                        .clickable { paymentMethod = "qr" },
                                    color = if (paymentMethod == "qr") Color(0xFFFAF5FF) else Color.White,
                                    shape = RoundedCornerShape(16.dp),
                                    border = androidx.compose.foundation.BorderStroke(
                                        if (paymentMethod == "qr") 2.dp else 1.dp,
                                        if (paymentMethod == "qr") Color(0xFF9333EA) else Zinc200
                                    )
                                ) {
                                    Column(
                                        modifier = Modifier.padding(8.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center
                                    ) {
                                        Text("⚡", fontSize = 20.sp)
                                        Text("QR-код", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Zinc900)
                                        Text("→ Р/С Т-Банк", fontSize = 8.sp, color = Zinc500, fontWeight = FontWeight.Bold)
                                    }
                                }

                                // Наличный (может быть отключён для безналичных клиентов)
                                Surface(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(84.dp)
                                        .clickable(enabled = !isClientNoCash) { paymentMethod = "cash" },
                                    color = if (isClientNoCash) Zinc100 else if (paymentMethod == "cash") Color(0xFFECFDF5) else Color.White,
                                    shape = RoundedCornerShape(16.dp),
                                    border = androidx.compose.foundation.BorderStroke(
                                        if (paymentMethod == "cash") 2.dp else 1.dp,
                                        if (isClientNoCash) Zinc200 else if (paymentMethod == "cash") Color(0xFF059669) else Zinc200
                                    )
                                ) {
                                    Column(
                                        modifier = Modifier.padding(8.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center
                                    ) {
                                        Text(if (isClientNoCash) "🚫" else "💵", fontSize = 20.sp)
                                        Text(
                                            "Наличный",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Black,
                                            color = if (isClientNoCash) Zinc400 else Zinc900
                                        )
                                        Text(
                                            if (isClientNoCash) "Запрещено" else "→ Сейф ТК",
                                            fontSize = 8.sp,
                                            color = if (isClientNoCash) RedAlert else Zinc500,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }

                                // Долг (дебиторка)
                                Surface(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(84.dp)
                                        .clickable { paymentMethod = "debt_cash" },
                                    color = if (paymentMethod == "debt_cash") Color(0xFFFFF1F2) else Color.White,
                                    shape = RoundedCornerShape(16.dp),
                                    border = androidx.compose.foundation.BorderStroke(
                                        if (paymentMethod == "debt_cash") 2.dp else 1.dp,
                                        if (paymentMethod == "debt_cash") Color(0xFFE11D48) else Zinc200
                                    )
                                ) {
                                    Column(
                                        modifier = Modifier.padding(8.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center
                                    ) {
                                        Text("⏳", fontSize = 20.sp)
                                        Text("Долг", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Zinc900)
                                        Text("→ Дебиторка", fontSize = 8.sp, color = Zinc500, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }

                    // 10. СПЕЦ ПОЛЯ (Геострой / Территория / Описание)
                    if (isGeostroy) {
                        item {
                            Surface(
                                color = Color(0xFFFEF3C7),
                                shape = RoundedCornerShape(16.dp),
                                border = androidx.compose.foundation.BorderStroke(2.dp, Color(0xFFFBBF24))
                            ) {
                                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("🏗️ ПРАВИЛО ДЛЯ ООО ГЕОСТРОЙИНДУСТРИЯ:", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF78350F))
                                    OutlinedTextField(
                                        value = geostroyRoute,
                                        onValueChange = { geostroyRoute = it },
                                        label = { Text("📍 Маршрут (обязательно)") },
                                        singleLine = true,
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("📅 Дата начала маршрута:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF78350F))
                                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                            val sdf = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault())
                                            TextButton(
                                                onClick = { geostroyDate = sdf.format(Date()) },
                                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                                            ) {
                                                Text("Сегодня", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                            }
                                            TextButton(
                                                onClick = {
                                                    val cal = Calendar.getInstance()
                                                    cal.add(Calendar.DAY_OF_YEAR, -1)
                                                    geostroyDate = sdf.format(cal.time)
                                                },
                                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                                            ) {
                                                Text("Вчера", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
                                    OutlinedTextField(
                                        value = geostroyDate,
                                        onValueChange = { geostroyDate = it },
                                        placeholder = { Text("ДД.ММ.ГГГГ") },
                                        singleLine = true,
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            }
                        }
                    } else if (isTerritory) {
                        item {
                            Surface(
                                color = Color(0xFFEFF6FF),
                                shape = RoundedCornerShape(16.dp),
                                border = androidx.compose.foundation.BorderStroke(2.dp, Color(0xFF93C5FD))
                            ) {
                                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("🏢 ПРАВИЛО ДЛЯ КОНТРАГЕНТА «ТЕРРИТОРИЯ»:", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF1E3A8A))
                                    OutlinedTextField(
                                        value = territoryAddress,
                                        onValueChange = { territoryAddress = it },
                                        label = { Text("📍 Адрес (улица + дом) *") },
                                        singleLine = true,
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                    OutlinedTextField(
                                        value = territoryWork,
                                        onValueChange = { territoryWork = it },
                                        label = { Text("🛠️ Описание работы *") },
                                        singleLine = true,
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            }
                        }
                    } else {
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("ПРИМЕЧАНИЕ / ОПИСАНИЕ", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400, letterSpacing = 1.sp)
                                OutlinedTextField(
                                    value = descriptionInput,
                                    onValueChange = { descriptionInput = it },
                                    placeholder = {
                                        Text(
                                            if (paymentMethod == "debt_cash") "Обещал заплатить в пятницу..." else "Детали заказа: холодильник, этаж, адрес...",
                                            fontSize = 13.sp
                                        )
                                    },
                                    shape = RoundedCornerShape(14.dp),
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }

                    // Ошибки валидации
                    if (errorMessage != null) {
                        item {
                            Surface(
                                color = Color(0xFFFEF2F2),
                                shape = RoundedCornerShape(12.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFECACA))
                            ) {
                                Text(
                                    text = errorMessage ?: "",
                                    color = RedAlert,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(12.dp)
                                )
                            }
                        }
                    }
                }

                // 11. Нижняя кнопка «Добавить заказ»
                Surface(
                    color = Color.White,
                    shadowElevation = 8.dp,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0))
                ) {
                    Column {
                        Box(modifier = Modifier.padding(16.dp)) {
                            Button(
                                onClick = {
                                    if (amountDouble <= 0.0) {
                                        errorMessage = "Введите корректную сумму заказа"
                                        return@Button
                                    }
                                    if (selectedCounterpartyId == null) {
                                        errorMessage = "Укажите клиента перед добавлением заказа"
                                        return@Button
                                    }
                                    if (isLoadersOnly && !isDriverLoader && selectedLoaders.isEmpty()) {
                                        errorMessage = "Укажите, кто выполнял разгрузку/погрузку: водитель или грузчики"
                                        return@Button
                                    }
                                    if (isGeostroy && (geostroyRoute.isBlank() || geostroyDate.isBlank())) {
                                        errorMessage = "Для Геостройиндустрия заполните маршрут и дату!"
                                        return@Button
                                    }
                                    if (isTerritory && (territoryAddress.isBlank() || territoryWork.isBlank())) {
                                        errorMessage = "Для контрагента Территория заполните адрес и работу!"
                                        return@Button
                                    }

                                    val finalDriverPay = if (payroll.isAutomatic) {
                                        payroll.driverTotalPay.toDouble()
                                    } else {
                                        manualDriverPayInput.toDoubleOrNull() ?: Math.round(amountDouble * 0.3).toDouble()
                                    }

                                    val finalDesc = when {
                                        isGeostroy -> "МАРШРУТ: $geostroyRoute ДАТА НАЧАЛА: $geostroyDate"
                                        isTerritory -> "АДРЕС: $territoryAddress РАБОТА: $territoryWork"
                                        descriptionInput.isNotBlank() -> descriptionInput
                                        paymentMethod == "debt_cash" -> "Долг: ${selectedClient?.name ?: "Клиент"}"
                                        else -> null
                                    }

                                    val loadersData = selectedLoaders.map { l ->
                                        LoaderPayItem(
                                            id = l.id,
                                            name = l.name,
                                            pay = payroll.loaderPayEach.toString()
                                        )
                                    }

                                    scope.launch {
                                        isSubmitting = true
                                        errorMessage = null
                                        try {
                                            val ok = SaldaApiClient.addTripOrder(
                                                tripId = tripId,
                                                amount = amountDouble,
                                                driverPay = finalDriverPay,
                                                description = finalDesc,
                                                direction = if (isLoadersOnly) "loaders_only" else direction,
                                                paymentMethod = paymentMethod,
                                                counterpartyId = selectedCounterpartyId,
                                                driverCarPay = payroll.driverCarPay.toDouble(),
                                                driverLoaderPay = payroll.driverLoaderPay.toDouble(),
                                                isDriverLoader = isDriverLoader,
                                                loadersData = loadersData,
                                                userId = userId
                                            )
                                            if (ok) {
                                                onSuccess()
                                                onDismiss()
                                            } else {
                                                errorMessage = "Ошибка при сохранении заказа"
                                            }
                                        } catch (e: Exception) {
                                            errorMessage = e.message ?: "Сетевая ошибка"
                                        } finally {
                                            isSubmitting = false
                                        }
                                    }
                                },
                                enabled = !isSubmitting,
                                colors = ButtonDefaults.buttonColors(containerColor = SaldaOrangePrimary),
                                shape = RoundedCornerShape(16.dp),
                                elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp, pressedElevation = 6.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(56.dp)
                                    .bouncyTouch()
                            ) {
                                if (isSubmitting) {
                                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                                } else {
                                    Text("✅ ДОБАВИТЬ ЗАКАЗ", fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                                }
                            }
                        }

                        // 2. АБСОЛЮТНАЯ ЗАЩИТА СНИЗУ:
                        // Физический разделитель под жестовую полоску / кнопки навигации телефона
                        Spacer(
                            modifier = Modifier
                                .fillMaxWidth()
                                .windowInsetsBottomHeight(WindowInsets.navigationBars)
                                .background(Color.White)
                        )
                    }
                }
            }

            // ─── Модалка выбора направления ───
            if (showDirectionPicker) {
                Dialog(onDismissRequest = { showDirectionPicker = false }) {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .fillMaxHeight(0.85f),
                        shape = RoundedCornerShape(24.dp),
                        color = Color.White
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Направление заказа", fontSize = 16.sp, fontWeight = FontWeight.Black)
                                IconButton(onClick = { showDirectionPicker = false }) {
                                    Icon(Icons.Default.Close, contentDescription = "Закрыть")
                                }
                            }

                            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                item {
                                    Text("📍 МЕСТНЫЕ НАПРАВЛЕНИЯ", fontSize = 10.sp, fontWeight = FontWeight.Black, color = SaldaOrangePrimary)
                                }
                                items(ORDER_DIRECTIONS.filter { it.category == "local" && it.id != "loaders_only" }, key = { it.id }) { dir ->
                                    val isSelected = dir.id == direction
                                    Surface(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                direction = dir.id
                                                showDirectionPicker = false
                                            },
                                        color = if (isSelected) SaldaOrange50 else Color.White,
                                        shape = RoundedCornerShape(14.dp),
                                        border = androidx.compose.foundation.BorderStroke(
                                            if (isSelected) 2.dp else 1.dp,
                                            if (isSelected) SaldaOrangePrimary else Zinc200
                                        )
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(12.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(dir.icon, fontSize = 22.sp)
                                            Spacer(modifier = Modifier.width(10.dp))
                                            Column {
                                                Text(dir.label, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Zinc900)
                                                Text(dir.desc, fontSize = 11.sp, color = Zinc500)
                                            }
                                        }
                                    }
                                }

                                item {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text("📍 ТАГИЛ И МЕЖГОРОД", fontSize = 10.sp, fontWeight = FontWeight.Black, color = SaldaOrangePrimary)
                                }
                                items(ORDER_DIRECTIONS.filter { it.category == "intercity" }, key = { it.id }) { dir ->
                                    val isSelected = dir.id == direction
                                    Surface(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                direction = dir.id
                                                showDirectionPicker = false
                                            },
                                        color = if (isSelected) SaldaOrange50 else Color.White,
                                        shape = RoundedCornerShape(14.dp),
                                        border = androidx.compose.foundation.BorderStroke(
                                            if (isSelected) 2.dp else 1.dp,
                                            if (isSelected) SaldaOrangePrimary else Zinc200
                                        )
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(12.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(dir.icon, fontSize = 22.sp)
                                            Spacer(modifier = Modifier.width(10.dp))
                                            Column {
                                                Text(dir.label, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Zinc900)
                                                Text(dir.desc, fontSize = 11.sp, color = Zinc500)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ─── Модалка выбора сторонних грузчиков ───
            if (showLoaderPicker) {
                Dialog(onDismissRequest = { showLoaderPicker = false }) {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .fillMaxHeight(0.7f),
                        shape = RoundedCornerShape(24.dp),
                        color = Color.White
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Выберите грузчика", fontSize = 16.sp, fontWeight = FontWeight.Black)
                                IconButton(onClick = { showLoaderPicker = false }) {
                                    Icon(Icons.Default.Close, contentDescription = "Закрыть")
                                }
                            }

                            val availableLoaders = localLoaders.filter { l -> selectedLoaders.none { it.id == l.id } }

                            if (isLoadingLoaders) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .weight(1f),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(color = SaldaOrangePrimary)
                                }
                            } else if (availableLoaders.isEmpty()) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .weight(1f),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    Text(
                                        if (localLoaders.isEmpty()) "Список грузчиков пуст" else "Все доступные грузчики добавлены",
                                        color = Zinc500,
                                        fontSize = 13.sp
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                    OutlinedButton(
                                        onClick = {
                                            scope.launch {
                                                isLoadingLoaders = true
                                                try {
                                                    localLoaders = SaldaApiClient.getLoaders(forceRefresh = true, userId = userId)
                                                } catch (_: Exception) {}
                                                finally { isLoadingLoaders = false }
                                            }
                                        }
                                    ) {
                                        Text("Обновить список", fontSize = 12.sp)
                                    }
                                }
                            } else {
                                LazyColumn(
                                    modifier = Modifier.weight(1f),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    items(availableLoaders, key = { it.id }) { loader ->
                                        Surface(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clickable {
                                                    selectedLoaders = selectedLoaders + loader
                                                    showLoaderPicker = false
                                                },
                                            shape = RoundedCornerShape(12.dp),
                                            border = androidx.compose.foundation.BorderStroke(1.dp, Zinc200),
                                            color = Color.White
                                        ) {
                                            Row(
                                                modifier = Modifier.padding(12.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
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
                                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                                        Text(loader.name, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                                        if (loader.effectiveIsOnline) {
                                                            Spacer(modifier = Modifier.width(6.dp))
                                                            Text("🟢", fontSize = 10.sp)
                                                            Text(if (loader.effectiveHasTransport) "🚗" else "🚶", fontSize = 11.sp)
                                                        }
                                                    }
                                                    Text(
                                                        if (loader.effectiveIsOnline) "На линии · 📍 " + loader.effectiveAddress else (loader.phone ?: "Сотрудник ПРР"),
                                                        fontSize = 11.sp,
                                                        color = if (loader.effectiveIsOnline) GreenOnline else Zinc500
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
    }
}
