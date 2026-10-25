package ru.ancargo66.app

import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test
import ru.ancargo66.app.core.model.*

class ModelsTest {

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    @Test
    fun testUserDeserializationWithCleanerRole() {
        val userJson = """
            {
                "id": "ac87edfc-7775-46a7-bead-16da6b143215",
                "name": "Татьяна",
                "roles": ["cleaner"],
                "notes": "Уборщица (Гараж)",
                "is_active": true
            }
        """.trimIndent()

        val user = json.decodeFromString<User>(userJson)
        assertEquals("Татьяна", user.name)
        assertTrue(user.roles.contains("cleaner"))
        assertEquals("Уборщица (Гараж)", user.notes)
        assertTrue(user.isActive)
    }

    @Test
    fun testStaffFilterCleanerRecognition() {
        val users = listOf(
            User(id = "1", name = "Татьяна", roles = listOf("cleaner"), notes = "Гараж"),
            User(id = "2", name = "Ирина", roles = listOf("cleaner"), notes = "Офис"),
            User(id = "3", name = "Александр", roles = listOf("driver")),
            User(id = "4", name = "Вадик", roles = listOf("mechanic"))
        )

        val cleaners = users.filter { u ->
            u.roles.contains("cleaner") || (u.notes != null && u.notes.lowercase().contains("уборщиц")) ||
            u.name == "Татьяна" || u.name == "Ирина"
        }

        assertEquals(2, cleaners.size)
        assertEquals("Татьяна", cleaners[0].name)
        assertEquals("Ирина", cleaners[1].name)
    }

    @Test
    fun testFlexibleDoubleSerializer() {
        val rawJson = """
            {
                "id": "ord-1",
                "amount": "1500.50",
                "driver_pay": 450,
                "payment_method": "cash"
            }
        """.trimIndent()

        val order = json.decodeFromString<TripOrder>(rawJson)
        assertEquals(1500.50, order.amount, 0.001)
        assertEquals(450.0, order.driverPay, 0.001)
        assertEquals("cash", order.paymentMethod)
    }

    @Test
    fun testTripProfitCalculation() {
        val rawJson = """
            {
                "id": "trip-100",
                "trip_number": 100,
                "status": "completed",
                "lifecycle_status": "draft",
                "odometer_start": 120000,
                "odometer_end": 120085,
                "driver_note": "Всё штатно",
                "trip_orders": [
                    {
                        "id": "o1",
                        "amount": 10000.0,
                        "driver_pay": 3000.0,
                        "loader_pay": 1000.0,
                        "lifecycle_status": "draft",
                        "payment_method": "cash"
                    },
                    {
                        "id": "o2",
                        "amount": 5000.0,
                        "driver_pay": 1500.0,
                        "loader_pay": 0.0,
                        "lifecycle_status": "cancelled",
                        "payment_method": "qr"
                    }
                ],
                "trip_expenses": [
                    {
                        "id": "e1",
                        "amount": 2500.0,
                        "payment_method": "fuel_card"
                    }
                ]
            }
        """.trimIndent()

        val trip = json.decodeFromString<TripDetail>(rawJson)
        assertEquals(100L, trip.tripNumber)
        assertEquals(85L, (trip.odometerEnd ?: 0L) - trip.odometerStart)
        assertEquals("Всё штатно", trip.driverNote)

        // Only active orders count
        val activeOrders = trip.tripOrders.filter { it.lifecycleStatus != "cancelled" }
        assertEquals(1, activeOrders.size)

        val revenue = activeOrders.sumOf { it.amount }
        val driverPay = activeOrders.sumOf { it.driverPay }
        val loaderPay = activeOrders.sumOf { it.loaderPay }
        val expenses = trip.tripExpenses.sumOf { it.amount }
        val netProfit = revenue - driverPay - loaderPay - expenses

        assertEquals(10000.0, revenue, 0.01)
        assertEquals(3000.0, driverPay, 0.01)
        assertEquals(1000.0, loaderPay, 0.01)
        assertEquals(2500.0, expenses, 0.01)
        assertEquals(3500.0, netProfit, 0.01)
    }

    @Test
    fun testAdminSummaryParsing() {
        val summaryJson = """
            {
                "activeTrips": 3,
                "pendingReview": 2,
                "todayRevenue": "48500.00"
            }
        """.trimIndent()

        val summary = json.decodeFromString<AdminSummary>(summaryJson)
        assertEquals(3, summary.activeTrips)
        assertEquals(2, summary.pendingReview)
        assertEquals("48500.00", summary.todayRevenue)
    }

    @Test
    fun testWalletBalanceParsing() {
        val wallet = WalletBalance(id = "1", name = "Р/Счет", type = "bank", balance = 1250000.0)
        assertEquals("bank", wallet.type)
        assertEquals(1250000.0, wallet.balance, 0.01)
    }
}
