import { Platform } from 'react-native';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '64327623006-atl8dp6tgs3g650ts542b8ig0f9p54n2.apps.googleusercontent.com';

export async function getGoogleIdToken(): Promise<string | null> {
  if (Platform.OS === 'ios' && !process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) {
    throw new Error('Cần cấu hình EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID để đăng nhập Google trên iPhone.');
  }
  const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId,
    ...(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ? { iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID } : {}),
  });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  if (!response.data.idToken) throw new Error('Google chưa trả về ID token. Kiểm tra Web Client ID, package ID và SHA-1.');
  return response.data.idToken;
}
