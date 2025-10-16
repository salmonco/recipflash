import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import DocumentPicker, { types } from 'react-native-document-picker';
import { Recipe } from '../models/Recipe';

type RootStackParamList = {
  Upload: undefined;
  RecipeList: undefined;
  MenuList: { recipeId: number; recipeTitle: string };
};

type UploadScreenProps = NativeStackScreenProps<RootStackParamList, 'Upload'>;

function UploadScreen({ navigation }: UploadScreenProps): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#333' : '#F3F3F3',
    flex: 1,
  };

  const handleUpload = async () => {
    setError(null);
    setRecipe(null);
    setIsLoading(true);

    try {
      // 1. Pick a single PDF file
      const file = await DocumentPicker.pickSingle({
        type: [types.pdf],
      });

      // 2. Create FormData to send the file
      const formData = new FormData();
      formData.append('recipe', {
        uri: file.uri,
        type: file.type,
        name: file.name,
      });

      // 3. Upload the file to the backend
      // For iOS simulator, localhost is fine. For Android emulator, use 10.0.2.2
      const response = await fetch('http://localhost:4000/upload-recipe', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(
          errData.details || 'Failed to upload and process file.',
        );
      }

      const result: Recipe = await response.json();
      setRecipe(result);
      Alert.alert('Success', 'Recipe uploaded and menus generated!');
      // Optionally navigate to the recipe list or menu list after upload
      // navigation.navigate('MenuList', { recipeId: result.id, recipeTitle: result.title });
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        // User cancelled the picker
        console.log('User cancelled the document picker');
      } else {
        const message =
          err instanceof Error ? err.message : 'An unknown error occurred';
        setError(message);
        Alert.alert('Error', message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        <Text style={styles.title}>Recipflash</Text>
        <Text style={styles.subtitle}>
          Upload a recipe PDF to generate menus automatically.
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            title="Upload Recipe PDF"
            onPress={handleUpload}
            disabled={isLoading}
          />
          <Button
            title="View All Recipes"
            onPress={() => navigation.navigate('RecipeList')}
            disabled={isLoading}
          />
        </View>

        {isLoading && (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.statusText}>
              Processing PDF and generating menus...
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.statusContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {recipe && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>Recipe uploaded successfully!</Text>
            <Button
              title="View Menus for this Recipe"
              onPress={() =>
                navigation.navigate('MenuList', {
                  recipeId: recipe.id,
                  recipeTitle: recipe.title,
                })
              }
            />
          </View>
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },
  buttonContainer: {
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
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
});

export default UploadScreen;
