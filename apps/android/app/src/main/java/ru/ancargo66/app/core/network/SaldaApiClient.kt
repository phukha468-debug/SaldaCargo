package ru.ancargo66.app.core.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.ConnectionPool
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import ru.ancargo66.app.core.model.*
import java.io.IOException
import java.util.UUID
import java.util.concurrent.TimeUnit

object SaldaApiClient {
    private const val BASE_URL = "https://app.tk501.ru"

    private val client = OkHttpClient.Builder()
        .connectionPool(ConnectionPool(10, 5, TimeUnit.MINUTES))
        .retryOnConnectionFailure(true)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private const val CACHE_TTL_MS = 60_000L // 1 минута

    // Быстрый in-memory кэш для справочников и данных
    private var cachedAssets: Pair<Long, List<Asset>>? = null
    private var cachedCategories: Pair<Long, List<ExpenseCategory>>? = null
    private var cachedCounterparties: Pair<Long, List<Counterparty>>? = null
    private var cachedLoaders: Pair<Long, List<User>>? = null
    var cachedDriverSummary: Pair<Long, DriverSummary>? = null

    fun getCachedAssets(): List<Asset>? = cachedAssets?.second
    fun getCachedSummary(): DriverSummary? = cachedDriverSummary?.second
    fun invalidateSummary() { cachedDriverSummary = null }

    val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    private fun buildRequest(
        path: String,
        method: String = "GET",
        bodyJson: String? = null,
        userId: String? = null
    ): Request {
        val url = if (path.startsWith("http")) path else "$BASE_URL$path"
        val builder = Request.Builder()
            .url(url)
            .addHeader("Content-Type", "application/json")
            .addHeader("Accept", "application/json")

        if (userId != null) {
            builder.addHeader("x-salda-user-id", userId)
            builder.addHeader("Cookie", "salda_user_id=$userId")
        }

        if (bodyJson != null) {
            val body = bodyJson.toRequestBody("application/json".toMediaType())
            builder.method(method, body)
        } else if (method == "POST" || method == "PATCH") {
            val body = "".toRequestBody("application/json".toMediaType())
            builder.method(method, body)
        } else {
            builder.method(method, null)
        }
        return builder.build()
    }

    // ── Пользователи и авторизация ──────────────────────────────────────────

    suspend fun getUsers(role: String? = null): List<User> = withContext(Dispatchers.IO) {
        val path = if (role != null) "/api/users/public?role=$role" else "/api/users/public"
        val request = buildRequest(path)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Не удалось загрузить сотрудников: ${response.code}")
            val body = response.body?.string() ?: "[]"
            json.decodeFromString<List<User>>(body)
        }
    }

    suspend fun verifyPin(userId: String, pin: String): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("user_id", userId)
            put("pin", pin)
        }.toString()
        val request = buildRequest("/api/auth/verify-pin", method = "POST", bodyJson = body)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    // ── Модуль водителя ─────────────────────────────────────────────────────

    suspend fun getDriverSummary(driverId: String, forceRefresh: Boolean = false): DriverSummary = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        if (!forceRefresh) {
            cachedDriverSummary?.let { (timestamp, data) ->
                if (now - timestamp < 15_000L) return@withContext data
            }
        }
        val request = buildRequest("/api/driver/summary", userId = driverId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Не удалось загрузить сводку: ${response.code}")
            val body = response.body?.string() ?: "{}"
            val res = json.decodeFromString<DriverSummary>(body)
            cachedDriverSummary = Pair(now, res)
            res
        }
    }

    suspend fun getDriverTrips(driverId: String): List<TripSummaryItem> = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/driver/trips", userId = driverId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: "[]"
            json.decodeFromString<List<TripSummaryItem>>(body)
        }
    }

    suspend fun getDriverAssets(driverId: String? = null, forceRefresh: Boolean = false): List<Asset> = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        if (!forceRefresh) {
            cachedAssets?.let { (timestamp, data) ->
                if (now - timestamp < CACHE_TTL_MS) return@withContext data
            }
        }
        val request = buildRequest("/api/driver/assets", userId = driverId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Не удалось загрузить авто: ${response.code}")
            val body = response.body?.string() ?: "[]"
            val res = json.decodeFromString<List<Asset>>(body)
            cachedAssets = Pair(now, res)
            res
        }
    }

    suspend fun switchDriverAsset(driverId: String, assetId: String): Boolean = withContext(Dispatchers.IO) {
        cachedDriverSummary = null
        val body = buildJsonObject {
            put("asset_id", assetId)
        }.toString()
        val request = buildRequest("/api/driver/profile", method = "PATCH", bodyJson = body, userId = driverId)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun startTrip(driverId: String, assetId: String, odometerStart: Long, isPrr: Boolean = false): TripDetail = withContext(Dispatchers.IO) {
        cachedDriverSummary = null
        val body = buildJsonObject {
            put("asset_id", assetId)
            put("odometer_start", odometerStart)
            put("trip_type", if (isPrr) "loaders_only" else "local")
            put("idempotency_key", UUID.randomUUID().toString())
        }.toString()
        val request = buildRequest("/api/trips", method = "POST", bodyJson = body, userId = driverId)
        client.newCall(request).execute().use { response ->
            val resBody = response.body?.string() ?: "{}"
            if (!response.isSuccessful) throw IOException("Ошибка создания рейса: $resBody")
            json.decodeFromString<TripDetail>(resBody)
        }
    }

    // ── Детализация и управление рейсом ─────────────────────────────────────

    suspend fun getTripDetail(tripId: String, userId: String? = null): TripDetail = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/trips/$tripId", userId = userId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Рейс не найден: ${response.code}")
            val body = response.body?.string() ?: "{}"
            json.decodeFromString<TripDetail>(body)
        }
    }

    suspend fun finishTrip(
        tripId: String,
        endOdometer: Long?,
        driverNote: String?,
        userId: String? = null
    ): Result<TripDetail> = withContext(Dispatchers.IO) {
        cachedDriverSummary = null
        val body = buildJsonObject {
            if (endOdometer != null) put("odometer_end", endOdometer)
            if (driverNote != null) put("driver_note", driverNote)
        }.toString()
        val request = buildRequest("/api/trips/$tripId/finish", method = "POST", bodyJson = body, userId = userId)
        try {
            client.newCall(request).execute().use { response ->
                val resBody = response.body?.string() ?: "{}"
                if (response.isSuccessful) {
                    Result.success(json.decodeFromString<TripDetail>(resBody))
                } else {
                    Result.failure(IOException("Ошибка сервера: $resBody"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun addTripOrder(
        tripId: String,
        amount: Double,
        driverPay: Double,
        description: String?,
        direction: String = "local",
        paymentMethod: String = "cash",
        counterpartyId: String? = null,
        driverCarPay: Double = 0.0,
        driverLoaderPay: Double = 0.0,
        isDriverLoader: Boolean = false,
        loadersData: List<LoaderPayItem> = emptyList(),
        userId: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        cachedDriverSummary = null
        val loadersArray = kotlinx.serialization.json.buildJsonArray {
            loadersData.forEach { l ->
                add(buildJsonObject {
                    put("id", l.id ?: "")
                    put("name", l.name ?: "Грузчик")
                    put("pay", l.pay)
                })
            }
        }
        val body = buildJsonObject {
            put("amount", amount.toString())
            put("driver_pay", driverPay.toString())
            put("driver_car_pay", driverCarPay.toString())
            put("driver_loader_pay", driverLoaderPay.toString())
            put("is_driver_loader", isDriverLoader)
            put("loaders_data", loadersArray)
            put("direction", direction)
            put("payment_method", paymentMethod)
            put("idempotency_key", UUID.randomUUID().toString())
            if (description != null) put("description", description)
            if (counterpartyId != null) put("counterparty_id", counterpartyId)
        }.toString()

        val request = buildRequest("/api/trips/$tripId/orders", method = "POST", bodyJson = body, userId = userId)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun cancelTripOrder(tripId: String, orderId: String, userId: String? = null): Boolean = withContext(Dispatchers.IO) {
        cachedDriverSummary = null
        val body = buildJsonObject { put("action", "cancel") }.toString()
        val request = buildRequest("/api/trips/$tripId/orders/$orderId", method = "PATCH", bodyJson = body, userId = userId)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun deleteTrip(tripId: String, userId: String? = null): Boolean = withContext(Dispatchers.IO) {
        cachedDriverSummary = null
        val request = buildRequest("/api/trips/$tripId", method = "DELETE", userId = userId)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun addTripExpense(
        tripId: String,
        categoryId: String,
        amount: Double,
        paymentMethod: String = "fuel_card",
        description: String? = null,
        userId: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        cachedDriverSummary = null
        val body = buildJsonObject {
            put("category_id", categoryId)
            put("amount", amount.toString())
            put("payment_method", paymentMethod)
            put("idempotency_key", UUID.randomUUID().toString())
            if (description != null) put("description", description)
        }.toString()

        val request = buildRequest("/api/trips/$tripId/expenses", method = "POST", bodyJson = body, userId = userId)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun getExpenseCategories(userId: String? = null, forceRefresh: Boolean = false): List<ExpenseCategory> = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        if (!forceRefresh) {
            cachedCategories?.let { (timestamp, data) ->
                if (now - timestamp < CACHE_TTL_MS * 5) return@withContext data
            }
        }
        val request = buildRequest("/api/driver/categories", userId = userId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: "[]"
            val res = json.decodeFromString<List<ExpenseCategory>>(body)
            cachedCategories = Pair(now, res)
            res
        }
    }

    suspend fun getCounterparties(userId: String? = null, forceRefresh: Boolean = false): List<Counterparty> = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        if (!forceRefresh) {
            cachedCounterparties?.let { (timestamp, data) ->
                if (now - timestamp < CACHE_TTL_MS) return@withContext data
            }
        }
        val request = buildRequest("/api/driver/counterparties", userId = userId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: "[]"
            val res = json.decodeFromString<List<Counterparty>>(body)
            cachedCounterparties = Pair(now, res)
            res
        }
    }

    suspend fun createPrrOrder(
        counterpartyId: String,
        amount: Double,
        paymentMethod: String = "cash",
        loaders: List<LoaderPayItem>,
        description: String? = null,
        userId: String
    ): Boolean = withContext(Dispatchers.IO) {
        cachedDriverSummary = null
        val loadersArray = kotlinx.serialization.json.buildJsonArray {
            loaders.forEach { l ->
                add(buildJsonObject {
                    put("id", l.id ?: "")
                    put("name", l.name ?: "Грузчик")
                    put("pay", l.pay)
                })
            }
        }
        val body = buildJsonObject {
            put("counterparty_id", counterpartyId)
            put("amount", amount)
            put("payment_method", paymentMethod)
            put("loaders", loadersArray)
            if (description != null) put("description", description)
            put("user_id", userId)
        }.toString()

        val request = buildRequest("/api/trips/prr", method = "POST", bodyJson = body, userId = userId)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun getDriverFinance(driverId: String): DriverFinanceData = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/driver/finance", userId = driverId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext DriverFinanceData()
            val body = response.body?.string() ?: "{}"
            json.decodeFromString<DriverFinanceData>(body)
        }
    }

    suspend fun confirmEmployeePayroll(userId: String, ids: List<String>? = null): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("action", "confirm")
            if (ids != null && ids.isNotEmpty()) {
                put("ids", kotlinx.serialization.json.buildJsonArray {
                    ids.forEach { add(JsonPrimitive(it)) }
                })
            }
        }.toString()
        val request = buildRequest("/api/employee/payroll", method = "PATCH", bodyJson = body, userId = userId)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun rejectEmployeePayroll(userId: String, id: String): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("action", "reject")
            put("id", id)
        }.toString()
        val request = buildRequest("/api/employee/payroll", method = "PATCH", bodyJson = body, userId = userId)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    // ── Модуль диспетчера / руководства ──────────────────────────────────────

    suspend fun getAdminSummary(adminId: String? = null): AdminSummary = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/admin/summary", userId = adminId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext AdminSummary()
            val body = response.body?.string() ?: "{}"
            json.decodeFromString<AdminSummary>(body)
        }
    }

    suspend fun getAdminTrips(filter: String = "review", adminId: String? = null): List<TripDetail> = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/admin/trips?filter=$filter", userId = adminId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: "[]"
            json.decodeFromString<List<TripDetail>>(body)
        }
    }

    suspend fun approveTrip(tripId: String, adminId: String? = null): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject { put("action", "approve") }.toString()
        val request = buildRequest("/api/admin/trips/$tripId", method = "PATCH", bodyJson = body, userId = adminId)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun getWallets(userId: String? = null): List<WalletBalance> = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/wallets", userId = userId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: "{}"
            // /api/wallets returns an object with { bank, cash, fuel_card, garage }
            try {
                val element = json.parseToJsonElement(body)
                val list = mutableListOf<WalletBalance>()
                if (element is kotlinx.serialization.json.JsonObject) {
                    for ((k, v) in element) {
                        if (v is kotlinx.serialization.json.JsonObject) {
                            val id = v["id"]?.let { (it as? JsonPrimitive)?.content } ?: k
                            val name = v["name"]?.let { (it as? JsonPrimitive)?.content } ?: k
                            val balanceStr = v["balance"]?.let { (it as? JsonPrimitive)?.content } ?: "0"
                            val balance = balanceStr.toDoubleOrNull() ?: 0.0
                            list.add(WalletBalance(id = id, name = name, type = k, balance = balance))
                        }
                    }
                }
                list
            } catch (_: Exception) {
                emptyList()
            }
        }
    }

    // ── Модуль грузчиков ────────────────────────────────────────────────────

    suspend fun getLoaders(forceRefresh: Boolean = false): List<User> = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        if (!forceRefresh) {
            cachedLoaders?.let { (timestamp, data) ->
                if (now - timestamp < CACHE_TTL_MS) return@withContext data
            }
        }
        val request = buildRequest("/api/driver/loaders")
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: "[]"
            val res = json.decodeFromString<List<User>>(body)
            cachedLoaders = Pair(now, res)
            res
        }
    }
}
