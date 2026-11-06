// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import typescriptEslintEslintPlugin from '@typescript-eslint/eslint-plugin';
import eslintImport from 'eslint-plugin-import';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'node_modules', 'dist'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: {
          allowDefaultProject: ['vitest.config.mjs']
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslintEslintPlugin,
      'simple-import-sort': simpleImportSort,
      import: eslintImport,
    },
  },
  {
    rules: {
      'max-len': ['error',
        {
          'code': 110,
          'ignoreComments': true,
          'ignoreTrailingComments': true,
          'ignoreUrls': true,
          'ignorePattern': '^import\\s.+$'
        }],
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'simple-import-sort/imports': 'error',
      'import/newline-after-import': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          vars: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Escopo deliberadamente restrito: fora de `infra/http/modules`, um
    // `../` de um nível (ex.: use-case → `../repositories/...`) é o padrão
    // de co-localização DDD do projeto, não duplicação a corrigir. Aqui,
    // em controllers, um `../../` indicava import repetido (ex.: o pipe de
    // validação Zod) que já existe via `@/infra/http/pipes/...`.
    //
    // Usa `no-restricted-imports` (core do ESLint) em vez de
    // `import/no-relative-parent-imports`: aquela regra casa no caminho
    // *resolvido* no disco, não no texto do import — então ela reportava
    // até o `@/infra/http/pipes/...` (o alias resolve pra fora da pasta
    // do controller do mesmo jeito). O que queremos banir é a sintaxe
    // literal `../../`, não a travessia de diretório em si.
    files: ['src/infra/http/modules/**/*.controller.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../*', '../../**'],
              message: "Use o alias '@/infra/...' em vez de subir diretórios com '../../'.",
            },
          ],
        },
      ],
    },
  },
);
