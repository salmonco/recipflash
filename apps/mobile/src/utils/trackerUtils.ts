import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const CURRENT_APP_VERSION = DeviceInfo.getVersion();

/**
 * 이벤트 추적에 사용되는 공통 매개변수를 가져오는 유틸리티 함수
 */
export const getCommonParams = () => {
  return {
    timestamp: new Date().toISOString(), // 공통 매개변수: 앱 시작 시간
    app_version: CURRENT_APP_VERSION, // 공통 매개변수: 앱 버전
    platform: Platform.OS, // 공통 매개변수: 플랫폼 (iOS/Android)
  };
};
