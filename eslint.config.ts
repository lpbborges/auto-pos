import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import json from '@eslint/json'
import { includeIgnoreFile } from '@eslint/compat'
import { defineConfig } from 'eslint/config'
import { fileURLToPath } from 'url'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import sveltePlugin from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

const svelteRecommended = sveltePlugin.configs['flat/recommended'].map(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (config: any) => ({
    ...config,
    files: config.files ?? ['**/*.svelte'],
    rules: {
      ...config.rules,
      'svelte/no-navigation-without-resolve': 'off' as const,
    },
  }),
)

export default defineConfig([
  includeIgnoreFile(gitignorePath, 'Imported .gitignore patterns'),
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  tseslint.configs.recommended,
  {
    files: ['**/*.json'],
    plugins: { json },
    language: 'json/json',
    extends: ['json/recommended'],
  },
  {
    files: ['**/*.jsonc'],
    plugins: { json },
    language: 'json/jsonc',
    extends: ['json/recommended'],
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  ...svelteRecommended,
  eslintConfigPrettier,
])
