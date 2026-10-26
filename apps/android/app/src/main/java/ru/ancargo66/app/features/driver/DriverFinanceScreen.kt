package ru.ancargo66.app.features.driver

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import ru.ancargo66.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DriverFinanceScreen(
    user: User,
    initialTab: Int = 1, // 0: Подотчёт, 1: Зарплата (по умолчанию Зарплата)
    onBack: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(initialTab) }
    var financeData by remember { mutableStateOf<DriverFinanceData?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var actionInProgressId by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    val loadFinance = {
        scope.launch {
            isLoading = true
            try {
                financeData = SaldaApiClient.getDriverFinance(user.id)
            } catch (_: Exception) {}
            finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(user.id) {
        loadFinance()
    }

    BackHandler(onBack = onBack)

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .swipeToBack(onBack = onBack),
        topBar = {
            TopAppBar(
                title = {
                    Text("Финансы водителя", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Zinc900)
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад", tint = Zinc700)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Zinc50)
                .padding(innerPadding)
        ) {
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = Zinc100,
                contentColor = SaldaOrangePrimary
            ) {
                Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }) {
                    Text("Подотчёт (На руках)", modifier = Modifier.padding(12.dp), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
                Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }) {
                    val pendingCount = financeData?.salary?.pendingConfirmation?.size ?: 0
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Зарплата", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        if (pendingCount > 0) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Surface(
                                color = AmberPending,
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text(
                                    text = "$pendingCount",
                                    color = Color.White,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 1.dp)
                                )
                            }
                        }
                    }
                }
            }

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = SaldaOrangePrimary)
                }
            } else {
                when (selectedTab) {
                    0 -> { // Вкладка Подотчёта
                        val acc = financeData?.accountable
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            item {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = Color.White),
                                    shape = RoundedCornerShape(12.dp),
                                    border = CardDefaults.outlinedCardBorder()
                                ) {
                                    Column(modifier = Modifier.padding(18.dp)) {
                                        Text(
                                            text = "НАЛИЧНЫЕ НА РУКАХ",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Black,
                                            color = Zinc400,
                                            letterSpacing = 1.sp
                                        )
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(
                                            text = "${acc?.balance ?: "0"} ₽",
                                            fontSize = 32.sp,
                                            fontWeight = FontWeight.Black,
                                            color = Zinc900
                                        )
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = "Сумма принятых наличных от клиентов, подлежащая сдаче в сейф кассы компании",
                                            fontSize = 12.sp,
                                            color = Zinc500
                                        )

                                        if (acc?.activeCarryover != null) {
                                            Spacer(modifier = Modifier.height(10.dp))
                                            Surface(
                                                color = Color(0xFFFEE2E2),
                                                shape = RoundedCornerShape(8.dp),
                                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFCA5A5)),
                                                modifier = Modifier.fillMaxWidth()
                                            ) {
                                                Column(modifier = Modifier.padding(10.dp)) {
                                                    Text(
                                                        text = "⚠️ В т.ч. перенос с прошлого дня: ${acc.activeCarryover.amount} ₽",
                                                        fontSize = 12.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color(0xFFB91C1C)
                                                    )
                                                    if (acc.activeCarryover.note.isNotBlank()) {
                                                        Spacer(modifier = Modifier.height(2.dp))
                                                        Text(
                                                            text = "Причина: ${acc.activeCarryover.note}",
                                                            fontSize = 11.sp,
                                                            color = Color(0xFF7F1D1D)
                                                        )
                                                    }
                                                    Spacer(modifier = Modifier.height(2.dp))
                                                    Text(
                                                        text = "Сдать в кассу поверх выручки текущей смены!",
                                                        fontSize = 11.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color(0xFFB91C1C)
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            item {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "ИСТОРИЯ ПРИЁМА НАЛИЧНЫХ",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Zinc400,
                                    letterSpacing = 1.sp
                                )
                            }

                            val txns = acc?.transactions ?: emptyList()
                            if (txns.isEmpty()) {
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
                                            Text("Операций пока нет", color = Zinc500, fontSize = 13.sp)
                                        }
                                    }
                                }
                            } else {
                                items(txns, key = { it.id }) { txn ->
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
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = txn.description ?: "Оплата заказа",
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 14.sp,
                                                    color = Zinc900
                                                )
                                                Text(
                                                    text = "💵 Наличные клиентом",
                                                    fontSize = 11.sp,
                                                    color = Zinc500
                                                )
                                            }
                                            Text(
                                                text = "+ ${txn.amount.toInt()} ₽",
                                                fontWeight = FontWeight.Black,
                                                fontSize = 15.sp,
                                                color = Zinc900
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    1 -> { // Вкладка Зарплаты
                        val sal = financeData?.salary
                        val pending = sal?.pendingConfirmation ?: emptyList()
                        val accruals = sal?.accruals ?: emptyList()

                        LazyColumn(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            // Карточка накоплено к выплате
                            item {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = Color.White),
                                    shape = RoundedCornerShape(12.dp),
                                    border = CardDefaults.outlinedCardBorder()
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(18.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Text(
                                            text = "НАКОПЛЕНО К ВЫПЛАТЕ",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Black,
                                            color = Zinc400,
                                            letterSpacing = 1.sp
                                        )
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(
                                            text = "${sal?.accumulatedTotal ?: "0.00"} ₽",
                                            fontSize = 32.sp,
                                            fontWeight = FontWeight.Black,
                                            color = GreenOnline
                                        )
                                        if (pending.isNotEmpty()) {
                                            val pendingSum = pending.sumOf { it.amount }
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(
                                                text = "+ ещё ${pendingSum.toInt()} ₽ ожидает подтверждения",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = AmberPending
                                            )
                                        }
                                    }
                                }
                            }

                            // Блок ожидающих подтверждения начислений
                            if (pending.isNotEmpty()) {
                                item {
                                    Card(
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7)),
                                        shape = RoundedCornerShape(12.dp),
                                        border = CardDefaults.outlinedCardBorder().copy(
                                            brush = androidx.compose.ui.graphics.SolidColor(AmberPending),
                                            width = 1.dp
                                        )
                                    ) {
                                        Column(modifier = Modifier.padding(14.dp)) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = "ОЖИДАЮТ ПОДТВЕРЖДЕНИЯ (${pending.size})",
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = Color(0xFF92400E),
                                                    letterSpacing = 1.sp
                                                )
                                                TextButton(
                                                    onClick = {
                                                        scope.launch {
                                                            actionInProgressId = "all"
                                                            SaldaApiClient.confirmEmployeePayroll(user.id, null)
                                                            actionInProgressId = null
                                                            loadFinance()
                                                        }
                                                    },
                                                    enabled = actionInProgressId == null
                                                ) {
                                                    Text(
                                                        text = if (actionInProgressId == "all") "..." else "Подтвердить всё",
                                                        fontWeight = FontWeight.Black,
                                                        fontSize = 11.sp,
                                                        color = GreenOnline
                                                    )
                                                }
                                            }

                                            Spacer(modifier = Modifier.height(8.dp))

                                            pending.forEach { item ->
                                                Surface(
                                                    color = Color.White,
                                                    shape = RoundedCornerShape(10.dp),
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .padding(vertical = 4.dp)
                                                ) {
                                                    Column(modifier = Modifier.padding(12.dp)) {
                                                        Row(
                                                            modifier = Modifier.fillMaxWidth(),
                                                            horizontalArrangement = Arrangement.SpaceBetween,
                                                            verticalAlignment = Alignment.CenterVertically
                                                        ) {
                                                            Column(modifier = Modifier.weight(1f)) {
                                                                Text(
                                                                    text = item.label,
                                                                    fontSize = 10.sp,
                                                                    fontWeight = FontWeight.Black,
                                                                    color = Zinc500
                                                                )
                                                                Text(
                                                                    text = item.context,
                                                                    fontWeight = FontWeight.Bold,
                                                                    fontSize = 13.sp,
                                                                    color = Zinc900
                                                                )
                                                            }
                                                            Text(
                                                                text = "+ ${item.amount.toInt()} ₽",
                                                                fontWeight = FontWeight.Black,
                                                                fontSize = 16.sp,
                                                                color = GreenOnline
                                                            )
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
                                                                contentPadding = PaddingValues(vertical = 8.dp),
                                                                enabled = actionInProgressId != item.id
                                                            ) {
                                                                Text(if (actionInProgressId == item.id) "..." else "✓ Подтвердить", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                                            }

                                                            OutlinedButton(
                                                                onClick = {
                                                                    scope.launch {
                                                                        actionInProgressId = item.id
                                                                        SaldaApiClient.rejectEmployeePayroll(user.id, item.id)
                                                                        actionInProgressId = null
                                                                        loadFinance()
                                                                    }
                                                                },
                                                                shape = RoundedCornerShape(8.dp),
                                                                contentPadding = PaddingValues(vertical = 8.dp),
                                                                enabled = actionInProgressId != item.id
                                                            ) {
                                                                Text("✗ Не согласен", fontSize = 12.sp, color = RedAlert)
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // История начислений
                            item {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "ИСТОРИЯ НАЧИСЛЕНИЙ",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Zinc400,
                                    letterSpacing = 1.sp
                                )
                            }

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
                                                    text = "${acc.label} • Рейс №${acc.tripNumber ?: "—"}",
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 14.sp,
                                                    color = Zinc900
                                                )
                                                Text(
                                                    text = acc.assetName ?: "Автомобиль ТК",
                                                    fontSize = 12.sp,
                                                    color = Zinc500
                                                )
                                            }
                                            Column(horizontalAlignment = Alignment.End) {
                                                Text(
                                                    text = "+ ${acc.amount.toInt()} ₽",
                                                    fontWeight = FontWeight.Black,
                                                    fontSize = 15.sp,
                                                    color = GreenOnline
                                                )
                                                Surface(
                                                    color = if (acc.settlementStatus == "completed") GreenOnline.copy(alpha = 0.1f) else AmberPending.copy(alpha = 0.1f),
                                                    shape = RoundedCornerShape(4.dp)
                                                ) {
                                                    Text(
                                                        text = if (acc.settlementStatus == "completed") "Выплачено" else "К выплате",
                                                        color = if (acc.settlementStatus == "completed") GreenOnline else AmberPending,
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
                }
            }
        }
    }
}
