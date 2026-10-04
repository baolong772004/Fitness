import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'screens/member_shell.dart';
import 'services/demo_auth.dart';
import 'theme.dart';

void main() => runApp(const AuraFitApp());

class AuraFitApp extends StatefulWidget {
  const AuraFitApp({super.key});

  @override
  State<AuraFitApp> createState() => _AuraFitAppState();
}

class _AuraFitAppState extends State<AuraFitApp> {
  final _auth = DemoAuth();

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Aura Fitness',
    debugShowCheckedModeBanner: false,
    theme: auraTheme,
    locale: const Locale('vi'),
    supportedLocales: const [Locale('vi'), Locale('en')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    home: MemberShell(auth: _auth),
  );
}

/// Compatibility typedef
typedef CafeFitApp = AuraFitApp;
