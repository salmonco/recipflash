import {
  appleAuth,
  AppleButton,
} from '@invertase/react-native-apple-authentication';
import React from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { authService } from '../services/authService';
import { colors, typography } from '../styles/theme';
import { trpc } from '../trpc';
import { trackEvent } from '../utils/tracker';

const PRIVACY_POLICY_URL = 'https://slashpage.com/recipflash/privacy';

const LoginScreen = () => {
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
                Alert.alert('Login Failed');
              }
            },
            onError: error => {
              Alert.alert('Login Error', error.message);
            },
          },
        );
      }
    } catch (error: any) {
      console.log('Google Sign-In Error:', error);
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
                Alert.alert('Login Failed');
              }
            },
            onError: error => {
              Alert.alert('Login Error', error.message);
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
      <Text style={styles.title}>RecipFlash</Text>
      <Text style={styles.subtitle}>당신의 레시피를 플래시 카드로</Text>
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
});

export default LoginScreen;
