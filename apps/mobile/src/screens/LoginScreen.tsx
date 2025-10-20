import React from 'react';
import { View, Button, Alert } from 'react-native';
import authService from '../services/authService';
import { trpc } from '../trpc';

interface Props {
  onLogin: () => void;
}

const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const loginMutation = trpc.auth.googleLogin.useMutation();

  const handleGoogleSignIn = async () => {
    try {
      const idToken = await authService.googleSignIn();
      if (idToken) {
        loginMutation.mutate(
          { idToken },
          {
            onSuccess: (data) => {
              if ("user" in data) {
                onLogin();
              } else {
                Alert.alert('Login Failed', data.error);
              }
            },
            onError: (error) => {
              Alert.alert('Login Error', error.message);
            },
          }
        );
      }
    } catch (error: any) {
      Alert.alert('Sign-in Error', error.message);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Sign in with Google" onPress={handleGoogleSignIn} />
    </View>
  );
};

export default LoginScreen;
