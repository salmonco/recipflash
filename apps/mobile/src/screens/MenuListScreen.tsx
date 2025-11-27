import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
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
import TagInput from '../components/TagInput';
import { Menu } from '../models/Menu';
import { colors, typography } from '../styles/theme';
import { trpc } from '../trpc';
import { showToast } from '../utils/toast/showToast';
import { trackEvent } from '../utils/tracker';

type RootStackParamList = {
  RecipeList: undefined;
  MenuList: { recipeId: number; recipeTitle: string };
  CardSet: { menus: Menu[] };
};

type MenuListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'MenuList'
>;

const MenuListScreen = ({ route }: MenuListScreenProps) => {
  const { recipeId, recipeTitle } = route.params;
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    data: recipeById,
    isLoading,
    error,
    refetch,
  } = trpc.recipe.getRecipeById.useQuery({
    id: recipeId,
  });
  const utils = trpc.useUtils();

  const [isEditingModalVisible, setIsEditingModalVisible] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [editingMenuName, setEditingMenuName] = useState('');
  const [editingMenuIngredients, setEditingMenuIngredients] = useState<
    string[]
  >([]);

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuIngredients, setNewMenuIngredients] = useState<string[]>([]);

  const updateMenuMutation = trpc.menu.updateMenu.useMutation();
  const deleteMenuMutation = trpc.menu.deleteMenu.useMutation();
  const createMenuMutation = trpc.menu.createMenu.useMutation();

  const backgroundStyle = {
    backgroundColor: colors.background,
    flex: 1,
  };

  const handleRandomMemorization = () => {
    trackEvent('random_memorization_click');
    if (recipeById?.success && recipeById.data.menus.length > 0) {
      const shuffledMenus = [...recipeById.data.menus].sort(
        () => Math.random() - 0.5,
      );
      navigation.navigate('CardSet', { menus: shuffledMenus });
    }
  };

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const handleEditPress = (menu: Menu) => {
    trackEvent('edit_menu_click');
    setEditingMenuId(menu.id);
    setEditingMenuName(menu.name);
    setEditingMenuIngredients(menu.ingredients);
    setIsEditingModalVisible(true);
  };

  const handleUpdateMenu = async () => {
    trackEvent('edit_menu_save');
    if (editingMenuId === null) {
      showToast('오류', '수정할 메뉴를 선택해주세요.', { type: 'error' });
      return;
    }

    try {
      const result = await updateMenuMutation.mutateAsync({
        id: editingMenuId,
        name: editingMenuName,
        ingredients: editingMenuIngredients, // Removed .join(', ')
      });

      if (result.success) {
        showToast('성공', '메뉴가 성공적으로 수정되었습니다!', {
          type: 'success',
        });
        utils.recipe.getRecipeById.setData({ id: recipeId }, oldData => {
          if (!oldData?.success) return oldData;
          return {
            ...oldData,
            data: {
              ...oldData.data,
              menus: oldData.data.menus.map(menu =>
                menu.id === editingMenuId
                  ? {
                      ...menu,
                      name: editingMenuName,
                      ingredients: editingMenuIngredients, // Updated to array
                    }
                  : menu,
              ),
            },
          };
        });
        setIsEditingModalVisible(false);
      } else {
        throw new Error(result.errorMessage || '메뉴 수정에 실패했습니다.');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showToast('오류', message, { type: 'error' });
    }
  };

  const handleDeleteMenu = (menuId: number) => {
    trackEvent('delete_menu_click');
    Alert.alert('메뉴 삭제', '이 메뉴를 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await deleteMenuMutation.mutateAsync({ id: menuId });
            if (result.success) {
              showToast('성공', '메뉴가 삭제되었습니다.', {
                type: 'success',
              });
              utils.recipe.getRecipeById.setData({ id: recipeId }, oldData => {
                if (!oldData?.success) return oldData;
                return {
                  ...oldData,
                  data: {
                    ...oldData.data,
                    menus: oldData.data.menus.filter(
                      menu => menu.id !== menuId,
                    ),
                  },
                };
              });
            } else {
              throw new Error(
                result.errorMessage || '메뉴 삭제에 실패했습니다.',
              );
            }
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : '알 수 없는 오류가 발생했습니다.';
            showToast('오류', message, { type: 'error' });
          }
        },
      },
    ]);
  };

  const handleAddMenu = async () => {
    trackEvent('add_menu_save');
    try {
      const result = await createMenuMutation.mutateAsync({
        recipeId,
        name: newMenuName,
        ingredients: newMenuIngredients, // Removed .join(', ')
      });

      if (result.success) {
        showToast('성공', '메뉴가 추가되었습니다!', { type: 'success' });
        utils.recipe.getRecipeById.setData({ id: recipeId }, oldData => {
          if (!oldData?.success) return oldData;
          return {
            ...oldData,
            data: {
              ...oldData.data,
              menus: [...oldData.data.menus, result.data],
            },
          };
        });
        setIsAddModalVisible(false);
        setNewMenuName('');
        setNewMenuIngredients([]); // Clear as array
      } else {
        throw new Error(result.errorMessage || '메뉴 추가에 실패했습니다.');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showToast('오류', message, { type: 'error' });
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[backgroundStyle, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.statusText}>메뉴를 불러오는 중입니다...</Text>
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

  if (!recipeById?.success) {
    return (
      <SafeAreaView style={[backgroundStyle, styles.centered]}>
        <Text style={styles.errorText}>
          데이터가 없거나 레시피 메뉴를 가져오지 못했습니다.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>{recipeTitle}</Text>
          <Pressable
            style={styles.randomButton}
            onPress={handleRandomMemorization}
          >
            <Text style={styles.randomButtonText}>랜덤 암기</Text>
          </Pressable>
        </View>
        {recipeById.data.menus.length > 0 ? (
          <FlatList
            data={recipeById.data.menus}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <View style={styles.menuActions}>
                    <Pressable
                      onPress={() => handleEditPress(item)}
                      style={styles.iconButton}
                    >
                      <Icon name="edit" size={24} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteMenu(item.id)}
                      style={styles.iconButton}
                    >
                      <Icon name="delete" size={24} color={colors.point} />
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.cardIngredients}>
                  {item.ingredients.join(', ')}
                </Text>
              </View>
            )}
          />
        ) : (
          <View style={styles.noMenusContainer}>
            <Text style={styles.noMenusText}>
              이 레시피에 대한 메뉴가 없습니다.
            </Text>
          </View>
        )}

        <Modal
          animationType="slide"
          transparent={true}
          visible={isEditingModalVisible}
          onRequestClose={() => setIsEditingModalVisible(false)}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>메뉴 수정</Text>
              <TextInput
                style={styles.input}
                placeholder="메뉴 이름"
                value={editingMenuName}
                onChangeText={setEditingMenuName}
                placeholderTextColor={colors.gray}
              />
              <TagInput
                value={editingMenuIngredients}
                onChange={setEditingMenuIngredients}
                placeholder="재료"
              />
              <View style={styles.modalButtonContainer}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    trackEvent('edit_menu_cancel');
                    setIsEditingModalVisible(false);
                  }}
                  disabled={updateMenuMutation.isPending}
                >
                  <Text style={styles.modalButtonText}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleUpdateMenu}
                  disabled={updateMenuMutation.isPending}
                >
                  <Text style={styles.modalButtonText}>저장</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          animationType="slide"
          transparent={true}
          visible={isAddModalVisible}
          onRequestClose={() => setIsAddModalVisible(false)}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>새 메뉴 추가</Text>
              <TextInput
                style={styles.input}
                placeholder="메뉴 이름"
                value={newMenuName}
                onChangeText={setNewMenuName}
                placeholderTextColor={colors.gray}
              />
              <TagInput
                value={newMenuIngredients}
                onChange={setNewMenuIngredients}
                placeholder="재료"
              />
              <View style={styles.modalButtonContainer}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    trackEvent('add_menu_cancel');
                    setIsAddModalVisible(false);
                  }}
                  disabled={createMenuMutation.isPending}
                >
                  <Text style={styles.modalButtonText}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleAddMenu}
                  disabled={createMenuMutation.isPending}
                >
                  <Text style={styles.modalButtonText}>추가</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Pressable
          style={styles.fab}
          onPress={() => {
            trackEvent('fab_add_menu_click');
            setIsAddModalVisible(true);
          }}
        >
          <Icon name="add" size={28} color={colors.white} />
        </Pressable>
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    ...typography.title,
    flex: 1,
    marginRight: 16,
    maxHeight: 100,
  },
  randomButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    flexShrink: 0,
  },
  randomButtonText: {
    ...typography.subtitle,
    color: colors.text,
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
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardName: {
    ...typography.subtitle,
    flex: 1,
  },
  cardIngredients: {
    ...typography.body,
    color: colors.gray,
  },
  menuActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    padding: 5,
  },
  noMenusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noMenusText: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
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
    marginBottom: 15,
    paddingHorizontal: 15,
    width: '100%',
    borderRadius: 10,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
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
});

export default MenuListScreen;
