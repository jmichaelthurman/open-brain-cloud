export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-case': [2, 'always', 'kebab-case'],
    'header-max-length': [2, 'always', 72],
    'body-leading-blank': [2, 'always'],
    'subject-full-stop': [2, 'never', '.'],
  },
};
