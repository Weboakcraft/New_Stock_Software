package com.oakcraft.stock

import android.content.Context

/** Small settings that belong to the Android shell rather than to the web app. */
class Prefs(context: Context) {

    private val sp = context.applicationContext
        .getSharedPreferences("oakcraft-stock", Context.MODE_PRIVATE)

    /** Where to look for newer web files. Empty string switches auto-update off. */
    var updateUrl: String
        get() = sp.getString(KEY_UPDATE_URL, null) ?: BuildConfig.UPDATE_BASE_URL
        set(value) {
            sp.edit().putString(KEY_UPDATE_URL, value.trim().trimEnd('/')).apply()
        }

    var lockEnabled: Boolean
        get() = sp.getBoolean(KEY_LOCK, false)
        set(value) {
            sp.edit().putBoolean(KEY_LOCK, value).apply()
        }

    var lastCheckAt: Long
        get() = sp.getLong(KEY_LAST_CHECK, 0L)
        set(value) {
            sp.edit().putLong(KEY_LAST_CHECK, value).apply()
        }

    var lastCheckNote: String
        get() = sp.getString(KEY_LAST_NOTE, "") ?: ""
        set(value) {
            sp.edit().putString(KEY_LAST_NOTE, value).apply()
        }

    private companion object {
        const val KEY_UPDATE_URL = "updateUrl"
        const val KEY_LOCK = "lockEnabled"
        const val KEY_LAST_CHECK = "lastCheckAt"
        const val KEY_LAST_NOTE = "lastCheckNote"
    }
}
