import { API_URL } from '@env';
import auth from '@react-native-firebase/auth';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';

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

const StreamingUploadScreen = ({ navigation }: StreamingUploadScreenProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [_recipeId, setRecipeId] = useState<number | null>(null);
  const [processingStage, setProcessingStage] =
    useState<ProcessingStage>('idle');
  const [firstResultTime, setFirstResultTime] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  // 애니메이션
  const [pulseAnim] = useState(new Animated.Value(1));

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  /**
   * SSE 스트리밍 처리 (병렬 모드만 사용)
   */
  const handleStreamingUpload = async (
    uri: string,
    name: string,
    type: string,
  ) => {
    setIsUploading(true);
    setProgress(0);
    setCurrentPage(0);
    setMenus([]);
    setFirstResultTime(null);
    setStartTime(Date.now());
    setProcessingStage('idle');

    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert('인증 오류', '로그인이 필요합니다.');
        setIsUploading(false);
        return;
      }
      const token = await user.getIdToken();

      const formData = new FormData();
      formData.append('recipe', {
        uri,
        name,
        type,
      });

      const xhr = new XMLHttpRequest();
      let buffer = '';
      let processedResponseLength = 0;

      xhr.onprogress = () => {
        const newText = xhr.responseText.substring(processedResponseLength);
        processedResponseLength = xhr.responseText.length;

        buffer += newText;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the potentially incomplete last line

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
        // Process any remaining data in the buffer
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

        if (xhr.status >= 200 && xhr.status < 300) {
          // The 'complete' event from the server should handle the final state.
          // If not, we can force it here.
        } else {
          console.error(
            'Upload failed with status:',
            xhr.status,
            xhr.responseText,
          );
          Alert.alert('업로드 실패', `서버 오류: ${xhr.status}`);
        }
        setIsUploading(false);
        stopPulseAnimation();
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

  /**
   * SSE 메시지 처리
   */
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
        // 첫 결과 시간 측정
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
        Alert.alert(
          '업로드 완료!',
          `총 ${data.totalMenus}개의 메뉴가 생성되었습니다.`,
          [
            {
              text: '확인',
              onPress: () => {
                // 레시피 상세 화면으로 이동
                navigation.navigate('RecipeList');
              },
            },
          ],
        );
        break;

      case 'error':
        Alert.alert('오류', data.message || '처리 중 오류가 발생했습니다');
        setIsUploading(false);
        stopPulseAnimation();
        break;
    }
  };

  /**
   * 파일 선택
   */
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
      if (DocumentPicker.isCancel(error)) {
        console.log('Document picker cancelled');
      } else {
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
          subtitle: '문서를 스캔하고 텍스트를 추출하는 중입니다...',
          color: '#FF9500',
        };
      case 'llm':
        return {
          icon: '🤖',
          title: 'AI 분석 중',
          subtitle: '메뉴를 분석하고 정리하는 중입니다...',
          color: '#007AFF',
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
          title: '준비 중',
          subtitle: '',
          color: '#8E8E93',
        };
    }
  };

  const stageDisplay = getStageDisplay();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>개선된 레시피 업로드</Text>
        <Text style={styles.subtitle}>병렬 스트리밍 (OCR + AI 병렬 처리)</Text>
      </View>

      {!isUploading && (
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handlePickDocument}
        >
          <Text style={styles.uploadButtonText}>📄 PDF/이미지 선택</Text>
        </TouchableOpacity>
      )}

      {isUploading && (
        <View style={styles.progressContainer}>
          {/* 처리 단계 표시 */}
          <Animated.View
            style={[
              styles.stageIndicator,
              {
                backgroundColor: stageDisplay.color + '20',
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Text style={styles.stageIcon}>{stageDisplay.icon}</Text>
            <View style={styles.stageTextContainer}>
              <Text style={[styles.stageTitle, { color: stageDisplay.color }]}>
                {stageDisplay.title}
              </Text>
              {stageDisplay.subtitle && (
                <Text style={styles.stageSubtitle}>
                  {stageDisplay.subtitle}
                </Text>
              )}
            </View>
          </Animated.View>

          {/* LLM 처리 중일 때만 페이지 진행률 표시 */}
          {processingStage === 'llm' && totalPages > 0 && (
            <View style={styles.pageProgressContainer}>
              <View style={styles.pageProgressHeader}>
                <Text style={styles.pageProgressText}>
                  페이지 {currentPage} / {totalPages}
                </Text>
                <Text style={styles.progressPercentage}>{progress}%</Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
              </View>
              {firstResultTime && (
                <Text style={styles.statsText}>
                  ⚡ 첫 결과: {(firstResultTime / 1000).toFixed(1)}초
                </Text>
              )}
            </View>
          )}

          {/* 로딩 인디케이터 */}
          {processingStage !== 'complete' && (
            <ActivityIndicator
              size="large"
              color={stageDisplay.color}
              style={styles.spinner}
            />
          )}
        </View>
      )}

      {/* 생성된 메뉴 리스트 */}
      <ScrollView style={styles.menuList}>
        <View style={styles.menuListHeader}>
          <Text style={styles.menuListTitle}>생성된 메뉴</Text>
          <View style={styles.menuCountBadge}>
            <Text style={styles.menuCountText}>{menus.length}</Text>
          </View>
        </View>
        {menus.map((menu, index) => (
          <View key={index} style={styles.menuItem}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuNumber}>{index + 1}</Text>
              <Text style={styles.menuName}>{menu.name}</Text>
            </View>
            <Text style={styles.menuIngredients}>{menu.ingredients}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F2F2F7',
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 20,
  },
  stageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  stageIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  stageTextContainer: {
    flex: 1,
  },
  stageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  stageSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  pageProgressContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  pageProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pageProgressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  statsText: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
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
  },
  menuListTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  menuCountBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 10,
  },
  menuCountText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  menuItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    backgroundColor: '#007AFF20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
    minWidth: 32,
    textAlign: 'center',
  },
  menuName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  menuIngredients: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
});

export default StreamingUploadScreen;
