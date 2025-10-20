import auth from '@react-native-firebase/auth';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { WEB_CLIENT_ID } from '@env';

class AuthService {
  constructor() {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
    });
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
