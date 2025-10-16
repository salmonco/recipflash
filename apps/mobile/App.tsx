import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import your screens
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import React from 'react';
import { trpc } from './src/trpc';

import MenuListScreen from './src/screens/MenuListScreen';
import RecipeListScreen from './src/screens/RecipeListScreen';
import UploadScreen from './src/screens/UploadScreen';

export type RootStackParamList = {
  Upload: undefined; // No params for UploadScreen
  RecipeList: undefined; // No params for RecipeListScreen
  MenuList: { recipeId: number; recipeTitle: string }; // Params for MenuListScreen
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
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="RecipeList">
            <Stack.Screen
              name="RecipeList"
              component={RecipeListScreen}
              options={{ title: 'All Recipes' }}
            />
            <Stack.Screen
              name="Upload"
              component={UploadScreen}
              options={{ title: 'Upload Recipe' }}
            />
            <Stack.Screen
              name="MenuList"
              component={MenuListScreen}
              options={({ route }) => ({ title: route.params.recipeTitle })}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
