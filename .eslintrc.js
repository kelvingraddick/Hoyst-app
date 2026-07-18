module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      files: ['*.mjs'],
      env: {
        es2022: true,
        node: true,
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
  ],
};
