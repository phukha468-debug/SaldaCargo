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
    val name: String = "Клиент",
    @SerialName("is_legal_entity") val isLegalEntity: Boolean = false,
    @SerialName("is_top") val isTop: Boolean = false,
    @SerialName("is_delivery_zone_client") val isDeliveryZoneClient: Boolean = false,
    @SerialName("min_delivery_base") val minDeliveryBase: Double? = null
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
    @SerialName("admin_note") val adminNote: String? = null,
    @SerialName("started_at") val startedAt: String? = null,
    @SerialName("completed_at") val completedAt: String? = null
)

@Serializable
data class MechanicWorkCatalog(
    val id: String? = null,
    val name: String = "",
    @Serializable(with = FlexibleLongSerializer::class)
    @SerialName("norm_minutes") val normMinutes: Long = 0L
)

@Serializable
data class MechanicWorkItem(
    val id: String = "",
    @SerialName("custom_work_name") val customWorkName: String? = null,
    val status: String = "completed",
    @Serializable(with = FlexibleLongSerializer::class)
    @SerialName("norm_minutes") val normMinutes: Long = 0L,
    @Serializable(with = FlexibleLongSerializer::class)
    @SerialName("actual_minutes") val actualMinutes: Long = 0L,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("price_client") val priceClient: Double = 0.0,
    @SerialName("work_catalog") val workCatalog: MechanicWorkCatalog? = null
) {
    val displayName: String
        get() = customWorkName?.takeIf { it.isNotBlank() }
            ?: workCatalog?.name?.takeIf { it.isNotBlank() }
            ?: "Работа"
    val effectiveMinutes: Long
        get() = if (actualMinutes > 0L) actualMinutes else normMinutes
}

@Serializable
data class MechanicPartCatalog(
    val id: String? = null,
    val name: String = "",
    val unit: String = "шт"
)

@Serializable
data class MechanicPartItem(
    val id: String = "",
    @SerialName("custom_part_name") val customPartName: String? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val quantity: Double = 1.0,
    val unit: String = "шт",
    val part: MechanicPartCatalog? = null
) {
    val displayName: String
        get() = customPartName?.takeIf { it.isNotBlank() }
            ?: part?.name?.takeIf { it.isNotBlank() }
            ?: "Запчасть"
    val displayUnit: String
        get() = unit.takeIf { it.isNotBlank() } ?: part?.unit ?: "шт"
}

@Serializable
data class MechanicOrder(
    val id: String = "",
    @Serializable(with = FlexibleLongSerializer::class)
    @SerialName("order_number") val orderNumber: Long = 0L,
    @SerialName("machine_type") val machineType: String = "own",
    val status: String = "in_progress",
    @SerialName("lifecycle_status") val lifecycleStatus: String = "draft",
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("started_at") val startedAt: String? = null,
    @SerialName("completed_at") val completedAt: String? = null,
    @Serializable(with = FlexibleLongSerializer::class)
    @SerialName("odometer_start") val odometerStart: Long = 0L,
    @Serializable(with = FlexibleLongSerializer::class)
    @SerialName("odometer_end") val odometerEnd: Long = 0L,
    @SerialName("problem_description") val problemDescription: String? = null,
    @SerialName("mechanic_note") val mechanicNote: String? = null,
    @SerialName("admin_note") val adminNote: String? = null,
    @SerialName("client_vehicle_brand") val clientVehicleBrand: String? = null,
    @SerialName("client_vehicle_model") val clientVehicleModel: String? = null,
    @SerialName("client_vehicle_reg") val clientVehicleReg: String? = null,
    val asset: TripAsset? = null,
    val mechanic: TripDriver? = null,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("hourly_rate") val hourlyRate: Double = 1600.0,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("salary_pct") val salaryPct: Double = 50.0,
    @Serializable(with = FlexibleLongSerializer::class)
    @SerialName("total_minutes") val totalMinutes: Long = 0L,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("estimated_pay") val estimatedPay: Double = 0.0,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("approved_pay") val approvedPay: Double = 0.0,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("mechanic_pay") val mechanicPay: Double = 0.0,
    @SerialName("parts_provided_by_service") val partsProvidedByService: Boolean = false,
    @SerialName("settlement_status") val settlementStatus: String = "pending",
    val works: List<MechanicWorkItem> = emptyList(),
    val parts: List<MechanicPartItem> = emptyList()
)

@Serializable
data class MechanicRates(
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("hourly_rate_client") val hourlyRateClient: Double = 2000.0,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("hourly_rate_own") val hourlyRateOwn: Double = 1600.0,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("mechanic_salary_pct") val mechanicSalaryPct: Double = 50.0
)

@Serializable
data class MechanicSalarySummary(
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("total_accrued") val totalAccrued: Double = 0.0,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("total_paid") val totalPaid: Double = 0.0,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("to_pay") val toPay: Double = 0.0,
    @Serializable(with = FlexibleDoubleSerializer::class)
    @SerialName("draft_pay") val draftPay: Double = 0.0
)

@Serializable
data class MechanicPayoutItem(
    val id: String = "",
    @Serializable(with = FlexibleDoubleSerializer::class)
    val amount: Double = 0.0,
    val description: String = "",
    @SerialName("wallet_label") val walletLabel: String = "Выплата",
    @SerialName("is_advance") val isAdvance: Boolean = false,
    val date: String? = null
)

@Serializable
data class MechanicAccrualServiceOrder(
    val id: String = "",
    @Serializable(with = FlexibleLongSerializer::class)
    @SerialName("order_number") val orderNumber: Long = 0L,
    @SerialName("machine_type") val machineType: String = "own",
    @SerialName("client_vehicle_brand") val clientVehicleBrand: String? = null,
    @SerialName("client_vehicle_model") val clientVehicleModel: String? = null,
    @SerialName("client_vehicle_reg") val clientVehicleReg: String? = null,
    val asset: TripAsset? = null
)

@Serializable
data class MechanicAccrualItem(
    val id: String = "",
    @Serializable(with = FlexibleDoubleSerializer::class)
    val amount: Double = 0.0,
    @SerialName("settlement_status") val settlementStatus: String = "pending",
    val description: String = "",
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("transaction_date") val transactionDate: String? = null,
    @SerialName("service_order") val serviceOrder: MechanicAccrualServiceOrder? = null
)

@Serializable
data class MechanicSalaryData(
    val accruals: List<MechanicAccrualItem> = emptyList(),
    val payouts: List<MechanicPayoutItem> = emptyList(),
    @SerialName("pending_confirmation") val pendingConfirmation: List<PendingPayrollItem> = emptyList(),
    @SerialName("pending_confirmation_count") val pendingConfirmationCount: Int = 0,
    val rates: MechanicRates = MechanicRates(),
    val summary: MechanicSalarySummary = MechanicSalarySummary()
)

data class MechanicWorkDraftInput(
    val name: String,
    val minutes: Int
)

data class MechanicPartDraftInput(
    val name: String,
    val quantity: Double,
    val unit: String = "шт"
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
data class DriverCashHoldItem(
    val id: String = "",
    @Serializable(with = FlexibleStringSerializer::class)
    val amount: String = "0.00",
    val note: String = "",
    val date: String? = null
)

@Serializable
data class DriverCashHold(
    val id: String = "",
    @SerialName("driver_id") val driverId: String = "",
    @SerialName("driver_name") val driverName: String = "",
    @SerialName("driver_phone") val driverPhone: String = "",
    @Serializable(with = FlexibleStringSerializer::class)
    val amount: String = "0.00",
    val note: String = "",
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("transaction_date") val transactionDate: String? = null,
    @SerialName("trip_id") val tripId: String? = null,
    @SerialName("trip_number") val tripNumber: Int? = null,
    @SerialName("trip_date") val tripDate: String? = null,
    @SerialName("asset_name") val assetName: String? = null
) {
    val amountDouble: Double
        get() = amount.toDoubleOrNull() ?: 0.0
}

@Serializable
data class DriverSummary(
    val activeTrip: TripSummaryItem? = null,
    val reviewTrips: List<TripSummaryItem> = emptyList(),
    val recentTrips: List<TripSummaryItem> = emptyList(),
    @Serializable(with = FlexibleStringSerializer::class)
    val accountableBalance: String = "0",
    val activeCarryover: DriverCashHoldItem? = null,
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
    val pendingGarageReview: Int = 0,
    val totalPendingReview: Int = 0,
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
    @Serializable(with = FlexibleStringSerializer::class)
    val carryover: String = "0.00",
    val activeCarryover: DriverCashHoldItem? = null,
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

@Serializable
data class PayrollEmployee(
    val id: String,
    val name: String,
    val roles: List<String> = emptyList(),
    val role: String? = null,
    val phone: String? = null,
    val notes: String? = null,
    @SerialName("auto_settle") val autoSettle: Boolean = false,
    @Serializable(with = FlexibleStringSerializer::class)
    val earned: String = "0.00",
    @Serializable(with = FlexibleStringSerializer::class)
    val paid: String = "0.00",
    @Serializable(with = FlexibleStringSerializer::class)
    val debt: String = "0.00",
    @Serializable(with = FlexibleStringSerializer::class)
    @SerialName("advance_balance") val advanceBalance: String = "0.00",
    @Serializable(with = FlexibleStringSerializer::class)
    @SerialName("advance_offset") val advanceOffset: String = "0.00",
    @Serializable(with = FlexibleStringSerializer::class)
    val payout: String = "0.00",
    @SerialName("is_management") val isManagement: Boolean = false,
    val shifts: Int = 0,
    @SerialName("unconfirmed_count") val unconfirmedCount: Int = 0
) {
    val earnedDouble: Double get() = earned.toDoubleOrNull() ?: 0.0
    val paidDouble: Double get() = paid.toDoubleOrNull() ?: 0.0
    val debtDouble: Double get() = debt.toDoubleOrNull() ?: 0.0
    val advanceDouble: Double get() = advanceBalance.toDoubleOrNull() ?: 0.0
    val payoutDouble: Double get() = payout.toDoubleOrNull() ?: 0.0
}

@Serializable
data class StaffTxTrip(
    @Serializable(with = FlexibleLongSerializer::class)
    @SerialName("trip_number") val tripNumber: Long? = null,
    @SerialName("started_at") val startedAt: String? = null
)

@Serializable
data class StaffPendingTx(
    val id: String,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val amount: Double = 0.0,
    val description: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("transaction_date") val transactionDate: String? = null,
    @SerialName("category_id") val categoryId: String? = null,
    @SerialName("employee_confirmed") val employeeConfirmed: Boolean? = null,
    val trip: StaffTxTrip? = null
)

@Serializable
data class StaffHistoryTx(
    val id: String,
    @Serializable(with = FlexibleDoubleSerializer::class)
    val amount: Double = 0.0,
    val direction: String = "expense",
    val description: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("transaction_date") val transactionDate: String? = null,
    @SerialName("category_id") val categoryId: String? = null,
    @SerialName("settlement_status") val settlementStatus: String = "completed",
    @SerialName("is_payroll") val isPayroll: Boolean = false,
    @SerialName("is_payout") val isPayout: Boolean = false,
    @SerialName("is_advance") val isAdvance: Boolean = false,
    val trip: StaffTxTrip? = null
)

@Serializable
data class StaffSettleDetails(
    @Serializable(with = FlexibleStringSerializer::class)
    @SerialName("salary_total") val salaryTotal: String = "0.00",
    @Serializable(with = FlexibleStringSerializer::class)
    @SerialName("advance_balance") val advanceBalance: String = "0.00",
    @Serializable(with = FlexibleStringSerializer::class)
    @SerialName("payout_total") val payoutTotal: String = "0.00",
    @SerialName("unconfirmed_count") val unconfirmedCount: Int = 0,
    @SerialName("pending_transactions") val pendingTransactions: List<StaffPendingTx> = emptyList(),
    val history: List<StaffHistoryTx> = emptyList()
)
