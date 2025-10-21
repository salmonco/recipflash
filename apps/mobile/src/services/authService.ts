import { WEB_CLIENT_ID } from '@env';
import appleAuth from '@invertase/react-native-apple-authentication';
import auth from '@react-native-firebase/auth';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

class AuthService {
  constructor() {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
    });
  }

  async appleSignIn() {
    try {
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });

      const { identityToken, fullName } = appleAuthRequestResponse;

      if (!identityToken) {
        throw new Error('Apple Sign-In failed: No identity token received');
      }

      // The full name is only provided on the first authorization
      const name = fullName
        ? `${fullName.givenName} ${fullName.familyName}`
        : null;

      // Here you would typically call your backend to verify the token and sign in the user
      // For now, we'll just return the token and name
      return { identityToken, name };
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
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const firebaseUserCredential = await auth().signInWithCredential(
        googleCredential,
      );
      const firebaseIdToken = await firebaseUserCredential.user.getIdToken();
      return firebaseIdToken;
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('User cancelled the login flow');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Sign in is in progress already');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.log('Play services not available or outdated');
      } else {
        console.error('Google Sign-In Error:', error);
      }
      throw error;
    }
  }
}

export default new AuthService();
