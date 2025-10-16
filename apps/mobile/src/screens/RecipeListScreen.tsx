import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { trpc } from '../trpc';

type RootStackParamList = {
  RecipeList: undefined;
  MenuList: { recipeId: number; recipeTitle: string };
};

type RecipeListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'RecipeList'
>;

function RecipeListScreen({
  navigation,
}: RecipeListScreenProps): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const { data, isLoading, error } = trpc.getAllRecipes.useQuery();

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#333' : '#F3F3F3',
    flex: 1,
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[backgroundStyle, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text style={styles.statusText}>Loading recipes...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[backgroundStyle, styles.centered]}>
        <Text style={styles.errorText}>Error: {error.message}</Text>
      </SafeAreaView>
    );
  }

  if (!data?.success) {
    return (
      <SafeAreaView style={[backgroundStyle, styles.centered]}>
        <Text style={styles.errorText}>
          No data or failed to fetch recipes.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        <Text style={styles.title}>Recipes</Text>
        {data.recipes && data.recipes.length > 0 ? (
          <FlatList
            data={data.recipes}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <Pressable
                style={styles.recipeItem}
                onPress={() =>
                  navigation.navigate('MenuList', {
                    recipeId: item.id,
                    recipeTitle: item.title,
                  })
                }
              >
                <Text style={styles.recipeTitle}>{item.title}</Text>
                <Text style={styles.recipeMenuCount}>
                  {item.menus.length} menus
                </Text>
              </Pressable>
            )}
          />
        ) : (
          <Text style={styles.noRecipesText}>
            No recipes found. Upload one!
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  statusText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: 'red',
  },
  recipeItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  recipeMenuCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  noRecipesText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
    color: '#666',
  },
});

export default RecipeListScreen;
