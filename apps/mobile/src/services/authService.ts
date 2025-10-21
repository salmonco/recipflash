import { WEB_CLIENT_ID } from '@env';
import appleAuth from '@invertase/react-native-apple-authentication';
import auth from '@react-native-firebase/auth';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

// Helper function to generate a nonce
const generateNonce = (length: number) => {
  const charset =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
};

class AuthService {
  constructor() {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
    });
  }

  async appleSignIn() {
    try {
      const rawNonce = generateNonce(32);
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
        nonce: rawNonce,
      });

      const { identityToken } = appleAuthRequestResponse;

      if (!identityToken) {
        throw new Error('Apple Sign-In failed: No identity token received');
      }

      const appleCredential = auth.AppleAuthProvider.credential(
        identityToken,
        rawNonce,
      );

      const firebaseUserCredential = await auth().signInWithCredential(
        appleCredential,
      );

      const firebaseIdToken = await firebaseUserCredential.user.getIdToken();
      return firebaseIdToken;
    } catch (error: any) {
      if (error.code === appleAuth.Error.CANCELED) {
        console.log('User cancelled Apple Sign-In');
      } else {
        console.error('Apple Sign-In Error:', error);
      }
      throw error;
    }
  }

  async googleSignIn() {
    try {
      await GoogleSignin.hasPlayServices();
      const { idToken } = await GoogleSignin.signIn();
      if (!idToken) {
        throw new Error('Google Sign-In failed: No ID token received');
      }
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const firebaseUserCredential = await auth().signInWithCredential(
        googleCredential,
      );
      const firebaseIdToken = await firebaseUserCredential.user.getIdToken();
      return firebaseIdToken;
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('User cancelled Google Sign-In');
      } else {
        console.error('Google Sign-In Error:', error);
      }
      throw error;
    }
  }
}

const authService = new AuthService();

export { authService };
