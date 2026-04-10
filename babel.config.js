const cssInteropBabel = require('react-native-css-interop/babel');

const cssInteropPlugins = cssInteropBabel().plugins.filter(plugin => {
  const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
  return pluginName !== 'react-native-worklets/plugin';
});

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [...cssInteropPlugins, 'react-native-reanimated/plugin'],
};
