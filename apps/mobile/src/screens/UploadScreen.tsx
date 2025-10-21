import auth from '@react-native-firebase/auth';
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
import { trpc } from '../trpc';

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

  const createRecipeMutation = trpc.recipe.createRecipe.useMutation();

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
      const user = auth().currentUser;
      let token = null;
      if (user) {
        token = await user.getIdToken();
      }

      const response = await fetch('http://localhost:4000/upload-recipe', {
        method: 'POST',
        body: formData as any,
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error('파일 업로드 및 처리 중 오류가 발생했습니다.');
      }

      const result = (await response.json()) as Recipe;
      Alert.alert('성공', '메뉴가 생성되었습니다!');
      navigation.navigate('MenuList', {
        recipeId: result.id,
        recipeTitle: result.title,
      }); // Navigate back to RecipeList after successful upload
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        // User cancelled the picker
        console.log('사용자가 문서 선택을 취소했습니다.');
      } else {
        const message =
          err instanceof Error
            ? err.message
            : '알 수 없는 오류가 발생했습니다.';
        setError(message);
        Alert.alert('오류', message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualCreate = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await createRecipeMutation.mutateAsync({
        title: '레시피 모음 1',
      });

      if (!result.success) {
        throw new Error(result.errorMessage || '레시피 생성에 실패했습니다.');
      }

      Alert.alert('성공', '레시피가 생성되었습니다!');
      navigation.navigate('RecipeList');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(message);
      Alert.alert('오류', message);
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
          레시피 PDF를 업로드하여 메뉴를 자동으로 생성하세요.
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            title="레시피 PDF 업로드"
            onPress={handleUpload}
            disabled={isLoading}
          />
          <Button
            title="레시피 수동 생성"
            onPress={handleManualCreate}
            disabled={isLoading}
          />
        </View>

        {isLoading && (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.statusText}>메뉴를 생성 중입니다...</Text>
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
