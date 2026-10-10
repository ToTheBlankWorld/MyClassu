# MyClassu release rules (Stage 12). R8 minifies third-party bytecode;
# the app's own code and its serialization surface are never stripped:
# alarm/attendance must survive process death and OS delivery paths, and
# the Supabase sync path cannot be live-tested without a configured
# backend, so it is kept whole by construction.

# Keep the app's own classes (small surface; reliability over bytes).
-keep class com.myclassu.** { *; }

# kotlinx.serialization (Supabase models): keep generated serializers.
-keepattributes *Annotation*, InnerClasses, Signature, EnclosingMethod
-keepclasseswithmembers class kotlinx.serialization.json.** { *; }
-keep class kotlinx.serialization.** { *; }
-dontwarn kotlinx.serialization.**

# Ktor client engine discovery runs through ServiceLoader-style lookup.
-keep class io.ktor.client.engine.android.** { *; }
-dontwarn io.ktor.**

# React Native Hermes / Reanimated / Worklets ship their own consumer
# rules; nothing extra is needed here. Debug-only entry points are
# already gated by BuildConfig.DEBUG (compile-time false in release).
