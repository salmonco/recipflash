import {
  appleAuth,
  AppleButton,
} from '@invertase/react-native-apple-authentication';
import React from 'react';
import {
  Alert,
  Button,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { authService } from '../services/authService';
import { trpc } from '../trpc';

const PRIVACY_POLICY_URL = 'https://slashpage.com/recipflash/privacy';

const LoginScreen = () => {
  const firebaseSignInMutation = trpc.auth.firebaseSignIn.useMutation();

  const handleGoogleSignIn = async () => {
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
      Alert.alert('Login Error', error.message);
    }
  };

  const handleAppleSignIn = async () => {
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
      Alert.alert('Login Error', error.message);
    }
  };

  const handlePrivacyPolicyPress = () => {
    Linking.openURL(PRIVACY_POLICY_URL);
  };

  return (
    <View style={styles.container}>
      <Button title="Sign in with Google" onPress={handleGoogleSignIn} />
      {Platform.OS === 'ios' && appleAuth.isSupported && (
        <AppleButton
          buttonStyle={AppleButton.Style.BLACK}
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
  },
  appleButton: {
    width: 160,
    height: 45,
    marginTop: 10,
  },
  privacyPolicyText: {
    marginTop: 20,
    color: 'blue',
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;
