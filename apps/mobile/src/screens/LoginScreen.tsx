import {
  appleAuth,
  AppleButton,
} from '@invertase/react-native-apple-authentication';
import React, { useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { authService } from '../services/authService';
import { colors, typography } from '../styles/theme';
import { trpc } from '../trpc';
import { trackEvent } from '../utils/tracker';

const PRIVACY_POLICY_URL = 'https://slashpage.com/recipflash/privacy';

const LoginScreen = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const firebaseSignInMutation = trpc.auth.firebaseSignIn.useMutation();

  const handleGoogleSignIn = async () => {
    trackEvent('google_sign_in_button_clicked');
    try {
      const idToken = await authService.googleSignIn();
      if (idToken) {
        firebaseSignInMutation.mutate(
          { idToken },
          {
            onSuccess: data => {
              if (!data.success) {
                Toast.show({
                  type: 'error',
                  text1: 'Login Failed',
                  text2: '로그인에 실패했습니다.',
                  visibilityTime: 5000,
                });
              }
            },
            onError: error => {
              Toast.show({
                type: 'error',
                text1: 'Login Error',
                text2: error.message,
                visibilityTime: 5000,
              });
            },
          },
        );
      }
    } catch (error: any) {
      console.log('Google Sign-In Error:', error);
    }
  };

  const handleEmailLogin = async () => {
    trackEvent('email_login_button_clicked');
    try {
      const user = await authService.emailAndPasswordSignIn(email, password);
      const idToken = await user.getIdToken();
      if (!idToken) {
        throw new Error(
          'Failed to retrieve ID token after email/password sign-in',
        );
      }
      firebaseSignInMutation.mutate(
        { idToken },
        {
          onSuccess: data => {
            if (data.success) {
              setModalVisible(false);
              setEmail('');
              setPassword('');
            } else {
              Toast.show({
                type: 'error',
                text1: 'Login Failed',
                text2: '로그인에 실패했습니다.',
                visibilityTime: 5000,
              });
            }
          },
          onError: error => {
            Toast.show({
              type: 'error',
              text1: 'Login Error',
              text2: error.message,
              visibilityTime: 5000,
            });
          },
        },
      );
    } catch (error: any) {
      console.log('Email/Password Sign-In Error:', error);
    }
  };

  const handleAppleSignIn = async () => {
    trackEvent('apple_sign_in_button_clicked');
    try {
      const idToken = await authService.appleSignIn();
      if (idToken) {
        firebaseSignInMutation.mutate(
          { idToken },
          {
            onSuccess: data => {
              if (!data.success) {
                Toast.show({
                  type: 'error',
                  text1: 'Login Failed',
                  text2: '로그인에 실패했습니다.',
                  visibilityTime: 5000,
                });
              }
            },
            onError: error => {
              Toast.show({
                type: 'error',
                text1: 'Login Error',
                text2: error.message,
                visibilityTime: 5000,
              });
            },
          },
        );
      }
    } catch (error: any) {
      console.log('Apple Sign-In Error:', error);
    }
  };

  const handlePrivacyPolicyPress = () => {
    trackEvent('privacy_policy_clicked');
    Linking.openURL(PRIVACY_POLICY_URL);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🍳🌱🧑🍳🍎</Text>
      <Text style={styles.subtitle}>당신의 레시피를 플래시 카드로</Text>

      <Pressable
        style={styles.emailButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.buttonText}>일반 로그인</Text>
      </Pressable>

      <Pressable style={styles.googleButton} onPress={handleGoogleSignIn}>
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </Pressable>

      {Platform.OS === 'ios' && appleAuth.isSupported && (
        <AppleButton
          buttonStyle={AppleButton.Style.WHITE_OUTLINE}
          buttonType={AppleButton.Type.SIGN_IN}
          style={styles.appleButton}
          onPress={handleAppleSignIn}
        />
      )}

      <Text style={styles.privacyPolicyText} onPress={handlePrivacyPolicyPress}>
        개인정보처리방침
      </Text>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>로그인</Text>

            <TextInput
              style={styles.input}
              placeholder="이메일"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="비밀번호"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Pressable style={styles.loginButton} onPress={handleEmailLogin}>
              <Text style={styles.buttonText}>로그인</Text>
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  title: {
    ...typography.title,
    fontSize: 48,
    marginBottom: 10,
  },
  subtitle: {
    ...typography.body,
    fontSize: 18,
    color: colors.gray,
    marginBottom: 60,
  },
  emailButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 15,
    width: 250,
    alignItems: 'center',
  },
  googleButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 15,
    width: 250,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.subtitle,
    color: colors.text,
  },
  appleButton: {
    width: 250,
    height: 45,
    marginTop: 10,
  },
  privacyPolicyText: {
    marginTop: 20,
    color: colors.gray,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    ...typography.title,
    fontSize: 24,
    marginBottom: 20,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.gray,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelButton: {
    paddingVertical: 10,
  },
  cancelText: {
    color: colors.gray,
    fontSize: 16,
  },
});

export default LoginScreen;
