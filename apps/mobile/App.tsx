import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import DocumentPicker, { types } from 'react-native-document-picker';
import { trpc } from './src/trpc';

// Define the type for a single menu item
interface Menu {
  id: number;
  name: string;
  ingredients: string;
}

// Define the type for the recipe object returned from the backend
interface Recipe {
  id: number;
  title: string;
  menus: Menu[];
}

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:4000/trpc', // Adjust to your backend URL
    }),
  ],
});

function AppContent(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for editing
  const [isEditingModalVisible, setIsEditingModalVisible] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [editingMenuName, setEditingMenuName] = useState('');
  const [editingMenuIngredients, setEditingMenuIngredients] = useState('');

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

    setIsLoading(true);
    setError(null);

    try {
      const result = await trpcClient.updateMenu.mutate({
        id: editingMenuId,
        name: editingMenuName,
        ingredients: editingMenuIngredients,
      });

      if (result.success) {
        Alert.alert('Success', 'Menu item updated successfully!');
        // Update the local recipe state
        setRecipe(prevRecipe => {
          if (!prevRecipe) return null;
          return {
            ...prevRecipe,
            menus: prevRecipe.menus.map(menu =>
              menu.id === editingMenuId
                ? {
                    ...menu,
                    name: editingMenuName,
                    ingredients: editingMenuIngredients,
                  }
                : menu,
            ),
          };
        });
        setIsEditingModalVisible(false);
      } else {
        throw new Error('Failed to update menu item.');
      }
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
          Upload a recipe PDF to generate menus automatically.
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            title="Upload Recipe PDF"
            onPress={handleUpload}
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
          <ScrollView style={styles.scrollView}>
            {recipe.menus.map((menu, index) => (
              <View key={menu.id} style={styles.card}>
                <Text style={styles.cardIndex}>{index + 1}</Text>
                <Text style={styles.cardName}>{menu.name}</Text>
                <Text style={styles.cardIngredients}>{menu.ingredients}</Text>
                <Button title="Edit" onPress={() => handleEditPress(menu)} />
              </View>
            ))}
          </ScrollView>
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
                  disabled={isLoading}
                />
                <Button
                  title="Cancel"
                  onPress={() => setIsEditingModalVisible(false)}
                  disabled={isLoading}
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
  scrollView: {
    marginTop: 16,
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
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
  cardIndex: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#CCC',
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

function App(): React.JSX.Element {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
