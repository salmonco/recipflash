import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Recipe } from '../models/Recipe';
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
  const isDarkMode = useColorScheme() === 'dark';
  const {
    data: allRecipes,
    isLoading,
    error,
    refetch,
  } = trpc.recipe.getAllRecipes.useQuery();
  const utils = trpc.useUtils();

  // State for editing recipe title
  const [
    isEditingRecipeTitleModalVisible,
    setIsEditingRecipeTitleModalVisible,
  ] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [editingRecipeTitle, setEditingRecipeTitle] = useState('');

  const updateRecipeTitleMutation = trpc.recipe.updateRecipeTitle.useMutation();
  const deleteRecipeMutation = trpc.recipe.deleteRecipe.useMutation();

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#333' : '#F3F3F3',
    flex: 1,
  };

  // Refetch data when the screen comes into focus
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

        // Update the cache directly
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
        // No need to call refetch() here as cache is updated
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
              // Update the cache directly
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
        <ActivityIndicator size="large" />
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

  if (!allRecipes?.success) {
    return (
      <SafeAreaView style={[backgroundStyle, styles.centered]}>
        <Text style={styles.errorText}>
          레시피가 없습니다. 새 레시피를 등록해보세요!
        </Text>
      </SafeAreaView>
    );
  }

  const hasRecipes =
    allRecipes.data.recipes && allRecipes.data.recipes.length > 0;

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        <Text style={styles.title}>레시피</Text>

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
                    <Icon name="edit" size={24} color="#007AFF" />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteRecipe(item.id)}
                    style={styles.iconButton}
                  >
                    <Icon name="delete" size={24} color="red" />
                  </Pressable>
                </View>
              </View>
            )}
          />
        ) : (
          <View style={styles.noRecipesContainer}>
            <Text style={styles.noRecipesText}>
              메뉴가 없습니다. 새 메뉴를 등록해보세요!
            </Text>
            <Button
              title="새 레시피 업로드"
              onPress={() => {
                trackEvent('no_recipe_upload_button_click');
                navigation.navigate('Upload');
              }}
            />
          </View>
        )}

        {/* Floating Action Button */}
        <Pressable
          style={styles.fab}
          onPress={() => {
            trackEvent('fab_upload_button_click');
            navigation.navigate('Upload');
          }}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>

        {/* Edit Recipe Title Modal */}
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
              />
              <View style={styles.modalButtonContainer}>
                <Button
                  title="취소"
                  onPress={() => setIsEditingRecipeTitleModalVisible(false)}
                  disabled={updateRecipeTitleMutation.isPending}
                  color="gray"
                />
                <Button
                  title="저장"
                  onPress={handleUpdateRecipeTitle}
                  disabled={updateRecipeTitleMutation.isPending}
                />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeTitleContainer: {
    flex: 1,
    marginRight: 10,
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
  recipeActions: {
    flexDirection: 'row',
    gap: 5,
  },
  iconButton: {
    padding: 5,
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
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
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
  },
  modalTitle: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
    width: 250,
    borderRadius: 5,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
});

export default RecipeListScreen;
