import Toast from 'react-native-toast-message';
import { TOAST_DURATION } from './toastConstant';

interface ToastOptions {
  type?: 'success' | 'error' | 'info';
  visibilityTime?: number;
}

export const showToast = (
  text1: string,
  text2: string,
  options: ToastOptions = {},
) => {
  const { type = 'info', visibilityTime = TOAST_DURATION } = options;

  const position = type === 'success' ? 'bottom' : 'top';

  Toast.show({
    type,
    position,
    text1,
    text2,
    visibilityTime,
  });
};
