import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ToastConfig } from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, typography } from '../styles/theme';

const styles = StyleSheet.create({
  toastContainer: {
    width: '90%',
    padding: 15,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  successContainer: {
    backgroundColor: colors.white,
  },
  errorContainer: {
    backgroundColor: colors.white,
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  text1: {
    ...typography.subtitle,
    fontSize: 16,
  },
  text2: {
    ...typography.body,
    fontSize: 14,
    marginTop: 2,
    color: colors.gray,
  },
});

export const toastConfig: ToastConfig = {
  success: ({ text1, text2, onPress }) => (
    <Pressable
      onPress={onPress}
      style={[styles.toastContainer, styles.successContainer]}
    >
      <View style={styles.iconContainer}>
        <Icon name="check-circle" size={28} color={colors.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.text1}>{text1}</Text>
        {text2 && <Text style={styles.text2}>{text2}</Text>}
      </View>
    </Pressable>
  ),
  error: ({ text1, text2, onPress }) => (
    <Pressable
      onPress={onPress}
      style={[styles.toastContainer, styles.errorContainer]}
    >
      <View style={styles.iconContainer}>
        <Icon name="error" size={28} color="#FF4444" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.text1}>{text1}</Text>
        {text2 && <Text style={styles.text2}>{text2}</Text>}
      </View>
    </Pressable>
  ),
};
