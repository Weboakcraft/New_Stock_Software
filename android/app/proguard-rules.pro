# The web app calls these methods by name from JavaScript.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.oakcraft.stock.WebAppBridge { *; }

# ML Kit barcode model classes are looked up reflectively.
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# WebView JS interface plumbing
-keepattributes JavascriptInterface
-keepattributes *Annotation*
