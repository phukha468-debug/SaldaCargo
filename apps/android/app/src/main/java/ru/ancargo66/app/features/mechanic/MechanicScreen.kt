package ru.ancargo66.app.features.mechanic

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
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import ru.ancargo66.app.core.model.ServiceOrder
import ru.ancargo66.app.core.model.User
import ru.ancargo66.app.core.network.SupabaseApi
import ru.ancargo66.app.ui.theme.*

@Composable
fun MechanicScreen(
    user: User,
    onLogout: () -> Unit
) {
    var orders by remember { mutableStateOf<List<ServiceOrder>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var activeTimerRunning by remember { mutableStateOf(false) }
    var timerSeconds by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(activeTimerRunning) {
        while (activeTimerRunning) {
            delay(1000)
            timerSeconds++
        }
    }

    LaunchedEffect(user.id) {
        isLoading = true
        try {
            orders = SupabaseApi.getMechanicOrders(user.id)
        } catch (_: Exception) {}
        finally {
            isLoading = false
        }
    }

    val formatTimer = { sec: Int ->
        val m = sec / 60
        val s = sec % 60
        String.format("%02d:%02d", m, s)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Шапка
        Row(
            modifier = Modifier.fillMaxWidth(),
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
                        Icon(Icons.Default.Build, contentDescription = null, tint = SaldaOrangePrimary)
                    }
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(text = user.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Zinc900)
                    Text(text = "Механик СТО • Гараж", fontSize = 12.sp, color = Zinc500)
                }
            }
            IconButton(onClick = onLogout) {
                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Выйти", tint = Zinc500)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Баннер таймера работы
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = if (activeTimerRunning) AmberWarning.copy(alpha = 0.12f) else Zinc100
            ),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "ТЕКУЩАЯ РАБОТА В ЦЕХУ",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Zinc500
                )
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "ТО ГАЗель #А501ТО (Замена колодок)",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Zinc900,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = formatTimer(timerSeconds),
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (activeTimerRunning) AmberWarning else Zinc500
                    )
                }
                Spacer(modifier = Modifier.height(12.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { activeTimerRunning = !activeTimerRunning },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (activeTimerRunning) AmberWarning else SaldaOrangePrimary
                        ),
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(if (activeTimerRunning) Icons.Default.Pause else Icons.Default.PlayArrow, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (activeTimerRunning) "Пауза" else "Старт работы")
                    }

                    if (timerSeconds > 0) {
                        OutlinedButton(
                            onClick = {
                                activeTimerRunning = false
                                timerSeconds = 0
                            },
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Сброс")
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        Text(
            text = "Заказ-наряды в работе",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = Zinc900
        )

        Spacer(modifier = Modifier.height(10.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxWidth().height(100.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = SaldaOrangePrimary)
            }
        } else {
            LazyColumn(modifier = Modifier.weight(1f)) {
                items(orders.ifEmpty { 
                    listOf(
                        ServiceOrder(id = "1", clientVehicleReg = "А501ТО", clientName = "Автопарк TK501", adminNote = "Замена масла, диагностика подвески", status = "in_progress"),
                        ServiceOrder(id = "2", clientVehicleReg = "О782ТТ", clientName = "Клиент (Валдай)", adminNote = "Замена сцепления", status = "pending")
                    )
                }) { order ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "Авто: ${order.clientVehicleReg ?: "Газель"}",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                                Surface(
                                    color = if (order.status == "in_progress") AmberWarning.copy(alpha = 0.15f) else Zinc100,
                                    shape = RoundedCornerShape(4.dp)
                                ) {
                                    Text(
                                        text = if (order.status == "in_progress") "В РЕМОНТЕ" else "ОЖИДАЕТ",
                                        color = if (order.status == "in_progress") AmberWarning else Zinc700,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = order.adminNote ?: "Регламентное обслуживание",
                                fontSize = 12.sp,
                                color = Zinc700
                            )
                        }
                    }
                }
            }
        }
    }
}
