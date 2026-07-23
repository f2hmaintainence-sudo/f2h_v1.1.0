/// Date and time formatting utilities for the F2H delivery partner app.

/// Returns a time-appropriate greeting based on the current hour.
///
/// Used in [DashboardHeader] to replace the hardcoded "Good Morning 👋" string.
class AppGreeting {
  AppGreeting._();

  /// Returns one of four greetings based on [DateTime.now().hour]:
  /// - 05:00–11:59 → "Good Morning 🌅"
  /// - 12:00–16:59 → "Good Afternoon ☀️"
  /// - 17:00–20:59 → "Good Evening 🌆"
  /// - 21:00–04:59 → "Good Night 🌙"
  static String get() {
    final hour = DateTime.now().hour;
    if (hour >= 5 && hour < 12) return 'Good Morning 🌅';
    if (hour >= 12 && hour < 17) return 'Good Afternoon ☀️';
    if (hour >= 17 && hour < 21) return 'Good Evening 🌆';
    return 'Good Night 🌙';
  }
}
