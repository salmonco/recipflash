import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
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
import { Menu } from '../models/Menu';
import { SuccessRecipeResponse, trpc } from '../trpc';

type RootStackParamList = {
  RecipeList: undefined;
  MenuList: { recipeId: number; recipeTitle: string };
  CardSet: { menus: Menu[] };
};

type MenuListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'MenuList'
>;

// Type predicate function
function isSuccessRecipeResponse(data: any): data is SuccessRecipeResponse {
  return data && data.success === true && data.recipe !== undefined;
}

function MenuListScreen({ route }: MenuListScreenProps): React.JSX.Element {
  const { recipeId, recipeTitle } = route.params;
  const isDarkMode = useColorScheme() === 'dark';
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, isLoading, error, refetch } = trpc.getRecipeById.useQuery({
    id: recipeId,
  });
  const utils = trpc.useUtils();

  // State for editing
  const [isEditingModalVisible, setIsEditingModalVisible] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [editingMenuName, setEditingMenuName] = useState('');
  const [editingMenuIngredients, setEditingMenuIngredients] = useState('');

  // State for adding a new menu
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuIngredients, setNewMenuIngredients] = useState('');

  const updateMenuMutation = trpc.updateMenu.useMutation();
  const deleteMenuMutation = trpc.deleteMenu.useMutation();
  const createMenuMutation = trpc.createMenu.useMutation();

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#333' : '#F3F3F3',
    flex: 1,
  };

  const handleRandomMemorization = () => {
    if (data?.success && data.recipe.menus.length > 0) {
      const shuffledMenus = [...data.recipe.menus].sort(
        () => Math.random() - 0.5,
      );
      navigation.navigate('CardSet', { menus: shuffledMenus });
    }
  };

  // Refetch data when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const handleEditPress = (menu: Menu) => {
    setEditingMenuId(menu.id);
    setEditingMenuName(menu.name);
    setEditingMenuIngredients(menu.ingredients);
    setIsEditingModalVisible(true);
  };

  const handleUpdateMenu = async () => {
    if (editingMenuId === null) {
      Alert.alert('오류', '수정할 메뉴를 선택해주세요.');
      return;
    }

    try {
      const result = await updateMenuMutation.mutateAsync({
        id: editingMenuId,
        name: editingMenuName,
        ingredients: editingMenuIngredients,
      });

      if (result.success) {
        Alert.alert('성공', '메뉴가 성공적으로 수정되었습니다!');
        // Update the cache directly
        utils.getRecipeById.setData({ id: recipeId }, oldData => {
          if (!isSuccessRecipeResponse(oldData)) return oldData;
          return {
            ...oldData,
            recipe: {
              ...oldData.recipe,
              menus: oldData.recipe.menus.map(menu =>
                menu.id === editingMenuId
                  ? {
                      ...menu,
                      name: editingMenuName,
                      ingredients: editingMenuIngredients,
                    }
                  : menu,
              ),
            },
          };
        });
        // No need to call refetch() here as cache is updated
        setIsEditingModalVisible(false);
      } else {
        throw new Error(result.error || '메뉴 수정에 실패했습니다.');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      Alert.alert('오류', message);
    }
  };

  const handleDeleteMenu = (menuId: number) => {
    Alert.alert('메뉴 삭제', '이 메뉴를 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await deleteMenuMutation.mutateAsync({
              id: menuId,
            });
            if (result.success) {
              Alert.alert('성공', '메뉴가 삭제되었습니다.');
              // Update the cache directly
              utils.getRecipeById.setData({ id: recipeId }, oldData => {
                if (!isSuccessRecipeResponse(oldData)) return oldData;
                return {
                  ...oldData,
                  recipe: {
                    ...oldData.recipe,
                    menus: oldData.recipe.menus.filter(
                      menu => menu.id !== menuId,
                    ),
                  },
                };
              });
              // No need to call refetch() here as cache is updated
            } else {
              throw new Error(result.error || '메뉴 삭제에 실패했습니다.');
            }
          } catch (err) {
            const message =
              err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
            Alert.alert('오류', message);
          }
        },
      },
    ]);
  };

  const handleAddMenu = async () => {
    try {
      const result = await createMenuMutation.mutateAsync({
        recipeId,
        name: newMenuName,
        ingredients: newMenuIngredients,
      });

      if (result.success) {
        Alert.alert('성공', '메뉴가 추가되었습니다!');
        utils.getRecipeById.setData({ id: recipeId }, oldData => {
          if (!isSuccessRecipeResponse(oldData)) return oldData;
          return {
            ...oldData,
            recipe: {
              ...oldData.recipe,
              menus: [...oldData.recipe.menus, result.menu],
            },
          };
        });
        setIsAddModalVisible(false);
        setNewMenuName('');
        setNewMenuIngredients('');
      } else {
        throw new Error(result.error || '메뉴 추가에 실패했습니다.');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      Alert.alert('오류', message);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[backgroundStyle, styles.centered]}>
        <ActivityIndicator size="large" />
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

  if (!data?.success) {
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
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        <Text style={styles.title}>{recipeTitle}</Text>
        <View style={styles.buttonContainer}>
          <Button
            onPress={handleRandomMemorization}
            title="랜덤 암기"
          />
        </View>
        {data.recipe?.menus && data.recipe.menus.length > 0 ? (
          <FlatList
            data={data.recipe.menus}
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
                      <Icon name="edit" size={24} color="#007AFF" />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteMenu(item.id)}
                      style={styles.iconButton}
                    >
                      <Icon name="delete" size={24} color="red" />
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.cardIngredients}>{item.ingredients}</Text>
              </View>
            )}
          />
        ) : (
          <Text style={styles.noMenusText}>
            이 레시피에 대한 메뉴가 없습니다.
          </Text>
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
              />
              <TextInput
                style={styles.input}
                placeholder="재료"
                value={editingMenuIngredients}
                onChangeText={setEditingMenuIngredients}
                multiline
              />
              <View style={styles.modalButtonContainer}>
                <Button
                  title="취소"
                  onPress={() => setIsEditingModalVisible(false)}
                  disabled={updateMenuMutation.isPending}
                  color="gray"
                />
                <Button
                  title="저장"
                  onPress={handleUpdateMenu}
                  disabled={updateMenuMutation.isPending}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Add Menu Modal */}
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
              />
              <TextInput
                style={styles.input}
                placeholder="재료"
                value={newMenuIngredients}
                onChangeText={setNewMenuIngredients}
                multiline
              />
              <View style={styles.modalButtonContainer}>
                <Button
                  title="취소"
                  onPress={() => setIsAddModalVisible(false)}
                  disabled={createMenuMutation.isPending}
                  color="gray"
                />
                <Button
                  title="추가"
                  onPress={handleAddMenu}
                  disabled={createMenuMutation.isPending}
                />
              </View>
            </View>
          </View>
        </Modal>

        <Pressable
          style={styles.fab}
          onPress={() => setIsAddModalVisible(true)}
        >
          <Icon name="add" size={30} color="white" />
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
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  buttonContainer: {
    marginBottom: 16,
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
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardIngredients: {
    fontSize: 14,
    color: '#555',
  },
  menuActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    padding: 5,
  },
  noMenusText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
    color: '#666',
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
  fab: {
    position: 'absolute',
    right: 30,
    bottom: 30,
    backgroundColor: '#007AFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
});

export default MenuListScreen;
