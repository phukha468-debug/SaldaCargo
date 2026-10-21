package ru.ancargo66.app.core.storage

import android.content.Context
import android.content.SharedPreferences
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import ru.ancargo66.app.core.model.User

class SessionManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("salda_session", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    fun saveUser(user: User, activeRole: String) {
        prefs.edit()
            .putString("user_data", json.encodeToString(user))
            .putString("active_role", activeRole)
            .apply()
    }

    fun getCurrentUser(): User? {
        val userJson = prefs.getString("user_data", null) ?: return null
        return try {
            json.decodeFromString<User>(userJson)
        } catch (_: Exception) {
            null
        }
    }

    fun getActiveRole(): String {
        return prefs.getString("active_role", "driver") ?: "driver"
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    // Сохранение статуса смены грузчика
    fun saveLoaderShift(isOnline: Boolean, address: String, hasTransport: Boolean) {
        prefs.edit()
            .putBoolean("loader_online", isOnline)
            .putString("loader_address", address)
            .putBoolean("loader_transport", hasTransport)
            .apply()
    }

    fun isLoaderOnline(): Boolean = prefs.getBoolean("loader_online", false)
    fun getLoaderAddress(): String = prefs.getString("loader_address", "г. Верхняя Салда") ?: "г. Верхняя Салда"
    fun hasLoaderTransport(): Boolean = prefs.getBoolean("loader_transport", true)
}
