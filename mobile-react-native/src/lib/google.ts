import { Platform, TurboModuleRegistry } from 'react-native';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '64327623006-atl8dp6tgs3g650ts542b8ig0f9p54n2.apps.googleusercontent.com';

export const EXPO_GO_GOOGLE_PICKER = 'EXPO_GO_GOOGLE_PICKER';

export function buildExpoGoogleToken(email: string, fullName?: string): string {
  return `expo-google:${encodeURIComponent(JSON.stringify({
    email: email.trim().toLowerCase(),
    name: (fullName || '').trim() || undefined,
  }))}`;
}

export async function getGoogleIdToken(): Promise<string | null> {
  // Kiểm tra native module trước khi import để tránh lỗi TurboModuleRegistry.getEnforcing('RNGoogleSignin') trên Expo Go / Web
  const hasNativeGoogleModule =
    Platform.OS !== 'web' && TurboModuleRegistry.get('RNGoogleSignin') != null;

  if (!hasNativeGoogleModule) {
    return EXPO_GO_GOOGLE_PICKER;
  }

  if (Platform.OS === 'ios' && !process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) {
    return EXPO_GO_GOOGLE_PICKER;
  }

  try {
    const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({
      webClientId,
      ...(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ? { iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID } : {}),
    });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    if (!response.data.idToken) return EXPO_GO_GOOGLE_PICKER;
    return response.data.idToken;
  } catch {
    return EXPO_GO_GOOGLE_PICKER;
  }
}
