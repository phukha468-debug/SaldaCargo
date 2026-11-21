package ru.ancargo66.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.ancargo66.app.core.model.parseTripRouteSheet
import ru.ancargo66.app.ui.theme.*

@Composable
fun TripRouteSheetView(
    driverNote: String?,
    modifier: Modifier = Modifier,
    initialExpanded: Boolean = true
) {
    if (driverNote.isNullOrBlank()) return

    val parsed = remember(driverNote) { parseTripRouteSheet(driverNote) }
    var expanded by remember { mutableStateOf(initialExpanded) }

    // Если нет ни автовыезда, ни маршрутного листа, ни заметки — ничего не показываем
    if (!parsed.isAutoDeparture && !parsed.hasRouteSheet && parsed.cleanNote.isBlank()) return

    val bgColor = if (parsed.isAutoDeparture) Color(0xFFFFFBEB) else Zinc50
    val borderColor = if (parsed.isAutoDeparture) Color(0xFFFDE68A) else Zinc200

    Surface(
        modifier = modifier.fillMaxWidth(),
        color = bgColor,
        shape = RoundedCornerShape(8.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, borderColor)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // 1-я строка (1-Row Priority по AGENTS.md): компактная плашка
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    modifier = Modifier.weight(1f, fill = false),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (parsed.isAutoDeparture) {
                        Surface(
                            color = Color(0xFFFEF3C7),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF59E0B).copy(alpha = 0.4f)),
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = "⚡ Автовыезд",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF92400E),
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(6.dp))
                    }

                    val summaryText = when {
                        parsed.routeSummary.isNotBlank() -> parsed.routeSummary
                        parsed.cleanNote.isNotBlank() -> parsed.cleanNote
                        else -> "Маршрут зафиксирован"
                    }

                    Text(
                        text = summaryText,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = Zinc800,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )

                    if (parsed.totalKm > 0) {
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "· ${parsed.totalKm} км",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = GreenOnline
                        )
                    }
                }

                if (parsed.hasRouteSheet) {
                    Spacer(modifier = Modifier.width(6.dp))
                    Surface(
                        color = Color.Transparent,
                        shape = RoundedCornerShape(4.dp),
                        modifier = Modifier.clickable { expanded = !expanded }
                    ) {
                        Text(
                            text = if (expanded) "▴ Скрыть (${parsed.legs.size})" else "▾ Маршрут (${parsed.legs.size})",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFB45309),
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            // Разворачиваемая таблица маршрутного листа
            AnimatedVisibility(
                visible = parsed.hasRouteSheet && expanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.White)
                        .border(
                            width = 1.dp,
                            color = Color(0xFFFDE68A).copy(alpha = 0.6f)
                        )
                        .padding(6.dp)
                ) {
                    val scrollState = rememberScrollState()

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(scrollState)
                    ) {
                        // Заголовок таблицы
                        Row(
                            modifier = Modifier
                                .background(Zinc100)
                                .padding(vertical = 4.dp, horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("№", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = Zinc500, modifier = Modifier.width(24.dp), textAlign = TextAlign.Center)
                            Text("Рейс", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = Zinc500, modifier = Modifier.width(160.dp))
                            Text("Выезд", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = Zinc500, modifier = Modifier.width(50.dp), textAlign = TextAlign.Center)
                            Text("В пути", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = Zinc500, modifier = Modifier.width(55.dp), textAlign = TextAlign.Center)
                            Text("Прибытие", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = Zinc500, modifier = Modifier.width(60.dp), textAlign = TextAlign.Center)
                            Text("Дата", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = Zinc500, modifier = Modifier.width(50.dp), textAlign = TextAlign.Center)
                            Text("Км", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = Zinc500, modifier = Modifier.width(55.dp), textAlign = TextAlign.End)
                        }

                        HorizontalDivider(color = Zinc200, thickness = 0.5.dp)

                        // Строки плеч
                        parsed.legs.forEach { leg ->
                            Row(
                                modifier = Modifier
                                    .padding(vertical = 4.dp, horizontal = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("${leg.n}", fontSize = 10.sp, color = Zinc400, modifier = Modifier.width(24.dp), textAlign = TextAlign.Center)
                                Text(leg.route, fontSize = 10.sp, fontWeight = FontWeight.Medium, color = Zinc900, modifier = Modifier.width(160.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(leg.dep, fontSize = 10.sp, color = Zinc600, modifier = Modifier.width(50.dp), textAlign = TextAlign.Center)
                                Text(leg.dur, fontSize = 10.sp, color = Zinc500, modifier = Modifier.width(55.dp), textAlign = TextAlign.Center)
                                Text(leg.arr, fontSize = 10.sp, color = Zinc600, modifier = Modifier.width(60.dp), textAlign = TextAlign.Center)
                                Text(leg.date, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Zinc900, modifier = Modifier.width(50.dp), textAlign = TextAlign.Center)
                                Text("${leg.km} км", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = GreenOnline, modifier = Modifier.width(55.dp), textAlign = TextAlign.End)
                            }
                            HorizontalDivider(color = Zinc100, thickness = 0.5.dp)
                        }

                        // Итоговая строка с одометрами
                        Row(
                            modifier = Modifier
                                .background(Zinc50)
                                .padding(vertical = 4.dp, horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            val odoInfo = if (parsed.startOdo != null && parsed.endOdo != null) {
                                "Одометр: ${parsed.startOdo} ➔ ${parsed.endOdo} (пробег ${parsed.totalKm} км)"
                            } else {
                                "Итоговый пробег: ${parsed.totalKm} км"
                            }
                            Text(
                                text = odoInfo,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = Zinc700,
                                modifier = Modifier.width(399.dp)
                            )
                            Text(
                                text = "${parsed.totalKm} км",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = GreenOnline,
                                modifier = Modifier.width(55.dp),
                                textAlign = TextAlign.End
                            )
                        }
                    }

                    // Чистая заметка водителя (если есть реальный текст)
                    if (parsed.cleanNote.isNotBlank() && parsed.cleanNote != parsed.routeSummary) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "💬 Примечание: ${parsed.cleanNote}",
                            fontSize = 10.sp,
                            color = Zinc600,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                        )
                    }
                }
            }
        }
    }
}
