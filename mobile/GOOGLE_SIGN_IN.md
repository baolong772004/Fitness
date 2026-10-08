# Google Sign-In setup

The login screen uses `google_sign_in` to obtain a Google ID token and sends it to `POST /api/auth/google`. The backend verifies that token against `GOOGLE_CLIENT_ID`.

## OAuth client configuration

1. In Google Cloud Console, create OAuth credentials for the Android package `com.cafefit.cafe_fit_mobile` and register the SHA-1 signing fingerprints for each build (debug and release).
2. Create a Web application OAuth client. Use this Web client ID as the backend `GOOGLE_CLIENT_ID` and pass the same value to Flutter as `GOOGLE_SERVER_CLIENT_ID`.
3. For iOS, create an iOS OAuth client for the app's bundle ID. Pass it as `GOOGLE_IOS_CLIENT_ID` and add the iOS client's `REVERSED_CLIENT_ID` to `CFBundleURLTypes` in `ios/Runner/Info.plist` as a URL scheme. The URL scheme is required for Google to return to the app.
4. Run the app with the Web client ID (and the iOS client ID when running on iOS):

```sh
cd mobile
flutter run --dart-define=GOOGLE_SERVER_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

On iOS, also pass `--dart-define=GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com`.

For a physical device, include the backend address too:

```sh
flutter run \
  --dart-define=API_BASE_URL=http://192.168.1.45:5000/api \
  --dart-define=GOOGLE_SERVER_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

The OAuth client ID is an identifier, not a client secret. Do not place a client secret in the Flutter app. Google Cloud must also have the app's Android package name and signing SHA-1 configured correctly; otherwise Android may report a configuration or canceled sign-in error.
