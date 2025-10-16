import React, {useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  Button,
  ActivityIndicator,
  Alert,
} from 'react-native';
import DocumentPicker, {types} from 'react-native-document-picker';

// Define the type for a single flashcard
interface Flashcard {
  id: number;
  front: string;
  back: string;
}

// Define the type for the recipe object returned from the backend
interface Recipe {
  id: number;
  title: string;
  cards: Flashcard[];
}

function App(): React.JSX.Element {
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
        throw new Error(errData.details || 'Failed to upload and process file.');
      }

      const result: Recipe = await response.json();
      setRecipe(result);

    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        // User cancelled the picker
        console.log('User cancelled the document picker');
      } else {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
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
        <Text style={styles.subtitle}>Upload a recipe PDF to generate flashcards automatically.</Text>
        
        <View style={styles.buttonContainer}>
            <Button title="Upload Recipe PDF" onPress={handleUpload} disabled={isLoading} />
        </View>

        {isLoading && (
            <View style={styles.statusContainer}>
                <ActivityIndicator size="large" />
                <Text style={styles.statusText}>Processing PDF and generating cards...</Text>
            </View>
        )}

        {error && (
            <View style={styles.statusContainer}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        )}

        {recipe && (
          <ScrollView style={styles.scrollView}>
            <Text style={styles.recipeTitle}>Flashcards for: {recipe.title}</Text>
            {recipe.cards.map((card, index) => (
              <View key={card.id} style={styles.card}>
                <Text style={styles.cardIndex}>{index + 1}</Text>
                <Text style={styles.cardFront}>Front: {card.front}</Text>
                <Text style={styles.cardBack}>Back: {card.back}</Text>
              </View>
            ))}
          </ScrollView>
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
  cardFront: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardBack: {
    fontSize: 16,
    color: '#555',
  },
});

export default App;