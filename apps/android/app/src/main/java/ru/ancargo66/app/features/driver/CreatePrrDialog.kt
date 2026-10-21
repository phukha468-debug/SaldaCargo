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
import kotlinx.coroutines.launch
import ru.ancargo66.app.core.model.Counterparty
import ru.ancargo66.app.core.model.LoaderPayItem
import ru.ancargo66.app.core.model.User
import ru.ancargo66.app.core.network.SaldaApiClient
import ru.ancargo66.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreatePrrDialog(
    userId: String,
    onDismiss: () -> Unit,
    onSuccess: () -> Unit
) {
    var counterparties by remember { mutableStateOf<List<Counterparty>>(emptyList()) }
    var allLoaders by remember { mutableStateOf<List<User>>(emptyList()) }
    var selectedCounterpartyId by remember { mutableStateOf<String?>(null) }
    var amountInput by remember { mutableStateOf("") }
    var paymentMethod by remember { mutableStateOf("cash") } // cash, qr, debt_cash
    var selectedLoaders by remember { mutableStateOf<List<LoaderPayItem>>(emptyList()) }
    var descriptionInput by remember { mutableStateOf("") }

    // Спец поля для Геостройиндустрия
    var geostroyRoute by remember { mutableStateOf("") }
    var geostroyDate by remember { mutableStateOf("") }

    // Спец поля для Территория
    var territoryAddress by remember { mutableStateOf("") }
    var territoryWork by remember { mutableStateOf("") }

    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var clientSearch by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                counterparties = SaldaApiClient.getCounterparties(userId)
                allLoaders = SaldaApiClient.getLoaders()
                val generic = counterparties.find { it.name == "Частный клиент" } ?: counterparties.firstOrNull()
                if (generic != null) {
                    selectedCounterpartyId = generic.id
                }
            } catch (_: Exception) {}
        }
    }

    val selectedClient = counterparties.find { it.id == selectedCounterpartyId }
    val isGeostroy = selectedClient?.name?.contains("Геострой", ignoreCase = true) == true
    val isTerritory = selectedClient?.name?.contains("Территория", ignoreCase = true) == true

    AlertDialog(
        onDismissRequest = { if (!isSubmitting) onDismiss() },
        title = {
            Text("Новый ПРР заказ (без авто)", fontWeight = FontWeight.Bold, fontSize = 18.sp)
        },
        text = {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 450.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Выбор клиента
                item {
                    Text("КЛИЕНТ / КОНТРАГЕНТ", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = clientSearch,
                        onValueChange = { clientSearch = it },
                        placeholder = { Text(selectedClient?.name ?: "Поиск клиента...") },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Zinc500) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                // Быстрые клиенты или результаты поиска
                val displayedClients = if (clientSearch.isNotBlank()) {
                    counterparties.filter { it.name.contains(clientSearch, ignoreCase = true) }.take(6)
                } else {
                    counterparties.take(5)
                }

                items(displayedClients, key = { it.id ?: it.name }) { cp ->
                    val isSelected = cp.id == selectedCounterpartyId
                    Surface(
                        onClick = {
                            selectedCounterpartyId = cp.id
                            clientSearch = ""
                            if (cp.name.contains("Геострой") || cp.name.contains("ВСМПО")) {
                                paymentMethod = "debt_cash"
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
                                .padding(10.dp),
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
                                    value = geostroyRoute,
                                    onValueChange = { geostroyRoute = it },
                                    label = { Text("Маршрут") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = geostroyDate,
                                    onValueChange = { geostroyDate = it },
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
                                    value = territoryAddress,
                                    onValueChange = { territoryAddress = it },
                                    label = { Text("Адрес (улица + дом)") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = territoryWork,
                                    onValueChange = { territoryWork = it },
                                    label = { Text("Описание работы") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }

                // Сумма заказа
                item {
                    Text("СТОИМОСТЬ РАБОТЫ (₽)", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = amountInput,
                        onValueChange = { amountInput = it },
                        placeholder = { Text("Например: 3000") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                // Способ оплаты (1. Наличные, 2. QR-код, 3. В долг)
                item {
                    Text("СПОСОБ ОПЛАТЫ", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf("cash" to "💵 Нал", "qr" to "⚡ QR", "debt_cash" to "⏳ В долг").forEach { (method, label) ->
                            FilterChip(
                                selected = paymentMethod == method,
                                onClick = { paymentMethod = method },
                                label = { Text(label, fontSize = 11.sp) }
                            )
                        }
                    }
                }

                // Выбор грузчиков
                item {
                    Text("ГРУЗЧИКИ НА ЗАКАЗЕ (${selectedLoaders.size} выбрано)", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                    Spacer(modifier = Modifier.height(4.dp))
                }

                items(allLoaders, key = { it.id }) { loader ->
                    val isSelected = selectedLoaders.any { it.id == loader.id }
                    val currentItem = selectedLoaders.find { it.id == loader.id }

                    Surface(
                        onClick = {
                            if (isSelected) {
                                selectedLoaders = selectedLoaders.filter { it.id != loader.id }
                            } else {
                                val amt = amountInput.toDoubleOrNull() ?: 0.0
                                val defaultPay = if (selectedLoaders.isEmpty()) ((amt * 0.70)).toInt().toString() else ((amt * 0.70) / (selectedLoaders.size + 1)).toInt().toString()
                                selectedLoaders = selectedLoaders + LoaderPayItem(id = loader.id, name = loader.name, pay = defaultPay)
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
                                .padding(10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = "👷 ${loader.name}", fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal, fontSize = 13.sp)
                            if (isSelected) {
                                Text("Оплата: ${currentItem?.pay ?: "0"} ₽", color = GreenOnline, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }
                }

                if (errorMessage != null) {
                    item {
                        Text(
                            text = errorMessage ?: "",
                            color = RedAlert,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amt = amountInput.toDoubleOrNull()
                    if (amt == null || amt <= 0) {
                        errorMessage = "Укажите корректную сумму заказа"
                        return@Button
                    }
                    if (selectedCounterpartyId == null) {
                        errorMessage = "Выберите клиента"
                        return@Button
                    }
                    if (selectedLoaders.isEmpty()) {
                        errorMessage = "Выберите хотя бы одного грузчика"
                        return@Button
                    }
                    if (isGeostroy && (geostroyRoute.isBlank() || geostroyDate.isBlank())) {
                        errorMessage = "Для ООО Геостройиндустрия заполните маршрут и дату начала (ДД.ММ.ГГГГ)"
                        return@Button
                    }
                    if (isTerritory && (territoryAddress.isBlank() || territoryWork.isBlank())) {
                        errorMessage = "Для Территория заполните адрес и работу"
                        return@Button
                    }

                    val finalDesc = when {
                        isGeostroy -> "МАРШРУТ: $geostroyRoute ДАТА НАЧАЛА: $geostroyDate"
                        isTerritory -> "АДРЕС: $territoryAddress РАБОТА: $territoryWork"
                        descriptionInput.isNotBlank() -> descriptionInput
                        else -> "Погрузо-разгрузочные работы (без авто)"
                    }

                    scope.launch {
                        isSubmitting = true
                        errorMessage = null
                        val ok = SaldaApiClient.createPrrOrder(
                            counterpartyId = selectedCounterpartyId!!,
                            amount = amt,
                            paymentMethod = paymentMethod,
                            loaders = selectedLoaders,
                            description = finalDesc,
                            userId = userId
                        )
                        isSubmitting = false
                        if (ok) {
                            onSuccess()
                        } else {
                            errorMessage = "Ошибка при сохранении заказа на сервере"
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = SaldaOrangePrimary),
                enabled = !isSubmitting
            ) {
                Text(if (isSubmitting) "Создание..." else "Создать ПРР")
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isSubmitting
            ) {
                Text("Отмена", color = Zinc500)
            }
        }
    )
}
