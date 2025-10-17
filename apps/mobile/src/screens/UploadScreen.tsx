import { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Recipe } from '../models/Recipe';

type RootStackParamList = {
  Upload: undefined;
  RecipeList: undefined;
  MenuList: { recipeId: number; recipeTitle: string };
};

type UploadScreenProps = NativeStackScreenProps<RootStackParamList, 'Upload'>;

function UploadScreen({ navigation }: UploadScreenProps): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#333' : '#F3F3F3',
    flex: 1,
  };

  const handleUpload = async () => {
    setError(null);
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
      Alert.alert('Success', '레시피가 생성되었습니다!');
      navigation.navigate('MenuList', {
        recipeId: result.id,
        recipeTitle: result.title,
      }); // Navigate back to RecipeList after successful upload
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

  const handleManualCreate = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:4000/create-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: '레시피 모음 1' }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || 'Failed to create recipe.');
      }

      Alert.alert('Success', '레시피가 생성되었습니다!');
      navigation.navigate('RecipeList');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unknown error occurred';
      setError(message);
      Alert.alert('Error', message);
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
          PDF 파일을 업로드하거나 수동으로 레시피를 생성하세요!
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            title="PDF 파일 업로드하기"
            onPress={handleUpload}
            disabled={isLoading}
          />
          <Button
            title="레시피 수동 생성하기"
            onPress={handleManualCreate}
            disabled={isLoading}
          />
        </View>

        {isLoading && (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.statusText}>
              레시피 생성 중입니다. 잠시만 기다려주세요...
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.statusContainer}>
            <Text style={styles.errorText}>{error}</Text>
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
