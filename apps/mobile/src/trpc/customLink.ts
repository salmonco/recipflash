import auth from '@react-native-firebase/auth';
import { TRPCLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import { AppRouter } from '.';

export const customLink: TRPCLink<AppRouter> = () => {
  // here we just got initialized in the app - this happens once per app
  // useful for storing cache for instance
  return ({ next, op }) => {
    // this is when passing the result to the next link
    // each link needs to return an observable which propagates results
    return observable(observer => {
      console.log('performing operation:', op);
      const unsubscribe = next(op).subscribe({
        next(value) {
          observer.next(value);
        },
        error(err) {
          console.log('we received error', err);
          if (err?.message === 'UNAUTHORIZED') {
            console.log('UNAUTHORIZED error detected.');
            const user = auth().currentUser;
            if (user) {
              console.log('User exists, attempting to refresh token...');
              user
                .getIdToken(true)
                .then(() => {
                  console.log(
                    'Token refreshed, retrying original operation...',
                  );
                  // Token refreshed, retry the original operation
                  next(op).subscribe({
                    next: observer.next,
                    error: retryErr => {
                      console.log(
                        'Retry operation failed with error:',
                        retryErr,
                      );
                      if (retryErr?.message === 'UNAUTHORIZED') {
                        console.log('Retry also UNAUTHORIZED, signing out...');
                        auth().signOut();
                      }
                      observer.error(retryErr);
                    },
                    complete: observer.complete,
                  });
                })
                .catch(refreshError => {
                  console.log('Failed to refresh token:', refreshError);
                  // Failed to refresh token, sign out
                  auth().signOut();
                  observer.error(err);
                });
            } else {
              console.log('No user found, signing out...');
              // No user, just sign out (shouldn't happen if UNAUTHORIZED)
              auth().signOut();
              observer.error(err);
            }
          } else {
            console.log('Error is not UNAUTHORIZED, propagating error.');
            observer.error(err);
          }
        },
        complete() {
          observer.complete();
        },
      });
      return unsubscribe;
    });
  };
};
