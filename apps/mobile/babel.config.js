module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        env: ['API_URL', 'WEB_CLIENT_ID', 'AMPLITUDE_API_KEY'],
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
      },
    ],
    'hot-updater/babel-plugin',
  ],
};
