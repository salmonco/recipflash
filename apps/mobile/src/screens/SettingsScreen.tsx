import auth from '@react-native-firebase/auth';
import React from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trpc } from '../trpc';
import { trackEvent } from '../utils/tracker';

const SettingsScreen = () => {
  const deleteUserMutation = trpc.auth.deleteUser.useMutation();

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
                Alert.alert('오류', '로그인된 사용자가 없습니다.');
                return;
              }

              // Call the tRPC mutation to delete user data from the backend
              const result = await deleteUserMutation.mutateAsync();

              if (result.success) {
                // Delete user from Firebase Authentication
                await currentUser.delete();
                Alert.alert('성공', '계정이 성공적으로 탈퇴되었습니다.');
                // Navigate to login screen or handle sign out
              } else {
                Alert.alert(
                  '오류',
                  result.errorMessage || '계정 탈퇴에 실패했습니다.',
                );
              }
            } catch (error: any) {
              console.error('Error deleting account:', error);
              Alert.alert(
                '오류',
                error.message || '계정 탈퇴 중 오류가 발생했습니다.',
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
        <Button title="탈퇴하기" onPress={handleDeleteAccount} color="red" />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  section: {
    backgroundColor: 'white',
    marginTop: 20,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});

export default SettingsScreen;
