/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-is-pure',
      severity: 'error',
      from: { path: '^packages/ordering/src/domain' },
      to: {
        path: [
          '^packages/ordering/src/(application|infrastructure|presentation)',
          '^packages/platform',
          '^node_modules/@nestjs',
          '^node_modules/drizzle-orm',
        ],
      },
    },
    {
      name: 'application-does-not-depend-on-adapters',
      severity: 'error',
      from: { path: '^packages/ordering/src/application' },
      to: {
        path: [
          '^packages/ordering/src/(infrastructure|presentation)',
          '^packages/platform',
          '^node_modules/@nestjs',
          '^node_modules/drizzle-orm',
        ],
      },
    },
    {
      name: 'platform-does-not-depend-on-ordering',
      severity: 'error',
      from: { path: '^packages/platform' },
      to: { path: '^packages/ordering' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { exportsFields: ['exports'] },
    reporterOptions: { dot: { collapsePattern: 'node_modules/[^/]+' } },
  },
};
