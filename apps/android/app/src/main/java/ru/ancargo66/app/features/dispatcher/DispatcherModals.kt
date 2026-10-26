package ru.ancargo66.app.features.dispatcher

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.launch
import ru.ancargo66.app.core.model.MechanicOrder
import ru.ancargo66.app.core.model.WalletBalance
import ru.ancargo66.app.core.network.SaldaApiClient
import ru.ancargo66.app.ui.theme.*

@Composable
fun WalletTransferDialog(
    wallets: List<WalletBalance>,
    adminId: String,
    onDismiss: () -> Unit,
    onSuccess: () -> Unit
) {
    var fromWalletId by remember {
        mutableStateOf(wallets.firstOrNull { it.type == "bank" }?.id ?: wallets.firstOrNull()?.id ?: "")
    }
    var toWalletId by remember {
        mutableStateOf(wallets.firstOrNull { it.type == "cash" && it.id != fromWalletId }?.id ?: wallets.lastOrNull()?.id ?: "")
    }
    var amountText by remember { mutableStateOf("") }
    var comment by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("↔ Перевод между счетами", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Zinc900)
                IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = Zinc500)
                }
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (errorMessage != null) {
                    Surface(
                        color = RedAlert.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = errorMessage ?: "",
                            color = RedAlert,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }

                // Откуда
                Column {
                    Text("ОТКУДА (СПИСАНИЕ)", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                    Spacer(modifier = Modifier.height(4.dp))
                    wallets.forEach { w ->
                        val isSelected = w.id == fromWalletId
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 2.dp)
                                .clickable { fromWalletId = w.id },
                            color = if (isSelected) SaldaOrange50 else Zinc50,
                            border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) SaldaOrangePrimary else Zinc200),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(w.name, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Zinc800)
                                Text("${w.balance.toInt()} ₽", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Zinc900)
                            }
                        }
                    }
                }

                // Куда
                Column {
                    Text("КУДА (ЗАЧИСЛЕНИЕ)", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                    Spacer(modifier = Modifier.height(4.dp))
                    wallets.filter { it.id != fromWalletId }.forEach { w ->
                        val isSelected = w.id == toWalletId
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 2.dp)
                                .clickable { toWalletId = w.id },
                            color = if (isSelected) Color(0xFFECFDF5) else Zinc50,
                            border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) Color(0xFF059669) else Zinc200),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(w.name, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Zinc800)
                                Text("${w.balance.toInt()} ₽", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Zinc900)
                            }
                        }
                    }
                }

                // Сумма
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text("Сумма перевода, ₽") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                // Комментарий
                OutlinedTextField(
                    value = comment,
                    onValueChange = { comment = it },
                    label = { Text("Комментарий (необязательно)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amt = amountText.toDoubleOrNull() ?: 0.0
                    if (amt <= 0.0) {
                        errorMessage = "Введите корректную сумму"
                        return@Button
                    }
                    if (fromWalletId.isBlank() || toWalletId.isBlank() || fromWalletId == toWalletId) {
                        errorMessage = "Выберите разные кошельки"
                        return@Button
                    }

                    scope.launch {
                        isSubmitting = true
                        errorMessage = null
                        try {
                            val ok = SaldaApiClient.transferBetweenWallets(
                                fromWalletId = fromWalletId,
                                toWalletId = toWalletId,
                                amount = amt,
                                comment = comment.ifBlank { "Перевод между счетами" },
                                adminId = adminId
                            )
                            if (ok) {
                                onSuccess()
                            } else {
                                errorMessage = "Не удалось выполнить перевод"
                            }
                        } catch (e: Exception) {
                            errorMessage = e.message ?: "Ошибка перевода"
                        } finally {
                            isSubmitting = false
                        }
                    }
                },
                enabled = !isSubmitting,
                colors = ButtonDefaults.buttonColors(containerColor = Zinc900),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text(if (isSubmitting) "Переводим..." else "Перевести", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Отмена", color = Zinc600)
            }
        }
    )
}

data class EditableWorkRow(
    val id: String = java.util.UUID.randomUUID().toString(),
    var name: String,
    var minutesText: String
)

data class EditablePartRow(
    val id: String = java.util.UUID.randomUUID().toString(),
    var name: String,
    var qtyText: String,
    var priceText: String
)

@Composable
fun ServiceOrderEditDialog(
    order: MechanicOrder,
    adminId: String,
    onDismiss: () -> Unit,
    onSuccess: () -> Unit
) {
    val works = remember {
        mutableStateListOf<EditableWorkRow>().apply {
            addAll(order.works.map { EditableWorkRow(name = it.displayName, minutesText = it.effectiveMinutes.toString()) })
            if (isEmpty()) add(EditableWorkRow(name = "", minutesText = "60"))
        }
    }

    val parts = remember {
        mutableStateListOf<EditablePartRow>().apply {
            addAll(order.parts.map { EditablePartRow(name = it.displayName, qtyText = it.quantity.toInt().toString(), priceText = "0") })
        }
    }

    val todayStr = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()) }
    val defaultStartDate = order.startedAt?.take(10) ?: order.createdAt?.take(10) ?: todayStr
    val defaultEndDate = order.completedAt?.take(10) ?: defaultStartDate

    var startDateText by remember { mutableStateOf(defaultStartDate) }
    var endDateText by remember { mutableStateOf(defaultEndDate) }
    var odometerText by remember { mutableStateOf(if (order.odometerEnd > 0) order.odometerEnd.toString() else if (order.odometerStart > 0) order.odometerStart.toString() else "") }
    var mechanicPayText by remember { mutableStateOf(if (order.mechanicPay > 0.0) order.mechanicPay.toInt().toString() else "") }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("✏ Редактировать наряд №${order.orderNumber}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Zinc900)
                IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = Zinc500)
                }
            }
        },
        text = {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 480.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (errorMessage != null) {
                    item {
                        Surface(
                            color = RedAlert.copy(alpha = 0.1f),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = errorMessage ?: "",
                                color = RedAlert,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                    }
                }

                // Даты начала и окончания работ
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("НАЧАЛО НАPЯДА", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc500)
                            Spacer(modifier = Modifier.height(4.dp))
                            OutlinedTextField(
                                value = startDateText,
                                onValueChange = {
                                    startDateText = it
                                    if (endDateText < it) endDateText = it
                                },
                                placeholder = { Text("ГГГГ-ММ-ДД", fontSize = 11.sp) },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true,
                                shape = RoundedCornerShape(8.dp)
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text("ОКОНЧАНИЕ НАPЯДА", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc500)
                            Spacer(modifier = Modifier.height(4.dp))
                            OutlinedTextField(
                                value = endDateText,
                                onValueChange = { endDateText = it },
                                placeholder = { Text("ГГГГ-ММ-ДД", fontSize = 11.sp) },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true,
                                shape = RoundedCornerShape(8.dp)
                            )
                        }
                    }
                }

                // Работы
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("ПЕРЕЧЕНЬ РАБОТ", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc500)
                        TextButton(
                            onClick = { works.add(EditableWorkRow(name = "", minutesText = "60")) },
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Text("+ Добавить работу", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SaldaOrangePrimary)
                        }
                    }
                }

                items(works.size) { idx ->
                    val w = works[idx]
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = w.name,
                            onValueChange = { works[idx] = w.copy(name = it) },
                            placeholder = { Text("Наименование работы", fontSize = 11.sp) },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            shape = RoundedCornerShape(8.dp)
                        )
                        OutlinedTextField(
                            value = w.minutesText,
                            onValueChange = { works[idx] = w.copy(minutesText = it.filter { c -> c.isDigit() }) },
                            placeholder = { Text("мин", fontSize = 11.sp) },
                            modifier = Modifier.width(70.dp),
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            shape = RoundedCornerShape(8.dp)
                        )
                        if (works.size > 1) {
                            IconButton(
                                onClick = { works.removeAt(idx) },
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(Icons.Default.Delete, contentDescription = "Удалить", tint = RedAlert, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }

                // Запчасти
                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("ЗАПЧАСТИ СЕРВИСА", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc500)
                        TextButton(
                            onClick = { parts.add(EditablePartRow(name = "", qtyText = "1", priceText = "0")) },
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Text("+ Запчасть", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF15803D))
                        }
                    }
                }

                if (parts.isEmpty()) {
                    item {
                        Text("Запчасти от автосервиса не указаны", fontSize = 11.sp, color = Zinc400)
                    }
                } else {
                    items(parts.size) { idx ->
                        val p = parts[idx]
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            OutlinedTextField(
                                value = p.name,
                                onValueChange = { parts[idx] = p.copy(name = it) },
                                placeholder = { Text("Запчасть", fontSize = 11.sp) },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                                shape = RoundedCornerShape(8.dp)
                            )
                            OutlinedTextField(
                                value = p.qtyText,
                                onValueChange = { parts[idx] = p.copy(qtyText = it.filter { c -> c.isDigit() }) },
                                placeholder = { Text("кол", fontSize = 11.sp) },
                                modifier = Modifier.width(55.dp),
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                shape = RoundedCornerShape(8.dp)
                            )
                            OutlinedTextField(
                                value = p.priceText,
                                onValueChange = { parts[idx] = p.copy(priceText = it.filter { c -> c.isDigit() }) },
                                placeholder = { Text("₽", fontSize = 11.sp) },
                                modifier = Modifier.width(65.dp),
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                shape = RoundedCornerShape(8.dp)
                            )
                            IconButton(
                                onClick = { parts.removeAt(idx) },
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(Icons.Default.Delete, contentDescription = "Удалить", tint = RedAlert, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }

                // Одометр и ЗП механика
                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = odometerText,
                            onValueChange = { odometerText = it.filter { c -> c.isDigit() } },
                            label = { Text("Одометр, км", fontSize = 11.sp) },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            shape = RoundedCornerShape(8.dp)
                        )
                        OutlinedTextField(
                            value = mechanicPayText,
                            onValueChange = { mechanicPayText = it.filter { c -> c.isDigit() || c == '.' } },
                            label = { Text("ЗП механика, ₽", fontSize = 11.sp) },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            shape = RoundedCornerShape(8.dp)
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val validWorks = works
                        .filter { it.name.isNotBlank() }
                        .map { it.name.trim() to (it.minutesText.toLongOrNull() ?: 60L) }

                    if (validWorks.isEmpty()) {
                        errorMessage = "Добавьте хотя бы одну работу"
                        return@Button
                    }

                    val validParts = parts
                        .filter { it.name.isNotBlank() }
                        .map { Triple(it.name.trim(), it.qtyText.toDoubleOrNull() ?: 1.0, it.priceText.toDoubleOrNull() ?: 0.0) }

                    val odo = odometerText.toLongOrNull()
                    val pay = mechanicPayText.toDoubleOrNull()

                    scope.launch {
                        isSubmitting = true
                        errorMessage = null
                        try {
                            val ok = SaldaApiClient.updateAdminServiceOrder(
                                orderId = order.id,
                                adminId = adminId,
                                works = validWorks,
                                parts = validParts,
                                odometer = odo,
                                mechanicPay = pay,
                                startedAt = startDateText.takeIf { it.isNotBlank() },
                                completedAt = endDateText.takeIf { it.isNotBlank() }
                            )
                            if (ok) {
                                onSuccess()
                            } else {
                                errorMessage = "Ошибка сохранения изменений"
                            }
                        } catch (e: Exception) {
                            errorMessage = e.message ?: "Ошибка сохранения"
                        } finally {
                            isSubmitting = false
                        }
                    }
                },
                enabled = !isSubmitting,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF21A038)),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text(if (isSubmitting) "Сохраняем..." else "Сохранить", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Отмена", color = Zinc600)
            }
        }
    )
}

@Composable
fun DriverCashHoldDialog(
    drivers: List<ru.ancargo66.app.core.model.User>,
    defaultDriverId: String? = null,
    adminId: String,
    onDismiss: () -> Unit,
    onSuccess: () -> Unit
) {
    var selectedDriverId by remember {
        mutableStateOf(defaultDriverId ?: drivers.firstOrNull { it.roles.contains("driver") }?.id ?: drivers.firstOrNull()?.id ?: "")
    }
    var amountText by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    val driverList = remember(drivers) {
        drivers.filter { it.roles.contains("driver") }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("📋 Зафиксировать остаток подотчёта", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Zinc900)
                IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = Zinc500)
                }
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (errorMessage != null) {
                    Surface(
                        color = RedAlert.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = errorMessage ?: "",
                            color = RedAlert,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }

                Text(
                    "Используется, когда водитель не смог сдать наличные в кассу сегодня и они остаются у него на руках до следующего дня.",
                    fontSize = 12.sp,
                    color = Zinc600
                )

                // Выбор водителя
                Column {
                    Text("ВОДИТЕЛЬ", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                    Spacer(modifier = Modifier.height(4.dp))
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 140.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        items(driverList.size) { idx ->
                            val d = driverList[idx]
                            val isSelected = d.id == selectedDriverId
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedDriverId = d.id },
                                color = if (isSelected) SaldaOrange50 else Zinc50,
                                border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) SaldaOrangePrimary else Zinc200),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = d.name,
                                        fontSize = 13.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        color = if (isSelected) SaldaOrangePrimary else Zinc800
                                    )
                                }
                            }
                        }
                    }
                }

                // Сумма
                Column {
                    Text("СУММА НА РУКАХ (₽)", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = amountText,
                        onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Например: 5000", color = Zinc400, fontSize = 14.sp) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = SaldaOrangePrimary,
                            unfocusedBorderColor = Zinc300
                        ),
                        shape = RoundedCornerShape(8.dp)
                    )
                }

                // Причина / заметка
                Column {
                    Text("ПРИЧИНА / ПЕРЕНОС", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = note,
                        onValueChange = { note = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Не успел в гараж, сдача завтра", color = Zinc400, fontSize = 14.sp) },
                        singleLine = false,
                        maxLines = 2,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = SaldaOrangePrimary,
                            unfocusedBorderColor = Zinc300
                        ),
                        shape = RoundedCornerShape(8.dp)
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amt = amountText.toDoubleOrNull()
                    if (selectedDriverId.isBlank()) {
                        errorMessage = "Выберите водителя"
                        return@Button
                    }
                    if (amt == null || amt <= 0.0) {
                        errorMessage = "Укажите корректную сумму больше нуля"
                        return@Button
                    }

                    scope.launch {
                        isSubmitting = true
                        errorMessage = null
                        try {
                            val ok = SaldaApiClient.createDriverCashHold(
                                driverId = selectedDriverId,
                                amount = amt,
                                note = note.trim().ifBlank { "Остаток на руках, перенос на следующий день" },
                                adminId = adminId
                            )
                            if (ok) {
                                onSuccess()
                            } else {
                                errorMessage = "Ошибка сохранения подотчёта"
                            }
                        } catch (e: Exception) {
                            errorMessage = e.message ?: "Ошибка сохранения"
                        } finally {
                            isSubmitting = false
                        }
                    }
                },
                enabled = !isSubmitting,
                colors = ButtonDefaults.buttonColors(containerColor = SaldaOrangePrimary),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text(if (isSubmitting) "Запись..." else "Зафиксировать перенос", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Отмена", color = Zinc600)
            }
        }
    )
}

@Composable
fun DriverCashCollectDialog(
    hold: ru.ancargo66.app.core.model.DriverCashHold,
    adminId: String,
    onDismiss: () -> Unit,
    onSuccess: () -> Unit
) {
    var amountText by remember { mutableStateOf(hold.amount) }
    var note by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("💵 Принять подотчёт в кассу", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Zinc900)
                IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = Zinc500)
                }
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (errorMessage != null) {
                    Surface(
                        color = RedAlert.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = errorMessage ?: "",
                            color = RedAlert,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }

                Surface(
                    color = SaldaOrange50,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = hold.driverName,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Zinc900
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Зафиксировано к сдаче: ${hold.amount} ₽",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = SaldaOrangePrimary
                        )
                        if (hold.note.isNotBlank()) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Причина: ${hold.note}",
                                fontSize = 12.sp,
                                color = Zinc600
                            )
                        }
                    }
                }

                // Сумма сдачи
                Column {
                    Text("ПРИНИМАЕМАЯ СУММА (₽)", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = amountText,
                        onValueChange = { amountText = it.filter { c -> c.isDigit() || c == '.' } },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF21A038),
                            unfocusedBorderColor = Zinc300
                        ),
                        shape = RoundedCornerShape(8.dp)
                    )
                }

                // Комментарий
                Column {
                    Text("КОММЕНТАРИЙ К ИНКАССАЦИИ", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Zinc400)
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = note,
                        onValueChange = { note = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Принято в сейф", color = Zinc400, fontSize = 14.sp) },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0xFF21A038),
                            unfocusedBorderColor = Zinc300
                        ),
                        shape = RoundedCornerShape(8.dp)
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amt = amountText.toDoubleOrNull()
                    if (amt == null || amt <= 0.0) {
                        errorMessage = "Укажите корректную принимаемую сумму"
                        return@Button
                    }

                    scope.launch {
                        isSubmitting = true
                        errorMessage = null
                        try {
                            val ok = SaldaApiClient.collectDriverCashHold(
                                holdId = hold.id,
                                collectedAmount = amt,
                                note = note.trim().ifBlank { null },
                                adminId = adminId
                            )
                            if (ok) {
                                onSuccess()
                            } else {
                                errorMessage = "Ошибка приёма наличных"
                            }
                        } catch (e: Exception) {
                            errorMessage = e.message ?: "Ошибка приёма наличных"
                        } finally {
                            isSubmitting = false
                        }
                    }
                },
                enabled = !isSubmitting,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF21A038)),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text(if (isSubmitting) "Приём..." else "Принять в кассу", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Отмена", color = Zinc600)
            }
        }
    )
}
