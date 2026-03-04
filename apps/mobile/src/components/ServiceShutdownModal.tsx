import auth from '@react-native-firebase/auth';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../styles/theme';
import { submitSurveyResponse } from '../utils/firestoreApi';

interface Props {
  visible: boolean;
  surveyCompleted: boolean;
  onSurveyCompleted: () => void;
  onDismiss: () => void;
}

const Q1_OPTIONS = [
  { value: 'very', label: '매우 실망스럽다' },
  { value: 'somewhat', label: '약간 실망스럽다' },
  { value: 'not_at_all', label: '전혀 실망스럽지 않다' },
] as const;

const Q2_OPTIONS = [
  { value: 'pdf_extract', label: 'PDF → 레시피 추출' },
  { value: 'flashcard', label: '플래시카드 암기' },
  { value: 'menu_manage', label: '메뉴·재료 관리' },
  { value: 'none', label: '유용한 기능 없었음' },
] as const;

const APP_VERSION = '0.0.1';

const ServiceShutdownModal: React.FC<Props> = ({
  visible,
  surveyCompleted,
  onSurveyCompleted,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState<string[]>([]);
  const [q3, setQ3] = useState('');
  const [q4, setQ4] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    const user = auth().currentUser;
    const result = await submitSurveyResponse({
      userId: user?.uid ?? null,
      q1_disappointment: q1,
      q2_useful_features: q2,
      q3_alternative: q3.trim(),
      q4_improvement: q4.trim(),
      createdAt: new Date().toISOString(),
      platform: Platform.OS,
      appVersion: APP_VERSION,
    });
    setSubmitting(false);
    if (result.success) {
      onSurveyCompleted();
      setStep(5);
    } else {
      Alert.alert('제출 실패', result.error);
    }
  };

  const toggleQ2 = (value: string) => {
    setQ2(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value],
    );
  };

  const canProceed = () => {
    if (step === 1) return q1 !== '';
    if (step === 2) return q2.length > 0;
    return true;
  };

  const handleNext = () => {
    if (step === 4) {
      handleSubmit();
    } else {
      setStep(s => s + 1);
    }
  };

  // 재방문: 간단 안내만
  if (surveyCompleted) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View
          style={[
            styles.container,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 },
          ]}
        >
          <View style={styles.centerContent}>
            <Text style={styles.emoji}>🙏</Text>
            <Text style={styles.title}>서비스가 종료되었습니다</Text>
            <Text style={styles.body}>
              레시피 암기 앱을 이용해 주셔서{'\n'}진심으로 감사드립니다.
            </Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={onDismiss}>
            <Text style={styles.primaryButtonText}>확인</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 },
        ]}
      >
        {step === 0 && (
          <>
            <View style={styles.centerContent}>
              <Text style={styles.emoji}>📢</Text>
              <Text style={styles.title}>
                레시피 암기 앱{'\n'}서비스가 종료됩니다
              </Text>
              <Text style={styles.body}>
                그동안 이용해 주셔서 감사합니다.{'\n'}더 나은 서비스를 위해
                {'\n'}
                간단한 설문에 참여해 주시면{'\n'}큰 도움이 됩니다.
              </Text>
            </View>
            <View style={styles.bottomButtons}>
              <Pressable
                style={styles.primaryButton}
                onPress={() => setStep(1)}
              >
                <Text style={styles.primaryButtonText}>설문 참여하기</Text>
              </Pressable>
              <Pressable style={styles.skipButton} onPress={onDismiss}>
                <Text style={styles.skipButtonText}>건너뛰기</Text>
              </Pressable>
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <View style={styles.questionContent}>
              <Text style={styles.stepIndicator}>1 / 4</Text>
              <Text style={styles.questionTitle}>
                이 앱이 더 이상 사용할 수 없게 된다면{'\n'}얼마나
                실망스러우신가요?
              </Text>
              {Q1_OPTIONS.map(option => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.optionButton,
                    q1 === option.value && styles.optionButtonSelected,
                  ]}
                  onPress={() => setQ1(option.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      q1 === option.value && styles.optionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[
                styles.primaryButton,
                !canProceed() && styles.buttonDisabled,
              ]}
              onPress={handleNext}
              disabled={!canProceed()}
            >
              <Text style={styles.primaryButtonText}>다음</Text>
            </Pressable>
          </>
        )}

        {step === 2 && (
          <>
            <View style={styles.questionContent}>
              <Text style={styles.stepIndicator}>2 / 4</Text>
              <Text style={styles.questionTitle}>
                가장 유용했던 기능을{'\n'}모두 선택해 주세요.
              </Text>
              {Q2_OPTIONS.map(option => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.optionButton,
                    q2.includes(option.value) && styles.optionButtonSelected,
                  ]}
                  onPress={() => toggleQ2(option.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      q2.includes(option.value) && styles.optionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[
                styles.primaryButton,
                !canProceed() && styles.buttonDisabled,
              ]}
              onPress={handleNext}
              disabled={!canProceed()}
            >
              <Text style={styles.primaryButtonText}>다음</Text>
            </Pressable>
          </>
        )}

        {step === 3 && (
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.questionContent}>
              <Text style={styles.stepIndicator}>3 / 4</Text>
              <Text style={styles.questionTitle}>
                이 앱 대신 어떤 방법으로{'\n'}문제를 해결하실 건가요?
              </Text>
              <Text style={styles.optionalLabel}>(선택)</Text>
              <TextInput
                style={styles.textArea}
                value={q3}
                onChangeText={setQ3}
                placeholder="예: 직접 노트에 정리, 다른 앱 사용 등"
                placeholderTextColor={colors.gray}
                multiline
                textAlignVertical="top"
              />
            </View>
            <Pressable style={styles.primaryButton} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>다음</Text>
            </Pressable>
          </ScrollView>
        )}

        {step === 4 && (
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.questionContent}>
              <Text style={styles.stepIndicator}>4 / 4</Text>
              <Text style={styles.questionTitle}>
                어떤 점이 개선되었다면{'\n'}계속 사용하셨을까요?
              </Text>
              <Text style={styles.optionalLabel}>(선택)</Text>
              <TextInput
                style={styles.textArea}
                value={q4}
                onChangeText={setQ4}
                placeholder="자유롭게 작성해 주세요"
                placeholderTextColor={colors.gray}
                multiline
                textAlignVertical="top"
              />
            </View>
            <Pressable style={styles.primaryButton} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>
                {submitting ? '제출 중...' : '제출하기'}
              </Text>
            </Pressable>
          </ScrollView>
        )}

        {step === 5 && (
          <>
            <View style={styles.centerContent}>
              <Text style={styles.emoji}>💛</Text>
              <Text style={styles.title}>소중한 의견{'\n'}감사합니다</Text>
              <Text style={styles.body}>
                보내주신 의견은{'\n'}더 나은 서비스를 만드는 데{'\n'}
                소중하게 활용하겠습니다.
              </Text>
            </View>
            <Pressable style={styles.primaryButton} onPress={onDismiss}>
              <Text style={styles.primaryButtonText}>확인</Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionContent: {
    flex: 1,
    paddingTop: 20,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 24,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 16,
  },
  body: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 26,
    color: colors.gray,
  },
  stepIndicator: {
    ...typography.body,
    color: colors.gray,
    marginBottom: 16,
  },
  questionTitle: {
    ...typography.subtitle,
    lineHeight: 28,
    marginBottom: 24,
  },
  optionButton: {
    borderWidth: 1.5,
    borderColor: colors.gray,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF9E0',
  },
  optionText: {
    ...typography.body,
    color: colors.text,
  },
  optionTextSelected: {
    fontWeight: '600',
  },
  optionalLabel: {
    ...typography.body,
    color: colors.gray,
    fontSize: 14,
    marginBottom: 12,
  },
  textArea: {
    ...typography.body,
    borderWidth: 1.5,
    borderColor: colors.gray,
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    backgroundColor: colors.white,
  },
  bottomButtons: {
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    ...typography.title,
    fontSize: 20,
    color: colors.text,
  },
  buttonDisabled: {
    backgroundColor: colors.gray,
    opacity: 0.5,
  },
  skipButton: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  skipButtonText: {
    ...typography.body,
    color: colors.gray,
    fontSize: 14,
  },
});

export default ServiceShutdownModal;
