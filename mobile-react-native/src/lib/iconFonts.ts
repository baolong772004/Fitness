import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { Directory, Paths } from 'expo-file-system';
import { isLoaded, loadAsync } from 'expo-font';
import { Platform } from 'react-native';

export async function loadIconFonts(): Promise<void> {
  if (isLoaded('ionicons')) return;

  if (Platform.OS === 'android') {
    const cache = Paths.cache;
    cache.create({ intermediates: true, idempotent: true });

    // SDK 57's Android asset downloader can mkdirs() the destination file when
    // its cache parent is missing. Repair only this font's invalid cache entry.
    const asset = Asset.fromModule(Ionicons.font.ionicons);
    if (asset.hash) {
      const cachePath = Paths.join(cache.uri, `ExponentAsset-${asset.hash}.${asset.type}`);
      if (Paths.info(cachePath).isDirectory) {
        new Directory(cachePath).delete();
      }
    }
  }

  await loadAsync(Ionicons.font);
}
