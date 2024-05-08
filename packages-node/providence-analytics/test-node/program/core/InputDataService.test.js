import { expect } from 'chai';
import { it } from 'mocha';
import { InputDataService } from '../../../src/program/core/InputDataService.js';
import { memoize } from '../../../src/program/utils/memoize.js';
import {
  restoreMockedProjects,
  mockProject,
  mock,
} from '../../../test-helpers/mock-project-helpers.js';

/**
 * @typedef {import('../../../types/index.js').PathFromSystemRoot} PathFromSystemRoot
 */

describe('InputDataService', () => {
  const initialReferenceProjectPaths = InputDataService.referenceProjectPaths;
  const initialTargetProjectPaths = InputDataService.referenceProjectPaths;

  function restoreOriginalInputDataPaths() {
    InputDataService.referenceProjectPaths = initialReferenceProjectPaths;
    InputDataService.targetProjectPaths = initialTargetProjectPaths;
  }

  beforeEach(() => {
    memoize.disableCaching();
  });

  afterEach(() => {
    restoreOriginalInputDataPaths();
    restoreMockedProjects();
    memoize.restoreCaching();
  });

  describe('Configuration', () => {
    it('allows to set referenceProjectPaths', async () => {
      /** @type {PathFromSystemRoot[]} */
      const newPaths = ['/my/path', '/my/other/path'];
      InputDataService.referenceProjectPaths = newPaths;
      expect(InputDataService.referenceProjectPaths).to.equal(newPaths);
    });

    it('allows to set targetProjectPaths', async () => {
      /** @type {PathFromSystemRoot[]} */
      const newPaths = ['/my/path', '/my/other/path'];
      InputDataService.targetProjectPaths = newPaths;
      expect(InputDataService.targetProjectPaths).to.equal(newPaths);
    });
  });

  describe('Methods', () => {
    it('"createDataObject"', async () => {
      mockProject({
        './package.json': JSON.stringify({
          name: 'fictional-project',
          main: 'my/index.js',
          version: '1.0.0',
        }),
        './src/file.js': '// bla',
        './src/file2.js': '// bla',
      });

      const inputDataPerProject = await InputDataService.createDataObject(['/fictional/project']);
      expect(inputDataPerProject).to.deep.equal([
        {
          project: {
            path: '/fictional/project',
            mainEntry: './my/index.js',
            name: 'fictional-project',
            version: '1.0.0',
            commitHash: '[not-a-git-root]',
          },
          entries: [
            {
              file: './src/file.js',
              context: {
                code: '// bla',
              },
            },
            {
              file: './src/file2.js',
              context: {
                code: '// bla',
              },
            },
          ],
        },
      ]);
    });

    it('"targetProjectPaths"', async () => {});

    it('"getReferenceProjectPaths"', async () => {});

    describe('"getMonoRepoPackages"', async () => {
      it('supports npm/yarn workspaces', async () => {
        mockProject({
          './package.json': JSON.stringify({
            workspaces: ['packages/*', 'another-folder/another-package'],
          }),
          './packages/pkg1/package.json': '{ "name": "package1" }',
          './packages/pkg2/package.json': '',
          './packages/pkg3/package.json': '{ "name": "@scope/pkg3" }',
          './another-folder/another-package/package.json':
            '{ "name": "@another-scope/another-package" }',
        });

        expect(await InputDataService.getMonoRepoPackages('/fictional/project')).to.deep.equal([
          { path: 'packages/pkg1', name: 'package1' },
          { path: 'packages/pkg2', name: 'pkg2' }, // fallback when no package.json
          { path: 'packages/pkg3', name: '@scope/pkg3' },
          { path: 'another-folder/another-package', name: '@another-scope/another-package' },
        ]);
      });

      it('supports lerna', async () => {
        mockProject({
          './package.json': JSON.stringify({}),
          './lerna.json': JSON.stringify({
            packages: ['packages/*', 'another-folder/another-package'],
          }),
          './packages/pkg1/package.json': '{ "name": "package1" }',
          './packages/pkg2/package.json': '',
          './packages/pkg3/package.json': '{ "name": "@scope/pkg3" }',
          './another-folder/another-package/package.json':
            '{ "name": "@another-scope/another-package" }',
        });

        expect(await InputDataService.getMonoRepoPackages('/fictional/project')).to.deep.equal([
          { path: 'packages/pkg1', name: 'package1' },
          { path: 'packages/pkg2', name: 'pkg2' }, // fallback when no package.json
          { path: 'packages/pkg3', name: '@scope/pkg3' },
          { path: 'another-folder/another-package', name: '@another-scope/another-package' },
        ]);
      });
    });

    describe('"gatherFilesFromDir"', async () => {
      beforeEach(() => {
        mockProject({
          './index.js': '',
          './internal.js': '',
          './nested/index.js': '',
          './nested/nested-two/index.test.js': '',
          './something.test.js': '',
          './index.html': '',
          './something.test.html': '',
        });
      });

      it('gathers a list of files', async () => {
        const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project');
        expect(globOutput).to.deep.equal([
          '/fictional/project/index.js',
          '/fictional/project/internal.js',
          '/fictional/project/something.test.js',
          '/fictional/project/nested/index.js',
          '/fictional/project/nested/nested-two/index.test.js',
        ]);
      });

      it('allows passing a depth which stops at nested depth', async () => {
        const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
          depth: 0,
        });
        expect(globOutput).to.deep.equal([
          '/fictional/project/index.js',
          '/fictional/project/internal.js',
          '/fictional/project/something.test.js',
        ]);
      });

      it('allows passing extensions', async () => {
        const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
          extensions: ['.html', '.js'],
        });
        expect(globOutput).to.deep.equal([
          '/fictional/project/index.html',
          '/fictional/project/index.js',
          '/fictional/project/internal.js',
          '/fictional/project/something.test.html',
          '/fictional/project/something.test.js',
          '/fictional/project/nested/index.js',
          '/fictional/project/nested/nested-two/index.test.js',
        ]);
      });

      it('allows passing excluded folders', async () => {
        const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
          extensions: ['.html', '.js'],
          allowlist: ['!nested/**'],
        });
        expect(globOutput).to.deep.equal([
          '/fictional/project/index.html',
          '/fictional/project/index.js',
          '/fictional/project/internal.js',
          '/fictional/project/something.test.html',
          '/fictional/project/something.test.js',
        ]);
      });

      it('allows passing excluded files', async () => {
        const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
          extensions: ['.html', '.js'],
          allowlist: ['!index.js', '!**/*/index.js'],
        });
        expect(globOutput).to.deep.equal([
          '/fictional/project/index.html',
          '/fictional/project/internal.js',
          '/fictional/project/something.test.html',
          '/fictional/project/something.test.js',
          '/fictional/project/nested/nested-two/index.test.js',
        ]);
      });

      it('allows passing exclude globs', async () => {
        const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
          extensions: ['.html', '.js'],
          allowlist: ['!**/*.test.{html,js}'],
        });
        expect(globOutput).to.deep.equal([
          '/fictional/project/index.html',
          '/fictional/project/index.js',
          '/fictional/project/internal.js',
          '/fictional/project/nested/index.js',
        ]);
      });

      it('does not support non globs in "allowlist"', async () => {
        const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
          extensions: ['.html', '.js'],
          allowlist: ['nested'],
        });
        expect(globOutput).to.deep.equal([]);
      });

      it('omits node_modules and bower_components at root level by default', async () => {
        mockProject({
          './index.js': '',
          './node_modules/pkg/x.js': '',
          './bower_components/pkg/y.js': '',
          './nested/node_modules/pkg/x.js': '',
          './nested/bower_components/pkg/y.js': '',
        });

        const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project');
        expect(globOutput).to.deep.equal([
          '/fictional/project/index.js',
          '/fictional/project/nested/node_modules/pkg/x.js',
          '/fictional/project/nested/bower_components/pkg/y.js',
        ]);
      });

      it('allows to add root level files', async () => {
        mockProject({
          './root-lvl.js': '',
          './omitted/file.js': '',
          './added/file.js': '',
        });
        const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
          allowlist: ['*', 'added/**/*'],
        });
        expect(globOutput).to.deep.equal([
          '/fictional/project/root-lvl.js',
          '/fictional/project/added/file.js',
        ]);
      });

      it('allows deeper globs', async () => {
        mockProject({
          './root-lvl.js': '',
          './deeper/glob/structure/file.js': '',
          './deeper/glob/file.js': '',
          './deeper/file.js': '',
        });
        const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
          allowlist: ['deeper/**/*'],
        });
        expect(globOutput).to.deep.equal([
          '/fictional/project/deeper/file.js',
          '/fictional/project/deeper/glob/file.js',
          '/fictional/project/deeper/glob/structure/file.js',
        ]);
      });

      describe('Default config', () => {
        it('omits config files by default', async () => {
          mockProject({
            './index.js': '',
            './karma.conf.js': '',
            './commitlint.config.js': '',
            './some-pkg/commitlint.config.js': '',
            './some-other-pkg/commitlint.conf.js': '',
          });

          const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project');
          expect(globOutput).to.deep.equal(['/fictional/project/index.js']);
        });

        it('omits hidden files by default', async () => {
          mockProject({
            './.blablarc.js': '',
            './index.js': '',
          });

          const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project');
          expect(globOutput).to.deep.equal(['/fictional/project/index.js']);
        });

        describe('AllowlistMode', () => {
          it('autodetects allowlistMode', async () => {
            mockProject({
              './dist/bundle.js': '',
              './package.json': JSON.stringify({
                files: ['dist'],
              }),
              '.gitignore': '/dist',
            });
            const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project');
            expect(globOutput).to.deep.equal([
              // This means allowlistMode is 'git'
            ]);

            restoreOriginalInputDataPaths();
            restoreMockedProjects();

            mockProject({
              './dist/bundle.js': '',
              './package.json': JSON.stringify({
                files: ['dist'],
              }),
            });
            const globOutput2 = await InputDataService.gatherFilesFromDir('/fictional/project');
            expect(globOutput2).to.deep.equal([
              // This means allowlistMode is 'npm'
              '/fictional/project/dist/bundle.js',
            ]);

            mockProject(
              { './dist/bundle.js': '', '.gitignore': '/dist' },
              {
                projectName: 'detect-as-npm',
                projectPath: '/inside/proj/with/node_modules/detect-as-npm',
              },
            );
            const globOutput3 = await InputDataService.gatherFilesFromDir(
              '/inside/proj/with/node_modules/detect-as-npm',
            );
            expect(globOutput3).to.deep.equal([
              // This means allowlistMode is 'npm' (even though we found .gitignore)
              '/inside/proj/with/node_modules/detect-as-npm/dist/bundle.js',
            ]);

            mockProject(
              { './dist/bundle.js': '', '.gitignore': '/dist' },
              {
                projectName: '@scoped/detect-as-npm',
                projectPath: '/inside/proj/with/node_modules/@scoped/detect-as-npm',
              },
            );
            const globOutput4 = await InputDataService.gatherFilesFromDir(
              '/inside/proj/with/node_modules/@scoped/detect-as-npm',
            );
            expect(globOutput4).to.deep.equal([
              // This means allowlistMode is 'npm' (even though we found .gitignore)
              '/inside/proj/with/node_modules/@scoped/detect-as-npm/dist/bundle.js',
            ]);
          });

          it('filters npm "files" entries when allowlistMode is "npm"', async () => {
            mockProject({
              './docs/x.js': '',
              './src/y.js': '',
              './file.add.js': '',
              './omit.js': '',
              './package.json': JSON.stringify({
                files: ['*.add.js', 'docs', 'src'],
              }),
            });
            const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
              allowlistMode: 'npm',
            });
            expect(globOutput).to.deep.equal([
              '/fictional/project/file.add.js',
              '/fictional/project/src/y.js',
              '/fictional/project/docs/x.js',
            ]);
          });

          it('filters .gitignore entries when allowlistMode is "git"', async () => {
            mockProject({
              './coverage/file.js': '',
              './storybook-static/index.js': '',
              './build/index.js': '',
              './shall/pass.js': '',
              './keep/it.js': '',
              '.gitignore': `
/coverage
# comment
/storybook-static/

build/
!keep/
            `,
            });
            const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
              allowlistMode: 'git',
            });
            expect(globOutput).to.deep.equal([
              '/fictional/project/shall/pass.js',
              '/fictional/project/keep/it.js',
            ]);
          });

          it('filters no entries when allowlistMode is "all"', async () => {
            mockProject({
              './dist/bundle.js': '',
              './src/file.js': '',
              './package.json': JSON.stringify({
                files: ['dist', 'src'],
              }),
              '.gitignore': `
/dist
            `,
            });
            const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
              allowlistMode: 'all',
            });
            expect(globOutput).to.deep.equal([
              '/fictional/project/src/file.js',
              '/fictional/project/dist/bundle.js',
            ]);
          });

          it('filters npm export map entries when allowlistMode is "export-map"', async () => {
            mockProject({
              './internal/file.js': '',
              './non-exposed/file.js': '',
              './package.json': JSON.stringify({
                exports: {
                  './exposed/*': './internal/*',
                },
              }),
            });
            const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
              allowlistMode: 'export-map',
            });
            expect(globOutput).to.deep.equal(['./internal/file.js']);
          });
        });

        it('custom "allowlist" will take precedence over "allowlistMode"', async () => {
          mockProject({
            './dist/bundle.js': '', // generated by build step
            './src/a.js': '',
            './src/b.js': '',
            '.gitignore': '/dist', // Because we have a .gitignore, allowlistMode will be git
            './package.json': JSON.stringify({
              files: ['dist'], // This will not be considered by default, unless explicitly configured in allowlist
            }),
          });
          const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
            allowlist: ['dist/**'],
            allowlistMode: 'git', // for clarity, (would also be autodetected if not provided)
          });
          expect(globOutput).to.deep.equal(['/fictional/project/dist/bundle.js']);
        });

        describe('Default allowlist', () => {
          it('merges default config filter with configured filter', async () => {
            mockProject({
              './node_modules/root-lvl.js': '',
              './bower_components/omitted/file.js': '',
              './added.js': '',
              './omit.js': '',
            });
            const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
              allowlist: ['added*'],
            });
            expect(globOutput).to.deep.equal(['/fictional/project/added.js']);
          });

          it('allows to omit default config filter', async () => {
            mockProject({
              './node_modules/root-lvl.js': '',
              './bower_components/omitted/file.js': '',
              './xyz.conf.js': '',
              './abc.config.js': '',
              './added.js': '',
              './omit.js': '',
            });
            const globOutput = await InputDataService.gatherFilesFromDir('/fictional/project', {
              allowlist: ['!omit*'],
              omitDefaultAllowlist: true,
            });
            expect(globOutput).to.deep.equal([
              '/fictional/project/abc.config.js',
              '/fictional/project/added.js',
              '/fictional/project/xyz.conf.js',
              '/fictional/project/node_modules/root-lvl.js',
              '/fictional/project/bower_components/omitted/file.js',
            ]);
          });
        });
      });
    });

    describe('"getPathsFromExportMap"', () => {
      it('gets "internalExportMapPaths", "exposedExportMapPaths"', async () => {
        const fakeFs = {
          '/my/proj/internal-path.js': 'export const x = 0;',
          '/my/proj/internal/folder-a/path.js': 'export const a = 1;',
          '/my/proj/internal/folder-b/path.js': 'export const b = 2;',
        };
        mock(fakeFs);

        const exports = {
          './exposed-path.js': './internal-path.js',
          './external/*/path.js': './internal/*/path.js',
        };
        const exportMapPaths = await InputDataService.getPathsFromExportMap(exports, {
          packageRootPath: '/my/proj',
        });

        expect(exportMapPaths).to.deep.equal([
          { internal: './internal-path.js', exposed: './exposed-path.js' },
          { internal: './internal/folder-b/path.js', exposed: './external/folder-b/path.js' },
          { internal: './internal/folder-a/path.js', exposed: './external/folder-a/path.js' },
        ]);
      });

      it('supports 1-on-1 path maps in export map entry', async () => {
        const fakeFs = {
          '/my/proj/internal-path.js': 'export const x = 0;',
        };
        mock(fakeFs);
        const exports = {
          './exposed-path.js': './internal-path.js',
        };
        const exportMapPaths = await InputDataService.getPathsFromExportMap(exports, {
          packageRootPath: '/my/proj',
        });
        expect(exportMapPaths).to.deep.equal([
          { internal: './internal-path.js', exposed: './exposed-path.js' },
        ]);
      });

      it('supports "./*" root mappings', async () => {
        const fakeFs = {
          '/my/proj/internal-exports-folder/file-a.js': 'export const x = 0;',
          '/my/proj/internal-exports-folder/file-b.js': 'export const x = 0;',
          '/my/proj/internal-exports-folder/file-c.js': 'export const x = 0;',
        };
        mock(fakeFs);
        const exports = {
          './*': './internal-exports-folder/*',
        };
        const exportMapPaths = await InputDataService.getPathsFromExportMap(exports, {
          packageRootPath: '/my/proj',
        });
        expect(exportMapPaths).to.deep.equal([
          { internal: './internal-exports-folder/file-a.js', exposed: './file-a.js' },
          { internal: './internal-exports-folder/file-b.js', exposed: './file-b.js' },
          { internal: './internal-exports-folder/file-c.js', exposed: './file-c.js' },
        ]);
      });

      it('supports "*" on file level inside key and value of export map entry', async () => {
        const fakeFs = {
          '/my/proj/internal-folder/file-a.js': 'export const a = 1;',
          '/my/proj/internal-folder/another-folder/file-b.js': 'export const b = 2;',
        };
        mock(fakeFs);
        const exports = {
          './exposed-folder/*.js': './internal-folder/*.js',
        };
        const exportMapPaths = await InputDataService.getPathsFromExportMap(exports, {
          packageRootPath: '/my/proj',
        });
        expect(exportMapPaths).to.deep.equal([
          { internal: './internal-folder/file-a.js', exposed: './exposed-folder/file-a.js' },
          {
            internal: './internal-folder/another-folder/file-b.js',
            exposed: './exposed-folder/another-folder/file-b.js',
          },
        ]);
      });

      it('supports "*" on folder level inside key and value of export map entry', async () => {
        const fakeFs = {
          '/my/proj/folder-a/file.js': 'export const a = 1;',
          '/my/proj/folder-b/file.js': 'export const b = 2;',
        };
        mock(fakeFs);
        const exports = {
          // Hypothetical example that indicates the * can be placed everywhere
          './exposed-folder/*/file.js': './*/file.js',
        };
        const exportMapPaths = await InputDataService.getPathsFromExportMap(exports, {
          packageRootPath: '/my/proj',
        });
        expect(exportMapPaths).to.deep.equal([
          { exposed: './exposed-folder/folder-b/file.js', internal: './folder-b/file.js' },
          { exposed: './exposed-folder/folder-a/file.js', internal: './folder-a/file.js' },
        ]);
      });

      // TDOO: implement
      it.skip('supports private internal => ""./features/private-internal/*": null"', async () => {
        const fakeFs = {
          '/my/proj/internal-folder/file-a.js': 'export const a = 1;',
          '/my/proj/internal-folder/private-folder/file-b.js': 'export const b = 2;',
        };
        mock(fakeFs);
        const exports = {
          './exposed-folder/*.js': './internal-folder/*.js',
          './exposed-folder/private-folder/*.js': null,
        };
        const exportMapPaths = await InputDataService.getPathsFromExportMap(exports, {
          packageRootPath: '/my/proj',
        });
        expect(exportMapPaths).to.deep.equal([
          { internal: './internal-folder/file-a.js', exposed: './exposed-folder/file-a.js' },
        ]);
      });

      // TODO: short notation => {"exports": "./index.js"}

      describe('ResolveMode', () => {
        it('has nodeResolveMode "default" when nothing specified', async () => {
          const fakeFs = {
            '/my/proj/esm-exports/file.js': 'export const x = 0;',
            '/my/proj/cjs-exports/file.cjs': 'export const x = 0;',
          };
          mock(fakeFs);
          const exports = {
            './*': { default: './esm-exports/*', require: './cjs-exports/*' },
          };
          const exportMapPaths = await InputDataService.getPathsFromExportMap(exports, {
            packageRootPath: '/my/proj',
          });
          expect(exportMapPaths).to.deep.equal([
            { internal: './esm-exports/file.js', exposed: './file.js' },
          ]);
        });

        it('supports nodeResolveMode "require"', async () => {
          const fakeFs = {
            '/my/proj/esm-exports/file.js': 'export const x = 0;',
            '/my/proj/cjs-exports/file.cjs': 'export const x = 0;',
          };
          mock(fakeFs);
          const exports = {
            './*': { default: './esm-exports/*', require: './cjs-exports/*' },
          };

          const exportMapPaths = await InputDataService.getPathsFromExportMap(exports, {
            packageRootPath: '/my/proj',
            nodeResolveMode: 'require',
          });
          expect(exportMapPaths).to.deep.equal([
            { internal: './cjs-exports/file.cjs', exposed: './file.cjs' },
          ]);
        });

        it('supports other arbitrary nodeResolveModes (like "develop")', async () => {
          const fakeFs = {
            '/my/proj/esm-exports/file.js': 'export const x = 0;',
            '/my/proj/develop-exports/file.js': 'export const x = 0;',
          };
          mock(fakeFs);
          const exports = {
            './*': { default: './esm-exports/*', develop: './develop-exports/*' },
          };

          const exportMapPaths = await InputDataService.getPathsFromExportMap(exports, {
            packageRootPath: '/my/proj',
            nodeResolveMode: 'develop',
          });
          expect(exportMapPaths).to.deep.equal([
            { internal: './develop-exports/file.js', exposed: './file.js' },
          ]);
        });

        it('without "*" in key', async () => {
          const fakeFs = {
            '/my/proj/index.js': 'export const a = 1;',
            '/my/proj/file.js': 'export const b = 2;',
          };
          mock(fakeFs);

          const exports = {
            '.': {
              default: './index.js',
            },
            './exposed-file.js': {
              default: './file.js',
            },
          };

          const exportMapPaths = await InputDataService.getPathsFromExportMap(exports, {
            packageRootPath: '/my/proj',
          });
          expect(exportMapPaths).to.deep.equal([
            { internal: './index.js', exposed: '.' },
            { internal: './file.js', exposed: './exposed-file.js' },
          ]);
        });
      });

      describe('Deprecated root mappings ("/" instead of "/*")', () => {
        it('works for values defined as strings', async () => {
          const fakeFs = {
            '/my/proj/internal-folder/file-a.js': 'export const a = 1;',
            '/my/proj/internal-folder/file-b.js': 'export const b = 2;',
          };
          mock(fakeFs);
          const exports = {
            // An old spec that
            './exposed-folder/': './internal-folder/',
          };
          const exportMapPaths = await InputDataService.getPathsFromExportMap(exports, {
            packageRootPath: '/my/proj',
          });
          expect(exportMapPaths).to.deep.equal([
            { internal: './internal-folder/file-a.js', exposed: './exposed-folder/file-a.js' },
            { internal: './internal-folder/file-b.js', exposed: './exposed-folder/file-b.js' },
          ]);
        });

        it('works for values defined as objects', async () => {
          const fakeFs = {
            '/my/proj/internal-folder/file-a.js': 'export const a = 1;',
            '/my/proj/internal-folder/file-b.js': 'export const b = 2;',
          };
          mock(fakeFs);
          const exports = {
            // An old spec that
            './exposed-folder/': { default: './internal-folder/' },
          };
          const exportMapPaths = await InputDataService.getPathsFromExportMap(exports, {
            packageRootPath: '/my/proj',
          });
          expect(exportMapPaths).to.deep.equal([
            { internal: './internal-folder/file-a.js', exposed: './exposed-folder/file-a.js' },
            { internal: './internal-folder/file-b.js', exposed: './exposed-folder/file-b.js' },
          ]);
        });
      });
    });
  });
});
