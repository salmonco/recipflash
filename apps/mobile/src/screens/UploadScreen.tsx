import { API_URL } from '@env';
import auth from '@react-native-firebase/auth';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DocumentPicker, { types } from 'react-native-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Recipe } from '../models/Recipe';
import { colors, typography } from '../styles/theme';
import { trpc } from '../trpc';
import { trackEvent } from '../utils/tracker';

type RootStackParamList = {
  Upload: undefined;
  RecipeList: undefined;
  MenuList: { recipeId: number; recipeTitle: string };
};

type UploadScreenProps = NativeStackScreenProps<RootStackParamList, 'Upload'>;

const UploadScreen = ({ navigation }: UploadScreenProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRecipeMutation = trpc.recipe.createRecipe.useMutation();

  const backgroundStyle = {
    backgroundColor: colors.background,
    flex: 1,
  };

  const handleUpload = async () => {
    trackEvent('ai_upload_button_clicked');
    setError(null);
    setIsLoading(true);

    try {
      const file = await DocumentPicker.pickSingle({
        type: [types.pdf, types.images],
      });

      const formData = new FormData();
      formData.append('recipe', {
        uri: file.uri,
        type: file.type,
        name: file.name,
      });

      const user = auth().currentUser;
      let token = null;
      if (user) {
        token = await user.getIdToken();
      }

      const response = await fetch(`${API_URL}/upload-recipe`, {
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
      Toast.show({
        type: 'success',
        text1: '성공',
        text2: '메뉴가 생성되었습니다!',
        visibilityTime: 5000,
      });
      navigation.navigate('MenuList', {
        recipeId: result.id,
        recipeTitle: result.title,
      });
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        console.log('사용자가 문서 선택을 취소했습니다.');
      } else {
        const message =
          err instanceof Error
            ? err.message
            : '알 수 없는 오류가 발생했습니다.';
        setError(message);
        Toast.show({
          type: 'error',
          text1: '오류',
          text2: message,
          visibilityTime: 5000,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualCreate = async () => {
    trackEvent('manual_create_button_clicked');
    setError(null);
    setIsLoading(true);

    try {
      const result = await createRecipeMutation.mutateAsync({
        title: '레시피 모음 1',
      });

      if (!result.success) {
        throw new Error(result.errorMessage || '레시피 생성에 실패했습니다.');
      }

      Toast.show({
        type: 'success',
        text1: '성공',
        text2: '레시피가 생성되었습니다!',
        visibilityTime: 5000,
      });
      navigation.navigate('RecipeList');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(message);
      Toast.show({
        type: 'error',
        text1: '오류',
        text2: message,
        visibilityTime: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <Text style={styles.title}>🍳🥘🧑‍🍳🍳</Text>
        <Text style={styles.subtitle}>
          레시피 파일(PDF, 이미지)을 업로드하여 메뉴를 자동으로 생성하세요.
        </Text>

        <View style={styles.buttonContainer}>
          <Pressable
            style={styles.button}
            onPress={handleUpload}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>레시피 파일 업로드</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.manualButton]}
            onPress={handleManualCreate}
            disabled={isLoading}
          >
            <Text style={styles.manualButtonText}>레시피 수동 생성</Text>
          </Pressable>
        </View>

        {isLoading && (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    ...typography.title,
    fontSize: 36,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
    color: colors.gray,
    marginBottom: 48,
  },
  buttonContainer: {
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    ...typography.subtitle,
    color: colors.text,
  },
  manualButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  manualButtonText: {
    ...typography.subtitle,
    color: colors.primary,
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  statusText: {
    ...typography.body,
    marginTop: 12,
    color: colors.gray,
  },
  errorText: {
    ...typography.body,
    marginTop: 12,
    color: colors.point,
  },
});

export default UploadScreen;
