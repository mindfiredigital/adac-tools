module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'doc',
        'docs',
        'patch',
        'ci',
        'build',
        'perf',
        'refactor',
        'test',
        'style',
        'chore',
        'revert',
      ],
    ],
  },
};
