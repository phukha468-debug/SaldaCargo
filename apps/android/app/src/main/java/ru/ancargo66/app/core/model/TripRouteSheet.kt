package ru.ancargo66.app.core.model

import kotlinx.serialization.Serializable
import ru.ancargo66.app.core.network.SaldaApiClient

@Serializable
data class TripRouteLeg(
    val n: Int = 1,
    val from: String = "",
    val to: String = "",
    val route: String = "",
    val dep: String = "",
    val dur: String = "",
    val arr: String = "",
    val date: String = "",
    val km: Long = 0L,
    val startOdo: Long? = null,
    val endOdo: Long? = null
)

data class ParsedTripRouteSheet(
    val isAutoDeparture: Boolean,
    val hasRouteSheet: Boolean,
    val legs: List<TripRouteLeg>,
    val totalKm: Long,
    val startOdo: Long?,
    val endOdo: Long?,
    val routeSummary: String,
    val cleanNote: String
)

fun parseTripRouteSheet(note: String?): ParsedTripRouteSheet {
    val raw = note?.trim() ?: ""
    val isAutoDeparture = raw.contains("Автомашина выехала без заявки") ||
            raw.contains("⚡ Автовыезд") ||
            raw.contains("[АВТОВЫЕЗД]") ||
            raw.contains("Авто-старт по геозоне Wialon")

    var legs = emptyList<TripRouteLeg>()
    var totalKm = 0L
    var startOdo: Long? = null
    var endOdo: Long? = null
    var routeSummary = ""

    val legsRegex = Regex("""\[ROUTE_LEGS:(\[.*?\])\]""", RegexOption.DOT_MATCHES_ALL)
    val match = legsRegex.find(raw)
    val jsonPayload = match?.groupValues?.getOrNull(1)
        ?: Regex("""\[ROUTE_LEGS:(.+?)\]\]""", RegexOption.DOT_MATCHES_ALL).find(raw)?.groupValues?.getOrNull(1)

    if (!jsonPayload.isNullOrBlank()) {
        try {
            legs = SaldaApiClient.json.decodeFromString<List<TripRouteLeg>>(jsonPayload)
            if (legs.isNotEmpty()) {
                totalKm = legs.sumOf { it.km }
                startOdo = legs.firstOrNull()?.startOdo
                endOdo = legs.lastOrNull()?.endOdo

                val locs = mutableListOf<String>()
                legs.forEach { leg ->
                    if (leg.from.isNotBlank() && !locs.contains(leg.from)) locs.add(leg.from)
                    if (leg.to.isNotBlank() && !locs.contains(leg.to)) locs.add(leg.to)
                }
                routeSummary = locs.joinToString(" ➔ ")
            }
        } catch (_: Exception) {}
    }

    var cleanNote = raw
        .replace(Regex("""\[ROUTE_LEGS:\[.*?\]\]""", RegexOption.DOT_MATCHES_ALL), "")
        .replace(Regex("""\[ROUTE_LEGS:.*?\]\]""", RegexOption.DOT_MATCHES_ALL), "")
        .replace(Regex("""\[ROUTE_LEGS:.*?\]""", RegexOption.DOT_MATCHES_ALL), "")
        .replace(Regex("""⚠️\s*Внимание:\s*Автомашина выехала без заявки по геозоне Wialon!.*?""", RegexOption.IGNORE_CASE), "")
        .replace(Regex("""\[CARRYOVER:.*?\]"""), "")
        .replace(Regex("""\[CASH_NOT_COLLECTED.*?\]"""), "")
        .replace(Regex("""\[НЕ СДАНО В КАССУ.*?\]"""), "")
        .replace(Regex("""\[ПЕРЕНОС НАЛИЧНЫХ.*?\]"""), "")
        .replace(Regex("""\[WIALON_STATE:.*?\]"""), "")
        .replace(Regex("""\[WIALON_AUDIT:.*?\]"""), "")
        .replace(Regex("""\[Шайтанка.*?\]"""), "")
        .replace(Regex("""\[.*?➔.*?\]"""), "")
        .replace(Regex("""⚡\s*Автовыезд"""), "")
        .replace(Regex("""\[АВТОВЫЕЗД\]"""), "")
        .trim()

    cleanNote = cleanNote.replace(Regex("""\n{2,}"""), "\n").trim()

    return ParsedTripRouteSheet(
        isAutoDeparture = isAutoDeparture,
        hasRouteSheet = legs.isNotEmpty(),
        legs = legs,
        totalKm = totalKm,
        startOdo = startOdo,
        endOdo = endOdo,
        routeSummary = routeSummary,
        cleanNote = cleanNote
    )
}

fun isMeaningfulDriverComment(comment: String?): Boolean {
    if (comment.isNullOrBlank()) return false
    val trimmed = comment.trim()
    val lower = trimmed.lowercase()
    if (lower.startsWith("керн геостройиндустрия")) return false
    if (lower.startsWith("заявка ооо \"геостройиндустрия\"")) return false
    if (lower.startsWith("заявка ооо «геостройиндустрия»")) return false
    if (Regex("""^заявка\s+.*?:\s+.*?\(.*?км\)$""", RegexOption.IGNORE_CASE).matches(trimmed)) return false
    return true
}
