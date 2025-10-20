import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import React, { useState } from 'react';
import { trpc } from './src/trpc';

import { Menu } from './src/models/Menu';
import CardSetScreen from './src/screens/CardSetScreen';
import LoginScreen from './src/screens/LoginScreen';
import MenuListScreen from './src/screens/MenuListScreen';
import RecipeListScreen from './src/screens/RecipeListScreen';
import UploadScreen from './src/screens/UploadScreen';

export type RootStackParamList = {
  Upload: undefined; // No params for UploadScreen
  RecipeList: undefined; // No params for RecipeListScreen
  MenuList: { recipeId: number; recipeTitle: string }; // Params for MenuListScreen
  CardSet: { menus: Menu[] };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:4000/trpc', // Adjust to your backend URL
    }),
  ],
});

function App(): React.JSX.Element {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {!isLoggedIn ? (
          <LoginScreen onLogin={() => setIsLoggedIn(true)} />
        ) : (
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
        )}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
