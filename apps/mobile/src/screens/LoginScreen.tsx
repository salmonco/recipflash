import {
  appleAuth,
  AppleButton,
} from '@invertase/react-native-apple-authentication';
import React from 'react';
import { Alert, Button, Platform, View } from 'react-native';
import authService from '../services/authService';
import { trpc } from '../trpc';

interface Props {
  onLogin: () => void;
}

const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const googleLoginMutation = trpc.auth.googleLogin.useMutation();
  const appleLoginMutation = trpc.auth.appleLogin.useMutation();

  const handleGoogleSignIn = async () => {
    try {
      const idToken = await authService.googleSignIn();
      if (idToken) {
        googleLoginMutation.mutate(
          { idToken },
          {
            onSuccess: data => {
              if ('user' in data) {
                onLogin();
              } else {
                Alert.alert('Login Failed', data.error);
              }
            },
            onError: error => {
              Alert.alert('Login Error', error.message);
            },
          },
        );
      }
    } catch (error: any) {
      Alert.alert('Sign-in Error', error.message);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const { identityToken, name } = await authService.appleSignIn();
      if (identityToken) {
        appleLoginMutation.mutate(
          { identityToken, name },
          {
            onSuccess: data => {
              if ('user' in data) {
                onLogin();
              } else {
                Alert.alert('Login Failed', data.error);
              }
            },
            onError: error => {
              Alert.alert('Login Error', error.message);
            },
          },
        );
      }
    } catch (error: any) {
      Alert.alert('Sign-in Error', error.message);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Sign in with Google" onPress={handleGoogleSignIn} />
      {Platform.OS === 'ios' && appleAuth.isSupported && (
        <AppleButton
          buttonStyle={AppleButton.Style.BLACK}
          buttonType={AppleButton.Type.SIGN_IN}
          style={{
            width: 160,
            height: 45,
            marginTop: 10,
          }}
          onPress={handleAppleSignIn}
        />
      )}
    </View>
  );
};

export default LoginScreen;
