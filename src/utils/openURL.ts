import { Linking } from 'react-native';
import { settingsService } from '../services/settings';

export async function openURL(url: string, navigate?: (url: string) => void) {
  const mode = await settingsService.getBrowserMode();
  if (mode === 'builtin' && navigate) {
    navigate(url);
  } else {
    Linking.openURL(url);
  }
}
