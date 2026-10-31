const base = {
  "name": "Aura Fitness",
  "slug": "aura-fitness-react-native",
  "scheme": "aurafitness",
  "version": "1.0.0",
  "orientation": "portrait",
  "icon": "./assets/icon.png",
  "userInterfaceStyle": "light",
  "plugins": [
    "expo-router",
    "expo-asset",
    "expo-font",
    [
      "expo-image-picker",
      {
        "cameraPermission": "Cho phép Aura Fitness quay video bài tập để phân tích kỹ thuật khi bạn đồng ý.",
        "microphonePermission": "Cho phép Aura Fitness ghi âm khi quay video bài tập."
      }
    ],
    "expo-video",
    "expo-status-bar",
    [
      "expo-camera",
      {
        "cameraPermission": "Cho phép Aura Fitness sử dụng camera để quét mã QR điểm danh.",
        "recordAudioAndroid": false
      }
    ],
    "expo-secure-store",
    "@react-native-community/datetimepicker",
    [
      "expo-build-properties",
      {
        "android": {
          "usesCleartextTraffic": true
        }
      }
    ],
    [
      "@react-native-google-signin/google-signin",
      {
        "iosUrlScheme": "com.googleusercontent.apps.64327623006-atl8dp6tgs3g650ts542b8ig0f9p54n2"
      }
    ]
  ],
  "ios": {
    "bundleIdentifier": "com.aurafitness.mobile.reactnative",
    "supportsTablet": true,
    "infoPlist": {
      "NSCameraUsageDescription": "Quét mã QR hoặc quay video bài tập khi bạn chọn sử dụng.",
      "NSAppTransportSecurity": {
        "NSAllowsLocalNetworking": true
      },
      "NSLocalNetworkUsageDescription": "Aura Fitness kết nối với máy chủ API trên mạng nội bộ."
    }
  },
  "android": {
    "package": "com.aurafitness.mobile.reactnative",
    "adaptiveIcon": {
      "backgroundColor": "#E6F4FE",
      "foregroundImage": "./assets/android-icon-foreground.png",
      "backgroundImage": "./assets/android-icon-background.png",
      "monochromeImage": "./assets/android-icon-monochrome.png"
    },
    "predictiveBackGestureEnabled": false,
    "permissions": [
      "CAMERA"
    ]
  },
  "web": {
    "favicon": "./assets/favicon.png"
  }
};

module.exports = () => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const iosUrlScheme = iosClientId
    ? `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, '')}`
    : 'com.googleusercontent.apps.64327623006-atl8dp6tgs3g650ts542b8ig0f9p54n2';

  return {
    ...base,
    plugins: base.plugins.map(plugin =>
      Array.isArray(plugin) && plugin[0] === '@react-native-google-signin/google-signin'
        ? [plugin[0], { iosUrlScheme }]
        : plugin
    ),
  };
};
