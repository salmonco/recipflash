import { API_URL } from '@env';
import auth from '@react-native-firebase/auth';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { colors, typography } from '../styles/theme';

interface Menu {
  name: string;
  ingredients: string;
}

interface ProgressData {
  type:
    | 'ocr_start'
    | 'ocr_complete'
    | 'llm_start'
    | 'progress'
    | 'complete'
    | 'error'
    | 'recipe_created';
  page?: number;
  total_pages?: number;
  progress?: number;
  menus?: Menu[];
  page_time?: number;
  recipeId?: number;
  totalMenus?: number;
  message?: string;
}

type ProcessingStage = 'idle' | 'ocr' | 'llm' | 'complete';

type RootStackParamList = {
  Upload: undefined;
  RecipeList: undefined;
  MenuList: { recipeId: number; recipeTitle: string };
};

type StreamingUploadScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Upload'
>;

// --- AnimatedMenuItem Component ---

const MenuItem = ({ menu, index }: { menu: Menu; index: number }) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: 1,
      duration: 400,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, [animValue, index]);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  return (
    <Animated.View
      style={[
        styles.menuItem,
        { opacity: animValue, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.menuHeader}>
        <Text style={styles.menuNumber}>{index + 1}</Text>
        <Text style={styles.menuName} numberOfLines={1}>
          {menu.name}
        </Text>
      </View>
      <Text style={styles.menuIngredients} numberOfLines={2}>
        {menu.ingredients}
      </Text>
    </Animated.View>
  );
};

// --- Main Screen Component ---

const StreamingUploadScreen = ({ navigation }: StreamingUploadScreenProps) => {
  // --- State ---
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadComplete, setIsUploadComplete] = useState(false);
  const [recipeTitle, setRecipeTitle] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [_recipeId, setRecipeId] = useState<number | null>(null);
  const [processingStage, setProcessingStage] =
    useState<ProcessingStage>('idle');
  const [firstResultTime, setFirstResultTime] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  // --- Animations ---
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // --- Animation Effects ---
  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: progress,
      useNativeDriver: false, // 'width' is not supported by native driver
      bounciness: 10,
    }).start();
  }, [progress, progressAnim]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const onPressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  // --- Data Handling ---
  const handleStreamingUpload = async (
    uri: string,
    name: string,
    type: string,
  ) => {
    setIsUploading(true);
    setIsUploadComplete(false);
    const title = name.substring(0, name.lastIndexOf('.')) || '새로운 레시피';
    setRecipeTitle(title);
    setProgress(0);
    setCurrentPage(0);
    setMenus([]);
    setFirstResultTime(null);
    setStartTime(Date.now());
    setProcessingStage('idle');
    progressAnim.setValue(0);
    navigation.setOptions({
      headerRight: () => null,
      title: '레시피 생성 중...',
    });

    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert('인증 오류', '로그인이 필요합니다.');
        setIsUploading(false);
        return;
      }
      const token = await user.getIdToken();

      const formData = new FormData();
      formData.append('recipe', { uri, name, type });
      // 한글 파일명을 별도로 전송
      formData.append('fileName', name);

      const xhr = new XMLHttpRequest();
      let buffer = '';
      let processedResponseLength = 0;

      xhr.onprogress = () => {
        const newText = xhr.responseText.substring(processedResponseLength);
        processedResponseLength = xhr.responseText.length;

        buffer += newText;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr.trim()) {
              try {
                const data: ProgressData = JSON.parse(dataStr);
                handleSSEMessage(data);
              } catch (e) {
                console.error('Failed to parse SSE chunk:', dataStr, e);
              }
            }
          }
        }
      };

      xhr.onload = () => {
        if (buffer.startsWith('data: ')) {
          const dataStr = buffer.slice(6);
          if (dataStr.trim()) {
            try {
              const data: ProgressData = JSON.parse(dataStr);
              handleSSEMessage(data);
            } catch (e) {
              console.error('Failed to parse final SSE chunk:', dataStr, e);
            }
          }
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          console.error(
            'Upload failed with status:',
            xhr.status,
            xhr.responseText,
          );
          Alert.alert('업로드 실패', `서버 오류: ${xhr.status}`);
          setIsUploading(false);
          stopPulseAnimation();
        }
      };

      xhr.onerror = () => {
        console.error('Upload failed due to a network error.');
        Alert.alert('업로드 실패', '네트워크 오류가 발생했습니다.');
        setIsUploading(false);
        stopPulseAnimation();
      };

      xhr.open('POST', `${API_URL}/upload-recipe-stream-parallel`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    } catch (error) {
      console.error('Upload setup error:', error);
      Alert.alert(
        '업로드 실패',
        error instanceof Error ? error.message : '알 수 없는 오류',
      );
      setIsUploading(false);
      stopPulseAnimation();
    }
  };

  const handleSSEMessage = (data: ProgressData) => {
    switch (data.type) {
      case 'ocr_start':
        setProcessingStage('ocr');
        startPulseAnimation();
        break;
      case 'ocr_complete':
        setTotalPages(data.total_pages || 0);
        break;
      case 'llm_start':
        setProcessingStage('llm');
        break;
      case 'recipe_created':
        setRecipeId(data.recipeId || null);
        break;
      case 'progress':
        if (firstResultTime === null && startTime) {
          setFirstResultTime(Date.now() - startTime);
          stopPulseAnimation();
        }
        setCurrentPage(data.page || 0);
        setProgress(data.progress || 0);
        if (data.menus) {
          setMenus(prev => [...prev, ...data.menus!]);
        }
        break;
      case 'complete':
        setProcessingStage('complete');
        stopPulseAnimation();
        setIsUploadComplete(true);
        navigation.setOptions({
          title: recipeTitle,
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('RecipeList')}>
              <Text style={styles.doneButton}>완료</Text>
            </Pressable>
          ),
        });
        break;
      case 'error':
        Alert.alert('오류', data.message || '처리 중 오류가 발생했습니다');
        setIsUploading(false);
        stopPulseAnimation();
        break;
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.images],
        copyTo: 'cachesDirectory',
      });
      if (result.uri) {
        await handleStreamingUpload(
          result.uri,
          result.name || 'recipe.pdf',
          result.type || 'application/pdf',
        );
      }
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        console.error('Document picker error:', error);
        Alert.alert('파일 선택 오류', '파일을 선택할 수 없습니다.');
      }
    }
  };

  const getStageDisplay = () => {
    switch (processingStage) {
      case 'ocr':
        return {
          icon: '📄',
          title: 'OCR 처리 중',
          subtitle: '문서를 스캔하는 중입니다...',
          color: colors.primary,
        };
      case 'llm':
        return {
          icon: '🤖',
          title: 'AI 분석 중',
          subtitle: '메뉴를 분석하고 정리하는 중입니다...',
          color: colors.primary,
        };
      case 'complete':
        return {
          icon: '✅',
          title: '완료',
          subtitle: '모든 메뉴가 생성되었습니다!',
          color: '#34C759',
        };
      default:
        return {
          icon: '⏳',
          title: '준비 중...',
          subtitle: '',
          color: '#8E8E93',
        };
    }
  };

  const stageDisplay = getStageDisplay();
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // --- Render ---
  return (
    <View style={styles.container}>
      {!isUploading ? (
        <View style={styles.header}>
          <Text style={styles.title}>레시피 등록하기</Text>
          <Text style={styles.subtitle}>
            파일을 업로드만 하면 AI가 레시피를 만들어요!
          </Text>
          <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onPress={handlePickDocument}
            style={{ width: '100%', marginTop: 30 }}
          >
            <Animated.View
              style={[
                styles.uploadButton,
                { transform: [{ scale: buttonScale }] },
              ]}
            >
              <Text style={styles.uploadButtonText}>🍳 파일 선택하기</Text>
            </Animated.View>
          </Pressable>
        </View>
      ) : (
        <>
          {!isUploadComplete && (
            <View style={styles.progressContainer}>
              <Animated.View
                style={[
                  styles.stageIndicator,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Text style={styles.stageIcon}>{stageDisplay.icon}</Text>
                <View>
                  <Text
                    style={[styles.stageTitle, { color: stageDisplay.color }]}
                  >
                    {stageDisplay.title}
                  </Text>
                  {stageDisplay.subtitle && (
                    <Text style={styles.stageSubtitle}>
                      {stageDisplay.subtitle}
                    </Text>
                  )}
                </View>
              </Animated.View>

              {(processingStage === 'llm' || processingStage === 'ocr') &&
                totalPages > 0 && (
                  <View style={styles.pageProgressContainer}>
                    <View style={styles.pageProgressHeader}>
                      <Text style={styles.pageProgressText}>
                        페이지 {currentPage} / {totalPages}
                      </Text>
                      <Text style={styles.progressPercentage}>{progress}%</Text>
                    </View>
                    <View style={styles.progressBarContainer}>
                      <Animated.View
                        style={[styles.progressBar, { width: progressWidth }]}
                      />
                    </View>
                    {firstResultTime && (
                      <Text style={styles.statsText}>
                        ⚡ 첫 결과까지 {(firstResultTime / 1000).toFixed(1)}초
                      </Text>
                    )}
                  </View>
                )}

              {processingStage !== 'complete' && (
                <ActivityIndicator
                  size="large"
                  color={stageDisplay.color}
                  style={styles.spinner}
                />
              )}
            </View>
          )}

          <ScrollView
            style={styles.menuList}
            showsVerticalScrollIndicator={false}
          >
            {menus.length > 0 && (
              <View style={styles.menuListHeader}>
                <Text style={styles.menuListTitle}>
                  {isUploadComplete ? recipeTitle : '생성된 메뉴'}
                </Text>
                <View style={styles.menuCountBadge}>
                  <Text style={styles.menuCountText}>{menus.length}</Text>
                </View>
              </View>
            )}
            {menus.map((menu, index) => (
              <MenuItem key={menu.name + index} menu={menu} index={index} />
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: colors.background,
  },
  doneButton: {
    ...typography.subtitle,
    color: colors.primary,
    fontSize: 16,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.title,
    fontSize: 28,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    fontSize: 16,
    color: colors.gray,
    textAlign: 'center',
  },
  uploadButton: {
    backgroundColor: colors.primary,
    paddingVertical: 20,
    borderRadius: 99,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  uploadButtonText: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 18,
  },
  progressContainer: {
    marginBottom: 20,
  },
  stageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  stageIcon: {
    fontSize: 36,
    marginRight: 15,
  },
  stageTitle: {
    ...typography.subtitle,
  },
  stageSubtitle: {
    ...typography.body,
    color: colors.gray,
    marginTop: 2,
  },
  pageProgressContainer: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  pageProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pageProgressText: {
    ...typography.body,
    fontWeight: '600',
  },
  progressPercentage: {
    ...typography.subtitle,
    color: colors.primary,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: colors.background,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  statsText: {
    ...typography.body,
    fontSize: 13,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 15,
  },
  spinner: {
    marginTop: 10,
  },
  menuList: {
    flex: 1,
  },
  menuListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  menuListTitle: {
    ...typography.title,
    fontSize: 22,
  },
  menuCountBadge: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginLeft: 10,
  },
  menuCountText: {
    ...typography.body,
    color: colors.white,
    fontWeight: 'bold',
  },
  menuItem: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuNumber: {
    ...typography.subtitle,
    color: colors.primary,
    backgroundColor: colors.primary + '20',
    width: 36,
    height: 36,
    borderRadius: 18,
    textAlign: 'center',
    lineHeight: 36,
    marginRight: 12,
  },
  menuName: {
    ...typography.subtitle,
    flex: 1,
  },
  menuIngredients: {
    ...typography.body,
    color: colors.gray,
    lineHeight: 20,
    marginLeft: 48,
  },
});

export default StreamingUploadScreen;
