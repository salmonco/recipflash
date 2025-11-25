import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

// IMPORTANT: Replace 'YOUR_LOCAL_IP_ADDRESS' with your actual local IP address.
// You can find your local IP address by running 'ifconfig' (macOS/Linux) or 'ipconfig' (Windows)
// in your terminal and looking for an address like 192.168.x.x or 10.0.x.x.
// The 'game-engine' server (started with 'pnpm --filter game-engine serve') typically runs on port 8080.
const GAME_URL = 'http://172.30.107.98:8080';

const GameScreen = () => {
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: GAME_URL }}
        style={styles.webview}
        onLoadStart={() => console.log('WebView: Loading started')}
        onLoadEnd={() => console.log('WebView: Loading finished')}
        onError={syntheticEvent => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
        }}
        onMessage={event => {
          // Handle messages from the WebView (game)
          console.log('Message from game:', event.nativeEvent.data);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});

export default GameScreen;
