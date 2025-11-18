import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu } from '../models/Menu';
import { colors, typography } from '../styles/theme';
import { trackEvent } from '../utils/tracker';

type RootStackParamList = {
  MenuList: { recipeId: number; recipeTitle: string };
  CardSet: { menus: Menu[] };
};

type CardSetScreenProps = NativeStackScreenProps<RootStackParamList, 'CardSet'>;

const { width } = Dimensions.get('window');

const CardSetScreen = ({ route }: CardSetScreenProps) => {
  const { menus } = route.params;
  const [flipped, setFlipped] = useState(menus.map(() => false));
  const [flipAnimations] = useState(menus.map(() => new Animated.Value(0)));
  const [instructionAnimation] = useState(new Animated.Value(1));
  const [currentIndex, setCurrentIndex] = useState(0);

  const onViewableItemsChanged = ({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  };

  const viewabilityConfig = { itemVisiblePercentThreshold: 50 };

  useEffect(() => {
    const blinkAndFade = () => {
      Animated.sequence([
        Animated.timing(instructionAnimation, {
          toValue: 0.5,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(instructionAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(instructionAnimation, {
          toValue: 0.5,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(instructionAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(instructionAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start();
    };

    blinkAndFade();
  }, [instructionAnimation]);

  const backgroundStyle = {
    backgroundColor: colors.background,
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
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            trackEvent('card_flip', { menuId: item.id, menuName: item.name });
            flipCard(index);
          }}
        >
          <Animated.View
            style={[styles.card, styles.cardFront, frontAnimatedStyle]}
          >
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardText}>{item.name}</Text>
            </View>
          </Animated.View>
          <Animated.View
            style={[styles.card, styles.cardBack, backAnimatedStyle]}
          >
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardText}>{item.ingredients.join(', ')}</Text>
            </View>
          </Animated.View>
        </TouchableOpacity>
        <Animated.Text
          style={[styles.instructionText, { opacity: instructionAnimation }]}
        >
          카드를 터치하여 뒤집으세요
        </Animated.Text>
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
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
      <View style={styles.counterContainer}>
        <Text style={styles.counterText}>
          {currentIndex + 1} / {menus.length}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  card: {
    width: width * 0.85,
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
  },
  cardFront: {
    backgroundColor: colors.white,
  },
  cardBack: {
    backgroundColor: colors.primary,
    position: 'absolute',
    top: 0,
  },
  cardText: {
    ...typography.title,
    textAlign: 'center',
  },
  cardTextContainer: {
    padding: 20,
  },
  instructionText: {
    ...typography.body,
    color: colors.gray,
    marginTop: 20,
    position: 'absolute',
    bottom: 100,
  },
  counterContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  counterText: {
    ...typography.subtitle,
    color: colors.gray,
  },
});

export default CardSetScreen;
