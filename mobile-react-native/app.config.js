const base = require('./app.json').expo;

module.exports = () => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const iosUrlScheme = iosClientId
    ? `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, '')}`
    : 'com.googleusercontent.apps.64327623006-atl8dp6tgs3g650ts542b8ig0f9p54n2';

  return {
    ...base,
    plugins: base.plugins.map(plugin =>
      Array.isArray(plugin) && plugin[0] === '@react-native-google-signin/google-signin'
        ? [plugin[0], { iosUrlScheme }]
        : plugin
    ),
  };
};
