import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu } from '../models/Menu';
import { trpc } from '../trpc';

type RootStackParamList = {
  RecipeList: undefined;
  MenuList: { recipeId: number; recipeTitle: string };
};

type MenuListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'MenuList'
>;

function MenuListScreen({ route }: MenuListScreenProps): React.JSX.Element {
  const { recipeId, recipeTitle } = route.params;
  const isDarkMode = useColorScheme() === 'dark';
  const { data, isLoading, error, refetch } = trpc.getRecipeById.useQuery({
    id: recipeId,
  });

  // State for editing
  const [isEditingModalVisible, setIsEditingModalVisible] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [editingMenuName, setEditingMenuName] = useState('');
  const [editingMenuIngredients, setEditingMenuIngredients] = useState('');

  const updateMenuMutation = trpc.updateMenu.useMutation();

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#333' : '#F3F3F3',
    flex: 1,
  };

  const handleEditPress = (menu: Menu) => {
    setEditingMenuId(menu.id);
    setEditingMenuName(menu.name);
    setEditingMenuIngredients(menu.ingredients);
    setIsEditingModalVisible(true);
  };

  const handleUpdateMenu = async () => {
    if (editingMenuId === null) {
      Alert.alert('Error', 'No menu selected for editing.');
      return;
    }

    try {
      const result = await updateMenuMutation.mutateAsync({
        id: editingMenuId,
        name: editingMenuName,
        ingredients: editingMenuIngredients,
      });

      if (result.success) {
        Alert.alert('Success', 'Menu item updated successfully!');
        refetch(); // Refetch the recipe to get updated menus
        setIsEditingModalVisible(false);
      } else {
        throw new Error('Failed to update menu item.');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unknown error occurred';
      Alert.alert('Error', message);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[backgroundStyle, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text style={styles.statusText}>Loading menus...</Text>
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
          No data or failed to fetch recipe menus.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        <Text style={styles.title}>{recipeTitle}</Text>
        {data.recipe?.menus && data.recipe.menus.length > 0 ? (
          <FlatList
            data={data.recipe.menus}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardIngredients}>{item.ingredients}</Text>
                <Button title="Edit" onPress={() => handleEditPress(item)} />
              </View>
            )}
          />
        ) : (
          <Text style={styles.noMenusText}>
            No menus found for this recipe.
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
              <Text style={styles.modalTitle}>Edit Menu Item</Text>
              <TextInput
                style={styles.input}
                placeholder="Menu Name"
                value={editingMenuName}
                onChangeText={setEditingMenuName}
              />
              <TextInput
                style={styles.input}
                placeholder="Ingredients"
                value={editingMenuIngredients}
                onChangeText={setEditingMenuIngredients}
                multiline
              />
              <View style={styles.modalButtonContainer}>
                <Button
                  title="Save"
                  onPress={handleUpdateMenu}
                  disabled={updateMenuMutation.isPending}
                />
                <Button
                  title="Cancel"
                  onPress={() => setIsEditingModalVisible(false)}
                  disabled={updateMenuMutation.isPending}
                />
              </View>
            </View>
          </View>
        </Modal>
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
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardIngredients: {
    fontSize: 16,
    color: '#555',
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
});

export default MenuListScreen;
