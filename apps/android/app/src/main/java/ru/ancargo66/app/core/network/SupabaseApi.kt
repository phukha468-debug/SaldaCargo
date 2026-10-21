package ru.ancargo66.app.core.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import ru.ancargo66.app.core.model.*
import java.io.IOException
import java.util.UUID

object SupabaseApi {
    private const val SUPABASE_URL = "https://dzwuvbhfqnsxbfbynmgz.supabase.co"
    private const val ANON_KEY = "sb_publishable_oC_0teHEfSPQP29L4OHpxA_-Azkk_AT"

    private val client = OkHttpClient.Builder().build()
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    private fun buildRequest(path: String, method: String = "GET", bodyJson: String? = null): Request {
        val builder = Request.Builder()
            .url("$SUPABASE_URL/rest/v1/$path")
            .addHeader("apikey", ANON_KEY)
            .addHeader("Authorization", "Bearer $ANON_KEY")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "return=representation")

        if (bodyJson != null) {
            val body = bodyJson.toRequestBody("application/json".toMediaType())
            builder.method(method, body)
        } else {
            builder.method(method, null)
        }
        return builder.build()
    }

    suspend fun getUsers(): List<User> = withContext(Dispatchers.IO) {
        val request = buildRequest("users?is_active=eq.true&select=id,name,roles,pin_code,phone,notes,current_asset_id&order=name.asc")
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Failed to load users: ${response.code}")
            val body = response.body?.string() ?: "[]"
            json.decodeFromString<List<User>>(body)
        }
    }

    suspend fun getDriverTrips(driverId: String): List<Trip> = withContext(Dispatchers.IO) {
        val request = buildRequest("trips?driver_id=eq.$driverId&select=*&order=created_at.desc&limit=25")
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Failed to load trips: ${response.code}")
            val body = response.body?.string() ?: "[]"
            json.decodeFromString<List<Trip>>(body)
        }
    }

    suspend fun getAllTrips(statusFilter: String? = null): List<Trip> = withContext(Dispatchers.IO) {
        val filterQuery = when (statusFilter) {
            "review" -> "status=eq.completed&lifecycle_status=eq.draft"
            "active" -> "status=eq.in_progress"
            else -> ""
        }
        val path = if (filterQuery.isNotEmpty()) "trips?$filterQuery&select=*&order=created_at.desc&limit=30"
                   else "trips?select=*&order=created_at.desc&limit=30"

        val request = buildRequest(path)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: "[]"
            json.decodeFromString<List<Trip>>(body)
        }
    }

    suspend fun getTripOrders(tripId: String): List<TripOrder> = withContext(Dispatchers.IO) {
        val request = buildRequest("trip_orders?trip_id=eq.$tripId&select=*&order=created_at.asc")
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: "[]"
            json.decodeFromString<List<TripOrder>>(body)
        }
    }

    suspend fun getTripExpenses(tripId: String): List<TripExpense> = withContext(Dispatchers.IO) {
        val request = buildRequest("trip_expenses?trip_id=eq.$tripId&select=*&order=created_at.asc")
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: "[]"
            json.decodeFromString<List<TripExpense>>(body)
        }
    }

    suspend fun getAssets(): List<Asset> = withContext(Dispatchers.IO) {
        val request = buildRequest("assets?status=eq.active&select=id,reg_number,short_name,odometer_current&order=short_name.asc")
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Failed to load assets: ${response.code}")
            val body = response.body?.string() ?: "[]"
            json.decodeFromString<List<Asset>>(body)
        }
    }

    suspend fun createTrip(assetId: String, driverId: String, startOdometer: Long, tripType: String = "local"): Trip? = withContext(Dispatchers.IO) {
        val body = """
            {
                "asset_id": "$assetId",
                "driver_id": "$driverId",
                "odometer_start": $startOdometer,
                "trip_type": "$tripType",
                "status": "in_progress",
                "started_at": "${java.time.Instant.now()}"
            }
        """.trimIndent()
        val request = buildRequest("trips", method = "POST", bodyJson = body)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext null
            val respBody = response.body?.string() ?: "[]"
            val list = json.decodeFromString<List<Trip>>(respBody)
            list.firstOrNull()
        }
    }

    suspend fun addTripOrder(tripId: String, amount: Double, description: String, direction: String = "Верхняя Салда"): Boolean = withContext(Dispatchers.IO) {
        val body = """
            {
                "trip_id": "$tripId",
                "amount": $amount,
                "driver_pay": ${amount * 0.25},
                "direction": "$direction",
                "description": "$description",
                "idempotency_key": "${UUID.randomUUID()}"
            }
        """.trimIndent()
        val request = buildRequest("trip_orders", method = "POST", bodyJson = body)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun addTripExpense(tripId: String, amount: Double, category: String, note: String): Boolean = withContext(Dispatchers.IO) {
        val body = """
            {
                "trip_id": "$tripId",
                "amount": $amount,
                "category": "$category",
                "note": "$note"
            }
        """.trimIndent()
        val request = buildRequest("trip_expenses", method = "POST", bodyJson = body)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun finishTrip(tripId: String, endOdometer: Long, note: String?): Boolean = withContext(Dispatchers.IO) {
        val patchJson = """
            {
                "odometer_end": $endOdometer,
                "status": "completed",
                "lifecycle_status": "draft",
                "driver_note": ${if (note != null) "\"$note\"" else "null"},
                "ended_at": "${java.time.Instant.now()}"
            }
        """.trimIndent()
        val request = buildRequest("trips?id=eq.$tripId", method = "PATCH", bodyJson = patchJson)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun approveTrip(tripId: String): Boolean = withContext(Dispatchers.IO) {
        val patchJson = """
            {
                "lifecycle_status": "approved",
                "approved_at": "${java.time.Instant.now()}"
            }
        """.trimIndent()
        val request = buildRequest("trips?id=eq.$tripId", method = "PATCH", bodyJson = patchJson)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun updateDriverAsset(userId: String, assetId: String): Boolean = withContext(Dispatchers.IO) {
        val patchJson = "{\"current_asset_id\": \"$assetId\"}"
        val request = buildRequest("users?id=eq.$userId", method = "PATCH", bodyJson = patchJson)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun updateLoaderShift(userId: String, online: Boolean, address: String, hasCar: Boolean): Boolean = withContext(Dispatchers.IO) {
        val state = LoaderShiftState(
            online = online,
            address = address,
            car = hasCar,
            updatedAt = System.currentTimeMillis()
        )
        val stateJson = json.encodeToString(state)
        val escaped = stateJson.replace("\"", "\\\"")
        val patchBody = "{\"notes\": \"$escaped\"}"
        val request = buildRequest("users?id=eq.$userId", method = "PATCH", bodyJson = patchBody)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun getLoaders(): List<Pair<User, LoaderShiftState>> = withContext(Dispatchers.IO) {
        val request = buildRequest("users?is_active=eq.true&roles=cs.{loader}&select=id,name,phone,notes,roles&order=name.asc")
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: "[]"
            val users = json.decodeFromString<List<User>>(body)
            users.map { user ->
                val state = try {
                    if (!user.notes.isNullOrBlank()) {
                        json.decodeFromString<LoaderShiftState>(user.notes)
                    } else {
                        LoaderShiftState(online = false)
                    }
                } catch (_: Exception) {
                    LoaderShiftState(online = false)
                }
                user to state
            }
        }
    }

    suspend fun getMechanicOrders(mechanicId: String): List<ServiceOrder> = withContext(Dispatchers.IO) {
        val request = buildRequest("service_orders?select=*&order=created_at.desc&limit=20")
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Failed to load orders: ${response.code}")
            val body = response.body?.string() ?: "[]"
            json.decodeFromString<List<ServiceOrder>>(body)
        }
    }
}
