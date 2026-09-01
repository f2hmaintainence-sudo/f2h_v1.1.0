# Flutter Wrapper ProGuard & R8 Rules
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.embedding.** { *; }
-dontwarn io.flutter.embedding.**

# Keep Firebase / Google Services
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
