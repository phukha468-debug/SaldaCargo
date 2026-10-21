package ru.ancargo66.app.core.model

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonPrimitive

object FlexibleDoubleSerializer : KSerializer<Double> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("FlexibleDouble", PrimitiveKind.DOUBLE)
    override fun serialize(encoder: Encoder, value: Double) = encoder.encodeDouble(value)
    override fun deserialize(decoder: Decoder): Double {
        val jsonInput = decoder as? JsonDecoder ?: return try { decoder.decodeDouble() } catch (_: Exception) { 0.0 }
        val element = jsonInput.decodeJsonElement()
        return when (element) {
            is JsonPrimitive -> element.content.toDoubleOrNull() ?: 0.0
            else -> 0.0
        }
    }
}

object FlexibleLongSerializer : KSerializer<Long> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("FlexibleLong", PrimitiveKind.LONG)
    override fun serialize(encoder: Encoder, value: Long) = encoder.encodeLong(value)
    override fun deserialize(decoder: Decoder): Long {
        val jsonInput = decoder as? JsonDecoder ?: return try { decoder.decodeLong() } catch (_: Exception) { 0L }
        val element = jsonInput.decodeJsonElement()
        return when (element) {
            is JsonPrimitive -> element.content.toLongOrNull() ?: (element.content.toDoubleOrNull()?.toLong() ?: 0L)
            else -> 0L
        }
    }
}

object FlexibleStringSerializer : KSerializer<String> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("FlexibleString", PrimitiveKind.STRING)
    override fun serialize(encoder: Encoder, value: String) = encoder.encodeString(value)
    override fun deserialize(decoder: Decoder): String {
        val jsonInput = decoder as? JsonDecoder ?: return decoder.decodeString()
        val element = jsonInput.decodeJsonElement()
        return when (element) {
            is JsonPrimitive -> element.content
            else -> ""
        }
    }
}

@Serializable
data class User(
    val id: String,
    val name: String,
    val roles: List<String> = emptyList(),
    @SerialName("has_pin") val hasPin: Boolean = false,
    @SerialName("pin_code") val pinCode: String? = null,
    val phone: String? = null,
    val notes: String? = null,
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("current_asset_id") val currentAssetId: String? = null
)

@Serializable
data class Asset(
    val id: String,
    @SerialName("reg_number") val regNumber: String = "",
    @SerialName("short_name") val shortName: String = "",
    val status: String = "active",
    @Serializable(with = FlexibleLongSerializer::class)
    @SerialName("odometer_current") val odometerCurrent: Long = 0L
)

@Serializable
data class Counterparty(
    val id: String? = null,
    val name: String = "Клиент"
)

@Serializable
data class ExpenseCategory(
    val id: String? = null,
    val name: String = "Расход",
    val code: String? = null
)

@Serializable
data class LoaderPayItem(
    val id: String? = null,
    val name: String? = null,
    @Serializable(with = FlexibleStringSerializer::class)
    val pay: String = "0"
)

@Serializable
data class TripOrder(
    val id: String = "",
    @SerialName("trip_id") val tripId: String? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val amount: Double = 0.0,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("driver_pay") val driverPay: Double = 0.0,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("driver_car_pay") val driverCarPay: Double = 0.0,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("driver_loader_pay") val driverLoaderPay: Double = 0.0,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("loader_pay") val loaderPay: Double = 0.0,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("loader2_pay") val loader2Pay: Double = 0.0,
    @SerialName("loaders_data") val loadersData: List<LoaderPayItem> = emptyList(),
    @SerialName("is_driver_loader") val isDriverLoader: Boolean = false,
    val direction: String? = null,
    val description: String? = null,
    @SerialName("payment_method") val paymentMethod: String = "cash",
    @SerialName("settlement_status") val settlementStatus: String = "completed",
    @SerialName("lifecycle_status") val lifecycleStatus: String = "draft",
    val counterparty: Counterparty? = null
)

@Serializable
data class TripExpense(
    val id: String = "",
    @SerialName("trip_id") val tripId: String? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val amount: Double = 0.0,
    @SerialName("payment_method") val paymentMethod: String = "fuel_card",
    val description: String? = null,
    val category: ExpenseCategory? = null
)

@Serializable
data class TripAsset(
    @SerialName("short_name") val shortName: String = "",
    @SerialName("reg_number") val regNumber: String = ""
)

@Serializable
data class TripDriver(
    val id: String? = null,
    val name: String = "Водитель"
)

@Serializable
data class TripDetail(
    val id: String,
    @Serializable(with = FlexibleLongSerializer::class)
    @SerialName("trip_number") val tripNumber: Long = 0L,
    @SerialName("asset_id") val assetId: String? = null,
    @SerialName("driver_id") val driverId: String? = null,
    val status: String = "in_progress",
    @SerialName("lifecycle_status") val lifecycleStatus: String = "draft",
    @SerialName("trip_type") val tripType: String = "local",
    @SerialName("started_at") val startedAt: String? = null,
    @SerialName("ended_at") val endedAt: String? = null,
    @Serializable(with = FlexibleLongSerializer::class)
    @SerialName("odometer_start") val odometerStart: Long = 0L,
    @Serializable(with = FlexibleLongSerializer::class)
    @SerialName("odometer_end") val odometerEnd: Long? = null,
    @SerialName("driver_note") val driverNote: String? = null,
    @SerialName("loaders_count") val loadersCount: Int = 0,
    val asset: TripAsset? = null,
    val driver: TripDriver? = null,
    @SerialName("trip_orders") val tripOrders: List<TripOrder> = emptyList(),
    @SerialName("trip_expenses") val tripExpenses: List<TripExpense> = emptyList()
)

typealias Trip = TripDetail

@Serializable
data class ServiceOrder(
    val id: String = "",
    @SerialName("asset_id") val assetId: String? = null,
    @SerialName("assigned_mechanic_id") val assignedMechanicId: String? = null,
    @SerialName("client_vehicle_reg") val clientVehicleReg: String? = null,
    @SerialName("client_name") val clientName: String? = null,
    val status: String = "in_progress",
    @SerialName("admin_note") val adminNote: String? = null
)

@Serializable
data class TripSummaryItem(
    val id: String,
    @Serializable(with = FlexibleLongSerializer::class)
    @SerialName("trip_number") val tripNumber: Long = 0L,
    val status: String = "completed",
    @SerialName("lifecycle_status") val lifecycleStatus: String = "draft",
    @SerialName("started_at") val startedAt: String? = null,
    @SerialName("ended_at") val endedAt: String? = null,
    @SerialName("trip_type") val tripType: String? = null,
    val asset: TripAsset? = null,
    @SerialName("trip_orders") val tripOrders: List<TripOrder> = emptyList()
)

@Serializable
data class DriverSummary(
    val activeTrip: TripSummaryItem? = null,
    val reviewTrips: List<TripSummaryItem> = emptyList(),
    val recentTrips: List<TripSummaryItem> = emptyList(),
    @Serializable(with = FlexibleStringSerializer::class)
    val accountableBalance: String = "0",
    @Serializable(with = FlexibleStringSerializer::class)
    val monthPayApproved: String = "0.00",
    @Serializable(with = FlexibleStringSerializer::class)
    val monthPayDraft: String = "0.00",
    val pendingPayrollCount: Int = 0
)

@Serializable
data class AdminSummary(
    val activeTrips: Int = 0,
    val pendingReview: Int = 0,
    @Serializable(with = FlexibleStringSerializer::class)
    val todayRevenue: String = "0.00"
)

@Serializable
data class WalletBalance(
    val id: String,
    val name: String,
    val type: String,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val balance: Double = 0.0
)

@Serializable
data class CashTransaction(
    val id: String = "",
    @Serializable(with = FlexibleDoubleSerializer::class)
    val amount: Double = 0.0,
    val description: String? = null,
    @SerialName("payment_method") val paymentMethod: String = "cash",
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class AccountableFinance(
    @Serializable(with = FlexibleStringSerializer::class)
    val balance: String = "0",
    val transactions: List<CashTransaction> = emptyList()
)

@Serializable
data class PendingPayrollItem(
    val id: String,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val amount: Double = 0.0,
    @SerialName("category_id") val categoryId: String? = null,
    val label: String = "ЗП",
    val context: String = "",
    val date: String? = null
)

@Serializable
data class SalaryAccrualItem(
    val id: String = "",
    @Serializable(with = FlexibleDoubleSerializer::class)
    val amount: Double = 0.0,
    val label: String = "ЗП",
    @SerialName("settlement_status") val settlementStatus: String = "pending",
    val date: String? = null,
    @SerialName("trip_number") val tripNumber: Long? = null,
    @SerialName("asset_name") val assetName: String? = null
)

@Serializable
data class SalaryFinance(
    @SerialName("pending_confirmation") val pendingConfirmation: List<PendingPayrollItem> = emptyList(),
    @Serializable(with = FlexibleStringSerializer::class)
    @SerialName("accumulated_total") val accumulatedTotal: String = "0.00",
    val accruals: List<SalaryAccrualItem> = emptyList()
)

@Serializable
data class DriverFinanceData(
    val accountable: AccountableFinance? = null,
    val salary: SalaryFinance? = null
)

@Serializable
data class LoaderShiftState(
    val online: Boolean = false,
    val address: String = "г. Верхняя Салда",
    val car: Boolean = true,
    @SerialName("updated_at") val updatedAt: Long = 0L
)
