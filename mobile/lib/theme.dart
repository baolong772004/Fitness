import 'package:flutter/material.dart';

abstract final class AuraColors {
  static const coffee = Color(0xFF6B2D1B);
  static const espresso = Color(0xFF3B180E);
  static const darkCoffee = Color(0xFF5A2314);
  static const caramel = Color(0xFF8C3E26);
  static const cream = Color(0xFFFAF7F2);
  static const latte = Color(0xFFF1E2D4);
  static const ink = Color(0xFF2C1B12);
  static const muted = Color(0xFF8C7567);
  static const border = Color(0xFFEADBCE);
  static const green = Color(0xFF2E7D32);
}

/// Compatibility alias
typedef CafeColors = AuraColors;

final auraTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: AuraColors.coffee,
    primary: AuraColors.coffee,
    surface: Colors.white,
    onSurface: AuraColors.ink,
  ),
  scaffoldBackgroundColor: AuraColors.cream,
  appBarTheme: const AppBarTheme(
    backgroundColor: AuraColors.cream,
    foregroundColor: AuraColors.ink,
    centerTitle: true,
    scrolledUnderElevation: 0,
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: BorderSide.none,
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: BorderSide.none,
    ),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: AuraColors.coffee,
      foregroundColor: Colors.white,
      minimumSize: const Size(48, 48),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      textStyle: const TextStyle(fontWeight: FontWeight.w700),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: AuraColors.coffee,
      minimumSize: const Size(48, 48),
      side: const BorderSide(color: AuraColors.coffee),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  ),
);

/// Compatibility alias
final cafeTheme = auraTheme;
