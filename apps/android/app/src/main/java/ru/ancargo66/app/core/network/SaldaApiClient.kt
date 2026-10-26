package ru.ancargo66.app.core.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.addJsonObject
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

    suspend fun setPin(userId: String, pin: String): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("user_id", userId)
            put("pin", pin)
        }.toString()
        val request = buildRequest("/api/auth/set-pin", method = "POST", bodyJson = body)
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
        val ok = try {
            val request = buildRequest("/api/trips/$tripId", method = "DELETE", userId = userId)
            client.newCall(request).execute().use { it.isSuccessful }
        } catch (_: Exception) { false }

        if (ok) true else {
            try {
                val adminReq = buildRequest("/api/admin/trips/$tripId", method = "DELETE", userId = userId)
                client.newCall(adminReq).execute().use { it.isSuccessful }
            } catch (_: Exception) { false }
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

    suspend fun returnTrip(tripId: String, adminId: String? = null): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject { put("action", "return") }.toString()
        val request = buildRequest("/api/admin/trips/$tripId", method = "PATCH", bodyJson = body, userId = adminId)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun deleteAdminTrip(tripId: String, adminId: String? = null): Boolean = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/admin/trips/$tripId", method = "DELETE", userId = adminId)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun addAdminTransaction(
        direction: String,
        categoryId: String,
        amount: Double,
        paymentMethod: String = "cash",
        description: String? = null,
        adminId: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("direction", direction)
            put("category_id", categoryId)
            put("amount", amount.toString())
            put("payment_method", paymentMethod)
            if (!description.isNullOrBlank()) put("description", description)
        }.toString()
        val request = buildRequest("/api/admin/transactions", method = "POST", bodyJson = body, userId = adminId)
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

    suspend fun getLoaders(forceRefresh: Boolean = false, userId: String? = null): List<User> = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        if (!forceRefresh) {
            cachedLoaders?.let { (timestamp, data) ->
                if (now - timestamp < CACHE_TTL_MS && data.isNotEmpty()) return@withContext data
            }
        }
        val fetched = try {
            val request = buildRequest("/api/driver/loaders", userId = userId)
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "[]"
                    json.decodeFromString<List<User>>(body)
                } else {
                    emptyList()
                }
            }
        } catch (_: Exception) {
            emptyList()
        }

        val result = if (fetched.isNotEmpty()) fetched else {
            try {
                getUsers(role = "loader")
            } catch (_: Exception) {
                emptyList()
            }
        }

        if (result.isNotEmpty()) {
            cachedLoaders = Pair(now, result)
        }
        result
    }

    // ── Модуль зарплат и штата ───────────────────────────────────────────────

    suspend fun getAdminPayroll(year: Int, month: Int, adminId: String? = null): List<PayrollEmployee> = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/admin/payroll?year=$year&month=$month", userId = adminId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: "[]"
            try {
                json.decodeFromString<List<PayrollEmployee>>(body)
            } catch (_: Exception) {
                emptyList()
            }
        }
    }

    suspend fun getStaffSettleDetails(userId: String, year: Int? = null, month: Int? = null, adminId: String? = null): StaffSettleDetails? = withContext(Dispatchers.IO) {
        val path = if (year != null && month != null) {
            "/api/admin/staff-settle?user_id=$userId&year=$year&month=$month"
        } else {
            "/api/admin/staff-settle?user_id=$userId"
        }
        val request = buildRequest(path, userId = adminId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext null
            val body = response.body?.string() ?: "{}"
            try {
                json.decodeFromString<StaffSettleDetails>(body)
            } catch (_: Exception) {
                null
            }
        }
    }

    suspend fun settleStaffPayroll(
        userId: String,
        amount: Double,
        fromWalletId: String,
        offsetAmount: Double = 0.0,
        adminId: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("user_id", userId)
            put("partial_amount", amount.toString())
            put("from_wallet_id", fromWalletId)
            put("partial_offset", offsetAmount.toString())
            put("idempotency_key", UUID.randomUUID().toString())
        }.toString()
        val request = buildRequest("/api/admin/staff-settle", method = "POST", bodyJson = body, userId = adminId)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    suspend fun confirmStaffUnconfirmed(userId: String, adminId: String? = null): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("action", "confirm_unconfirmed")
            put("user_id", userId)
        }.toString()
        val request = buildRequest("/api/admin/staff-settle", method = "POST", bodyJson = body, userId = adminId)
        client.newCall(request).execute().use { response ->
            response.isSuccessful
        }
    }

    // ── Модуль механика (СТО / Гараж) ────────────────────────────────────────

    suspend fun getMechanicOrders(mechanicId: String): List<MechanicOrder> = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/mechanic/orders?mechanic_id=$mechanicId", userId = mechanicId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: "[]"
            try {
                json.decodeFromString<List<MechanicOrder>>(body)
            } catch (_: Exception) {
                emptyList()
            }
        }
    }

    suspend fun getMechanicOrderDetail(orderId: String, mechanicId: String): MechanicOrder? = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/mechanic/orders/$orderId", userId = mechanicId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext null
            val body = response.body?.string() ?: "{}"
            try {
                json.decodeFromString<MechanicOrder>(body)
            } catch (_: Exception) {
                null
            }
        }
    }

    suspend fun getMechanicSalary(mechanicId: String, year: Int, month: Int): MechanicSalaryData = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/mechanic/salary?mechanic_id=$mechanicId&year=$year&month=$month", userId = mechanicId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext MechanicSalaryData()
            val body = response.body?.string() ?: "{}"
            try {
                json.decodeFromString<MechanicSalaryData>(body)
            } catch (_: Exception) {
                MechanicSalaryData()
            }
        }
    }

    suspend fun createMechanicOrder(
        mechanicId: String,
        orderDate: String,
        machineType: String,
        assetId: String? = null,
        clientVehicleModel: String? = null,
        clientVehicleReg: String? = null,
        odometer: Long? = null,
        works: List<MechanicWorkDraftInput>,
        partsProvidedByService: Boolean,
        parts: List<MechanicPartDraftInput>,
        mechanicNote: String? = null,
        submitImmediately: Boolean = true,
        startedAt: String? = null,
        completedAt: String? = null
    ): Result<MechanicOrder> = withContext(Dispatchers.IO) {
        val worksArray = kotlinx.serialization.json.buildJsonArray {
            works.forEach { w ->
                add(buildJsonObject {
                    put("name", w.name)
                    put("minutes", w.minutes)
                })
            }
        }
        val partsArray = kotlinx.serialization.json.buildJsonArray {
            parts.forEach { p ->
                add(buildJsonObject {
                    put("name", p.name)
                    put("quantity", p.quantity)
                    put("unit", p.unit)
                })
            }
        }
        val body = buildJsonObject {
            put("mechanic_id", mechanicId)
            put("order_date", orderDate)
            put("started_at", startedAt ?: orderDate)
            put("completed_at", completedAt ?: orderDate)
            put("machine_type", machineType)
            if (!assetId.isNullOrBlank()) put("asset_id", assetId)
            if (!clientVehicleModel.isNullOrBlank()) {
                put("client_vehicle_model", clientVehicleModel)
                put("client_vehicle_brand", clientVehicleModel)
            }
            if (!clientVehicleReg.isNullOrBlank()) put("client_vehicle_reg", clientVehicleReg)
            if (odometer != null && odometer > 0L) put("odometer", odometer)
            put("works", worksArray)
            put("parts_provided_by_service", partsProvidedByService)
            put("parts", partsArray)
            if (!mechanicNote.isNullOrBlank()) put("mechanic_note", mechanicNote)
            put("submit_immediately", submitImmediately)
        }.toString()

        val request = buildRequest("/api/mechanic/orders", method = "POST", bodyJson = body, userId = mechanicId)
        try {
            client.newCall(request).execute().use { response ->
                val resBody = response.body?.string() ?: "{}"
                if (response.isSuccessful) {
                    Result.success(json.decodeFromString<MechanicOrder>(resBody))
                } else {
                    val errMsg = try {
                        val el = json.parseToJsonElement(resBody) as? JsonObject
                        (el?.get("error") as? JsonPrimitive)?.content ?: "Ошибка сохранения наряда"
                    } catch (_: Exception) {
                        "Ошибка сохранения наряда (${response.code})"
                    }
                    Result.failure(IOException(errMsg))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun addMechanicOrderWork(
        orderId: String,
        name: String,
        minutes: Int,
        mechanicId: String
    ): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("mechanic_id", mechanicId)
            put("custom_work_name", name)
            put("minutes", minutes)
            put("norm_minutes", minutes)
            put("actual_minutes", minutes)
            put("completed", true)
        }.toString()
        val request = buildRequest("/api/mechanic/orders/$orderId/works", method = "POST", bodyJson = body, userId = mechanicId)
        client.newCall(request).execute().use { it.isSuccessful }
    }

    suspend fun deleteMechanicOrderWork(
        orderId: String,
        workId: String,
        mechanicId: String
    ): Boolean = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/mechanic/orders/$orderId/works?work_id=$workId", method = "DELETE", userId = mechanicId)
        client.newCall(request).execute().use { it.isSuccessful }
    }

    suspend fun addMechanicOrderPart(
        orderId: String,
        name: String,
        quantity: Double,
        unit: String = "шт",
        mechanicId: String
    ): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("mechanic_id", mechanicId)
            put("custom_part_name", name)
            put("quantity", quantity)
            put("unit", unit)
        }.toString()
        val request = buildRequest("/api/mechanic/orders/$orderId/parts", method = "POST", bodyJson = body, userId = mechanicId)
        client.newCall(request).execute().use { it.isSuccessful }
    }

    suspend fun deleteMechanicOrderPart(
        orderId: String,
        partItemId: String,
        mechanicId: String
    ): Boolean = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/mechanic/orders/$orderId/parts?part_item_id=$partItemId", method = "DELETE", userId = mechanicId)
        client.newCall(request).execute().use { it.isSuccessful }
    }

    suspend fun updateMechanicOrder(
        orderId: String,
        status: String? = null,
        odometerEnd: Long? = null,
        partsProvidedByService: Boolean? = null,
        mechanicId: String
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            if (status != null) put("status", status)
            if (odometerEnd != null && odometerEnd > 0L) put("odometer_end", odometerEnd)
            if (partsProvidedByService != null) put("parts_provided_by_service", partsProvidedByService)
        }.toString()
        val request = buildRequest("/api/mechanic/orders/$orderId", method = "PATCH", bodyJson = body, userId = mechanicId)
        try {
            client.newCall(request).execute().use { response ->
                val resBody = response.body?.string() ?: "{}"
                if (response.isSuccessful) {
                    Result.success(true)
                } else {
                    val errMsg = try {
                        val el = json.parseToJsonElement(resBody) as? JsonObject
                        (el?.get("error") as? JsonPrimitive)?.content ?: "Ошибка обновления"
                    } catch (_: Exception) {
                        "Ошибка обновления (${response.code})"
                    }
                    Result.failure(IOException(errMsg))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ── Ревью заказ-нарядов Гаража (для руководителя/диспетчера) ─────────────

    suspend fun getAdminServiceOrders(
        filter: String = "review",
        adminId: String? = null
    ): List<MechanicOrder> = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/admin/service-orders?filter=$filter", userId = adminId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: "[]"
            try {
                json.decodeFromString<List<MechanicOrder>>(body)
            } catch (_: Exception) {
                emptyList()
            }
        }
    }

    suspend fun approveAdminServiceOrder(
        orderId: String,
        adminId: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("action", "approve")
            if (!adminId.isNullOrBlank()) put("admin_id", adminId)
        }.toString()
        val request = buildRequest("/api/admin/service-orders/$orderId", method = "PATCH", bodyJson = body, userId = adminId)
        client.newCall(request).execute().use { it.isSuccessful }
    }

    suspend fun returnAdminServiceOrder(
        orderId: String,
        adminId: String? = null,
        note: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("action", "return")
            if (!adminId.isNullOrBlank()) put("admin_id", adminId)
            if (!note.isNullOrBlank()) put("admin_note", note)
        }.toString()
        val request = buildRequest("/api/admin/service-orders/$orderId", method = "PATCH", bodyJson = body, userId = adminId)
        client.newCall(request).execute().use { it.isSuccessful }
    }

    suspend fun deleteAdminServiceOrder(
        orderId: String,
        adminId: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/admin/service-orders/$orderId", method = "DELETE", userId = adminId)
        client.newCall(request).execute().use { it.isSuccessful }
    }

    suspend fun updateLoaderShift(
        userId: String,
        isOnline: Boolean,
        address: String,
        hasTransport: Boolean
    ): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("user_id", userId)
            put("is_online", isOnline)
            put("address", address)
            put("has_transport", hasTransport)
        }.toString()
        val request = buildRequest("/api/loader/shift", method = "POST", bodyJson = body, userId = userId)
        client.newCall(request).execute().use { it.isSuccessful }
    }

    suspend fun updateAdminServiceOrder(
        orderId: String,
        adminId: String? = null,
        works: List<Pair<String, Long>>,
        parts: List<Triple<String, Double, Double>>,
        odometer: Long? = null,
        mechanicPay: Double? = null,
        vehicleModel: String? = null,
        vehicleReg: String? = null,
        startedAt: String? = null,
        completedAt: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("action", "edit_order")
            if (!adminId.isNullOrBlank()) put("admin_id", adminId)
            if (!startedAt.isNullOrBlank()) put("started_at", startedAt)
            if (!completedAt.isNullOrBlank()) put("completed_at", completedAt)
            if (odometer != null) put("odometer_end", odometer)
            if (mechanicPay != null) put("mechanic_pay", mechanicPay)
            if (!vehicleModel.isNullOrBlank()) put("client_vehicle_model", vehicleModel)
            if (!vehicleReg.isNullOrBlank()) put("client_vehicle_reg", vehicleReg)
            putJsonArray("works") {
                works.forEach { (name, mins) ->
                    addJsonObject {
                        put("name", name)
                        put("minutes", mins)
                    }
                }
            }
            putJsonArray("parts") {
                parts.forEach { (name, qty, price) ->
                    addJsonObject {
                        put("name", name)
                        put("quantity", qty)
                        put("client_price", price)
                    }
                }
            }
        }.toString()
        val request = buildRequest("/api/admin/service-orders/$orderId", method = "PATCH", bodyJson = body, userId = adminId)
        client.newCall(request).execute().use { it.isSuccessful }
    }

    suspend fun transferBetweenWallets(
        fromWalletId: String,
        toWalletId: String,
        amount: Double,
        comment: String,
        adminId: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("from_wallet_id", fromWalletId)
            put("to_wallet_id", toWalletId)
            put("amount", amount.toString())
            put("description", comment)
        }.toString()
        val request = buildRequest("/api/admin/wallet-transfer", method = "POST", bodyJson = body, userId = adminId)
        client.newCall(request).execute().use { it.isSuccessful }
    }

    // ── Модуль подотчёта водителей (остатки на руках и перенос) ───────────

    suspend fun getDriverCashHolds(adminId: String? = null): List<DriverCashHold> = withContext(Dispatchers.IO) {
        val request = buildRequest("/api/admin/driver-cash-holds", userId = adminId)
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val body = response.body?.string() ?: "[]"
            try {
                json.decodeFromString<List<DriverCashHold>>(body)
            } catch (_: Exception) {
                emptyList()
            }
        }
    }

    suspend fun createDriverCashHold(
        driverId: String,
        amount: Double,
        note: String,
        adminId: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("driver_id", driverId)
            put("amount", amount.toString())
            put("note", note)
        }.toString()
        val request = buildRequest("/api/admin/driver-cash-holds", method = "POST", bodyJson = body, userId = adminId)
        client.newCall(request).execute().use { it.isSuccessful }
    }

    suspend fun collectDriverCashHold(
        holdId: String,
        collectedAmount: Double? = null,
        note: String? = null,
        adminId: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("hold_id", holdId)
            if (collectedAmount != null) put("collected_amount", collectedAmount.toString())
            if (note != null) put("note", note)
        }.toString()
        val request = buildRequest("/api/admin/driver-cash-holds", method = "PATCH", bodyJson = body, userId = adminId)
        client.newCall(request).execute().use { it.isSuccessful }
    }
}
