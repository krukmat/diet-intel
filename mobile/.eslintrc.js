module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    '@react-native-community',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'react',
    'react-native',
    'complexity',
  ],
  rules: {
    // Reglas básicas para consistencia según last_sprint.md
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    'no-console': 'warn',
    // Reglas adicionales según best practices del proyecto según last_sprint.md
    'react-native/no-unused-styles': 'warn',
    'react-native/split-platform-components': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    // Análisis de complejidad ciclomática
    'complexity': ['warn', 10],
  },
};
