import React from 'react';
import { StyleSheet } from 'react-native';
import { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';
import { colors } from '../styles/theme';

const styles = StyleSheet.create({
  successToast: {
    borderLeftColor: colors.primary,
    backgroundColor: colors.background,
    borderLeftWidth: 6,
    height: 70,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  errorToast: {
    borderLeftColor: '#FF4444',
    backgroundColor: colors.background,
    borderLeftWidth: 6,
    height: 70,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  contentContainer: {
    paddingHorizontal: 15,
  },
  text1: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  text2: {
    fontSize: 14,
    color: colors.text,
  },
});

export const toastConfig: ToastConfig = {
  success: props => (
    <BaseToast
      {...props}
      style={styles.successToast}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
    />
  ),
  error: props => (
    <ErrorToast
      {...props}
      style={styles.errorToast}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
    />
  ),
};
