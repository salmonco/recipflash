import auth from '@react-native-firebase/auth';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography } from '../styles/theme';
import { trpc } from '../trpc';
import { showToast } from '../utils/toast/showToast';
import { trackEvent } from '../utils/tracker';

const SettingsScreen = () => {
  const deleteUserMutation = trpc.auth.deleteUser.useMutation();

  const handleSignOut = async () => {
    trackEvent('sign_out_click');
    try {
      await auth().signOut();
      // The auth state listener in App.tsx will handle navigation to the LoginScreen
    } catch (error: any) {
      showToast('로그아웃 오류', error.message, { type: 'error' });
    }
  };

  const handleDeleteAccount = async () => {
    trackEvent('account_deletion_click');
    Alert.alert(
      '계정 탈퇴',
      '정말로 계정을 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: async () => {
            trackEvent('account_deletion_success');
            try {
              const currentUser = auth().currentUser;
              if (!currentUser) {
                showToast('오류', '로그인된 사용자가 없습니다.', {
                  type: 'error',
                });
                return;
              }

              const result = await deleteUserMutation.mutateAsync();

              if (result.success) {
                await currentUser.delete();
                showToast('성공', '계정이 성공적으로 탈퇴되었습니다.', {
                  type: 'success',
                });
              } else {
                showToast(
                  '오류',
                  result.errorMessage || '계정 탈퇴에 실패했습니다.',
                  {
                    type: 'error',
                  },
                );
              }
            } catch (error: any) {
              console.error('Error deleting account:', error);
              showToast(
                '오류',
                error.message || '계정 탈퇴 중 오류가 발생했습니다.',
                {
                  type: 'error',
                },
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>계정 설정</Text>
        <Pressable style={styles.button} onPress={handleSignOut}>
          <Text style={styles.buttonText}>로그아웃</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.deleteButton]}
          onPress={handleDeleteAccount}
        >
          <Text style={styles.deleteButtonText}>탈퇴하기</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    ...typography.subtitle,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  button: {
    backgroundColor: colors.white,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.gray,
  },
  buttonText: {
    ...typography.body,
  },
  deleteButton: {
    borderColor: colors.point,
  },
  deleteButtonText: {
    ...typography.body,
    color: colors.point,
  },
});

export default SettingsScreen;
