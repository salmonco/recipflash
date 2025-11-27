import * as amplitude from '@amplitude/analytics-react-native';
import { API_URL } from '@env';
import { getUpdateSource, HotUpdater } from '@hot-updater/react-native';
import auth from '@react-native-firebase/auth';
import {
  createNavigationContainerRef,
  NavigationContainer,
  NavigationState,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Menu } from './src/models/Menu';
import CardSetScreen from './src/screens/CardSetScreen';
import LoginScreen from './src/screens/LoginScreen';
import MenuListScreen from './src/screens/MenuListScreen';
import RecipeListScreen from './src/screens/RecipeListScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import StreamingUploadScreen from './src/screens/StreamingUploadScreen';
import { colors, typography } from './src/styles/theme';
import { trpc } from './src/trpc';
import { customLink } from './src/trpc/customLink';
import { toastConfig } from './src/utils/toast/toastConfig';
import { trackAppStart, trackScreenView } from './src/utils/tracker';

if (process.env.AMPLITUDE_API_KEY) {
  amplitude.init(process.env.AMPLITUDE_API_KEY, undefined, {
    disableCookies: true,
  });
}

export type RootStackParamList = {
  Upload: undefined;
  RecipeList: undefined;
  MenuList: { recipeId: number; recipeTitle: string };
  CardSet: { menus: Menu[] };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const queryClient = new QueryClient();

const trpcClient = trpc.createClient({
  links: [
    customLink,
    httpBatchLink({
      url: `${API_URL}/trpc`,
      async headers() {
        const user = auth().currentUser;
        if (user) {
          const token = await user.getIdToken();
          return {
            Authorization: `Bearer ${token}`,
          };
        }
        return {};
      },
    }),
  ],
});

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const SPLASH_SCREEN_DELAY = 3000;

const AppContent = (): React.JSX.Element => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const routeNameRef = useRef<string | undefined>(undefined);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(user => {
      console.log('Auth state changed. User:', user);
      setIsLoggedIn(!!user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    trackAppStart();
  }, []);

  const getActiveRouteName = useCallback((state: NavigationState) => {
    const route = state.routes[state.index];

    if (route.state) {
      return getActiveRouteName(route.state as NavigationState);
    }

    return route.name;
  }, []);

  useEffect(() => {
    const state = navigationRef.current?.getRootState();

    if (state) {
      routeNameRef.current = getActiveRouteName(state);
    }
  }, [getActiveRouteName]);

  useEffect(() => {
    setTimeout(() => {
      BootSplash.hide();
    }, SPLASH_SCREEN_DELAY);
  }, []);

  const onStateChange = async (state: NavigationState | undefined) => {
    if (state === undefined) return;

    const previousRouteName = routeNameRef.current;
    const currentRouteName = getActiveRouteName(state);

    if (previousRouteName !== currentRouteName) {
      trackScreenView({ screenName: currentRouteName });
    }

    routeNameRef.current = currentRouteName;
  };

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {isLoggedIn ? (
          <NavigationContainer
            ref={navigationRef}
            onStateChange={onStateChange}
          >
            <Stack.Navigator
              initialRouteName="RecipeList"
              screenOptions={{
                headerStyle: {
                  backgroundColor: colors.background,
                },
                headerTintColor: colors.text,
                headerTitleStyle: {
                  fontSize: typography.subtitle.fontSize,
                  fontWeight: typography.subtitle.fontWeight,
                },
                headerShadowVisible: false,
              }}
            >
              <Stack.Screen
                name="RecipeList"
                component={RecipeListScreen}
                options={({ navigation }) => ({
                  title: '모든 레시피',
                  headerRight: () => (
                    <Pressable onPress={() => navigation.navigate('Settings')}>
                      <Icon name="settings" size={24} color={colors.text} />
                    </Pressable>
                  ),
                })}
              />
              <Stack.Screen
                name="Upload"
                component={StreamingUploadScreen}
                options={{ title: '레시피 업로드' }}
              />
              <Stack.Screen
                name="MenuList"
                component={MenuListScreen}
                options={({ route }) => ({ title: route.params.recipeTitle })}
              />
              <Stack.Screen
                name="CardSet"
                component={CardSetScreen}
                options={{ title: '카드 세트' }}
              />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ title: '설정' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        ) : (
          <LoginScreen />
        )}
        <Toast
          config={toastConfig}
          topOffset={insets.top + 60}
          bottomOffset={insets.bottom + 100}
        />
      </QueryClientProvider>
    </trpc.Provider>
  );
};

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

export default HotUpdater.wrap({
  source: getUpdateSource(
    'https://zwuwbwentecdfwamokev.supabase.co/functions/v1/update-server',
    {
      updateStrategy: 'appVersion',
    },
  ),
  requestHeaders: {},
  fallbackComponent: ({ progress, status }) => (
    <View
      style={{
        flex: 1,
        padding: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ ...typography.title, color: colors.text }}>
        {status === 'UPDATING' ? 'Updating...' : 'Checking for Update....'}
      </Text>
      {progress > 0 ? (
        <Text style={{ ...typography.subtitle, color: colors.text }}>
          {Math.round(progress * 100)}%
        </Text>
      ) : null}
    </View>
  ),
})(App);
