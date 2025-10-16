import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trpc } from '../trpc';

type RootStackParamList = {
  RecipeList: undefined;
  MenuList: { recipeId: number; recipeTitle: string };
  Upload: undefined; // Add Upload screen to RootStackParamList
};

type RecipeListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'RecipeList'
>;

function RecipeListScreen({
  navigation,
}: RecipeListScreenProps): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const { data, isLoading, error, refetch } = trpc.getAllRecipes.useQuery();

  // Refetch data when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch]),
  );

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

  const hasRecipes = data.recipes && data.recipes.length > 0;

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        <Text style={styles.title}>Recipes</Text>

        {hasRecipes ? (
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
          <View style={styles.noRecipesContainer}>
            <Text style={styles.noRecipesText}>No recipes found.</Text>
            <Button
              title="Upload New Recipe"
              onPress={() => navigation.navigate('Upload')}
            />
          </View>
        )}

        {/* Floating Action Button */}
        <Pressable
          style={styles.fab}
          onPress={() => navigation.navigate('Upload')}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
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
  noRecipesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  noRecipesText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    right: 20,
    bottom: 20,
    backgroundColor: '#03A9F4',
    borderRadius: 28,
    elevation: 8,
  },
  fabText: {
    fontSize: 24,
    color: 'white',
  },
});

export default RecipeListScreen;
