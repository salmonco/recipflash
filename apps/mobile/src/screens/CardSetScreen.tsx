import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu } from '../models/Menu';

type RootStackParamList = {
  MenuList: { recipeId: number; recipeTitle: string };
  CardSet: { menus: Menu[] };
};

type CardSetScreenProps = NativeStackScreenProps<RootStackParamList, 'CardSet'>;

const { width } = Dimensions.get('window');

function CardSetScreen({ route }: CardSetScreenProps): React.JSX.Element {
  const { menus } = route.params;
  const isDarkMode = useColorScheme() === 'dark';
  const [flipped, setFlipped] = useState(menus.map(() => false));
  const [flipAnimations] = useState(menus.map(() => new Animated.Value(0)));

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#333' : '#F3F3F3',
    flex: 1,
  };

  const flipCard = (index: number) => {
    const newFlipped = [...flipped];
    newFlipped[index] = !newFlipped[index];
    setFlipped(newFlipped);

    Animated.spring(flipAnimations[index], {
      toValue: newFlipped[index] ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  };

  const renderItem = ({ item, index }: { item: Menu; index: number }) => {
    const frontInterpolate = flipAnimations[index].interpolate({
      inputRange: [0, 180],
      outputRange: ['0deg', '180deg'],
    });

    const backInterpolate = flipAnimations[index].interpolate({
      inputRange: [0, 180],
      outputRange: ['180deg', '360deg'],
    });

    const frontAnimatedStyle = {
      transform: [{ rotateY: frontInterpolate }],
    };

    const backAnimatedStyle = {
      transform: [{ rotateY: backInterpolate }],
    };

    return (
      <View style={styles.cardContainer}>
        <TouchableOpacity onPress={() => flipCard(index)}>
          <Animated.View
            style={[styles.card, styles.cardFront, frontAnimatedStyle]}
          >
            <Text style={styles.cardText}>{item.name}</Text>
          </Animated.View>
          <Animated.View
            style={[styles.card, styles.cardBack, backAnimatedStyle]}
          >
            <Text style={styles.cardText}>{item.ingredients}</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <FlatList
        data={menus}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: width * 0.8,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
    borderRadius: 10,
  },
  cardFront: {
    backgroundColor: '#fff',
  },
  cardBack: {
    backgroundColor: '#f0f0f0',
    position: 'absolute',
    top: 0,
  },
  cardText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default CardSetScreen;
