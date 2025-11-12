import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'artifacts/**',
      'coverage/**',
      '*.js',
      '*.cjs',
      '*.mjs',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      '.railway-deploy-trigger.js',
      'old_emergency_fixes/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx,cts,mts}'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.build.json'].filter(Boolean),
        tsconfigRootDir: new URL('.', import.meta.url).pathname
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off'
    }
  }
);

