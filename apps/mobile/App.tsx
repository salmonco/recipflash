import auth from '@react-native-firebase/auth';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import React, { useEffect, useState } from 'react';
import { Menu } from './src/models/Menu';
import CardSetScreen from './src/screens/CardSetScreen';
import LoginScreen from './src/screens/LoginScreen';
import MenuListScreen from './src/screens/MenuListScreen';
import RecipeListScreen from './src/screens/RecipeListScreen';
import UploadScreen from './src/screens/UploadScreen';
import { trpc } from './src/trpc';
import { customLink } from './src/trpc/customLink';

export type RootStackParamList = {
  Upload: undefined;
  RecipeList: undefined;
  MenuList: { recipeId: number; recipeTitle: string };
  CardSet: { menus: Menu[] };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const queryClient = new QueryClient();

const trpcClient = trpc.createClient({
  links: [
    customLink,
    httpBatchLink({
      url: 'http://localhost:4000/trpc',
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
                options={{ title: '모든 레시피' }}
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
            </Stack.Navigator>
          </NavigationContainer>
        ) : (
          <LoginScreen />
        )}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
