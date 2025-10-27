import { API_URL } from '@env';
import { HotUpdater, getUpdateSource } from '@hot-updater/react-native';
import auth from '@react-native-firebase/auth';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Menu } from './src/models/Menu';
import CardSetScreen from './src/screens/CardSetScreen';
import LoginScreen from './src/screens/LoginScreen';
import MenuListScreen from './src/screens/MenuListScreen';
import RecipeListScreen from './src/screens/RecipeListScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import UploadScreen from './src/screens/UploadScreen';
import { trpc } from './src/trpc';
import { customLink } from './src/trpc/customLink';

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

function App(): React.JSX.Element {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(user => {
      console.log('Auth state changed. User:', user);
      setIsLoggedIn(!!user);
    });

    return unsubscribe;
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {isLoggedIn ? (
          <NavigationContainer>
            <Stack.Navigator initialRouteName="RecipeList">
              <Stack.Screen
                name="RecipeList"
                component={RecipeListScreen}
                options={({ navigation }) => ({
                  title: '모든 레시피',
                  headerRight: () => (
                    <Pressable onPress={() => navigation.navigate('Settings')}>
                      <Icon name="settings" size={24} color="black" />
                    </Pressable>
                  ),
                })}
              />
              <Stack.Screen
                name="Upload"
                component={UploadScreen}
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
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default HotUpdater.wrap({
  source: getUpdateSource(
    'https://zwuwbwentecdfwamokev.supabase.co/functions/v1/update-server',
    {
      updateStrategy: 'appVersion', // or "fingerprint"
    },
  ),
  requestHeaders: {
    // if you want to use the request headers, you can add them here
  },
  fallbackComponent: ({ progress, status }) => (
    <View
      style={{
        flex: 1,
        padding: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* You can put a splash image here. */}

      <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
        {status === 'UPDATING' ? 'Updating...' : 'Checking for Update...'}
      </Text>
      {progress > 0 ? (
        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
          {Math.round(progress * 100)}%
        </Text>
      ) : null}
    </View>
  ),
})(App);
