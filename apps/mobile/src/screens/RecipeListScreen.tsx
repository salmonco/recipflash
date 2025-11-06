import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Recipe } from '../models/Recipe';
import { colors, typography } from '../styles/theme';
import { trpc } from '../trpc';
import { trackEvent } from '../utils/tracker';

type RootStackParamList = {
  RecipeList: undefined;
  MenuList: { recipeId: number; recipeTitle: string };
  Upload: undefined;
};

type RecipeListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'RecipeList'
>;

const RecipeListScreen = ({ navigation }: RecipeListScreenProps) => {
  const {
    data: allRecipes,
    isLoading,
    error,
    refetch,
  } = trpc.recipe.getAllRecipes.useQuery();
  const utils = trpc.useUtils();

  const [
    isEditingRecipeTitleModalVisible,
    setIsEditingRecipeTitleModalVisible,
  ] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [editingRecipeTitle, setEditingRecipeTitle] = useState('');

  const updateRecipeTitleMutation = trpc.recipe.updateRecipeTitle.useMutation();
  const deleteRecipeMutation = trpc.recipe.deleteRecipe.useMutation();

  const backgroundStyle = {
    backgroundColor: colors.background,
    flex: 1,
  };

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const handleEditRecipeTitlePress = (recipe: Recipe) => {
    trackEvent('edit_recipe_title_click');
    setEditingRecipeId(recipe.id);
    setEditingRecipeTitle(recipe.title);
    setIsEditingRecipeTitleModalVisible(true);
  };

  const handleUpdateRecipeTitle = async () => {
    if (editingRecipeId === null) {
      Alert.alert('오류', '선택된 레시피가 없습니다.');
      return;
    }

    try {
      const result = await updateRecipeTitleMutation.mutateAsync({
        id: editingRecipeId,
        title: editingRecipeTitle,
      });

      if (result.success) {
        Alert.alert('성공', '레시피 제목이 업데이트되었습니다!');
        utils.recipe.getAllRecipes.setData(undefined, oldData => {
          if (!oldData?.success) return oldData;
          return {
            ...oldData,
            data: {
              ...oldData.data,
              recipes: oldData.data.recipes.map(recipe =>
                recipe.id === editingRecipeId
                  ? { ...recipe, title: editingRecipeTitle }
                  : recipe,
              ),
            },
          };
        });
        setIsEditingRecipeTitleModalVisible(false);
      } else {
        throw new Error(
          result.errorMessage || '레시피 제목 업데이트에 실패했습니다.',
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      Alert.alert('오류', message);
    }
  };

  const handleDeleteRecipe = (recipeId: number) => {
    trackEvent('delete_recipe_click');
    Alert.alert('레시피 삭제', '이 레시피와 모든 메뉴를 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await deleteRecipeMutation.mutateAsync({
              id: recipeId,
            });
            if (result.success) {
              Alert.alert('성공', '레시피가 삭제되었습니다.');
              utils.recipe.getAllRecipes.setData(undefined, oldData => {
                if (!oldData?.success) return oldData;
                return {
                  ...oldData,
                  data: {
                    ...oldData.data,
                    recipes: oldData.data.recipes.filter(
                      recipe => recipe.id !== recipeId,
                    ),
                  },
                };
              });
            } else {
              throw new Error(
                result.errorMessage || '레시피 삭제에 실패했습니다.',
              );
            }
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : '알 수 없는 오류가 발생했습니다.';
            Alert.alert('오류', message);
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[backgroundStyle, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.statusText}>레시피를 불러오는 중입니다...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[backgroundStyle, styles.centered]}>
        <Text style={styles.errorText}>오류: {error.message}</Text>
      </SafeAreaView>
    );
  }

  const hasRecipes =
    allRecipes?.success &&
    allRecipes.data.recipes &&
    allRecipes.data.recipes.length > 0;

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar barStyle={'dark-content'} />
      <View style={styles.container}>
        {!hasRecipes && <Text style={styles.title}>🍳🙋‍♂️</Text>}

        {hasRecipes ? (
          <FlatList
            data={allRecipes.data.recipes}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.recipeItem}>
                <Pressable
                  style={styles.recipeTitleContainer}
                  onPress={() => {
                    trackEvent('recipe_item_click');
                    navigation.navigate('MenuList', {
                      recipeId: item.id,
                      recipeTitle: item.title,
                    });
                  }}
                >
                  <Text style={styles.recipeTitle}>{item.title}</Text>
                  <Text style={styles.recipeMenuCount}>
                    {item.menus.length} 메뉴
                  </Text>
                </Pressable>
                <View style={styles.recipeActions}>
                  <Pressable
                    onPress={() => handleEditRecipeTitlePress(item)}
                    style={styles.iconButton}
                  >
                    <Icon name="edit" size={24} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteRecipe(item.id)}
                    style={styles.iconButton}
                  >
                    <Icon name="delete" size={24} color={colors.point} />
                  </Pressable>
                </View>
              </View>
            )}
          />
        ) : (
          <View style={styles.noRecipesContainer}>
            <Text style={styles.noRecipesText}>
              레시피가 없습니다. 새 레시피를 등록해보세요!
            </Text>
            <Pressable
              style={styles.uploadButton}
              onPress={() => {
                trackEvent('no_recipe_upload_button_click');
                navigation.navigate('Upload');
              }}
            >
              <Text style={styles.uploadButtonText}>새 레시피 업로드</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={styles.fab}
          onPress={() => {
            trackEvent('fab_upload_button_click');
            navigation.navigate('Upload');
          }}
        >
          <Icon name="add" size={28} color={colors.white} />
        </Pressable>

        <Modal
          animationType="slide"
          transparent={true}
          visible={isEditingRecipeTitleModalVisible}
          onRequestClose={() => setIsEditingRecipeTitleModalVisible(false)}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>레시피 제목 수정</Text>
              <TextInput
                style={styles.input}
                placeholder="레시피 제목"
                value={editingRecipeTitle}
                onChangeText={setEditingRecipeTitle}
                placeholderTextColor={colors.gray}
              />
              <View style={styles.modalButtonContainer}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setIsEditingRecipeTitleModalVisible(false)}
                  disabled={updateRecipeTitleMutation.isPending}
                >
                  <Text style={styles.modalButtonText}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleUpdateRecipeTitle}
                  disabled={updateRecipeTitleMutation.isPending}
                >
                  <Text style={styles.modalButtonText}>저장</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

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
    ...typography.title,
    textAlign: 'center',
    marginBottom: 24,
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
  recipeItem: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeTitleContainer: {
    flex: 1,
    marginRight: 10,
  },
  recipeTitle: {
    ...typography.subtitle,
  },
  recipeMenuCount: {
    ...typography.body,
    color: colors.gray,
    marginTop: 4,
  },
  recipeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    padding: 5,
  },
  noRecipesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noRecipesText: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: 20,
    color: colors.gray,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  uploadButtonText: {
    ...typography.subtitle,
    color: colors.text,
  },
  fab: {
    position: 'absolute',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    right: 24,
    bottom: 24,
    backgroundColor: colors.primary,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalView: {
    margin: 20,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%',
  },
  modalTitle: {
    ...typography.title,
    marginBottom: 20,
  },
  input: {
    ...typography.body,
    height: 50,
    borderColor: colors.gray,
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 15,
    width: '100%',
    borderRadius: 10,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.gray,
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    ...typography.subtitle,
    color: colors.white,
  },
});

export default RecipeListScreen;
