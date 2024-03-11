// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import { assertEquals } from 'https://deno.land/std@0.218.0/assert/mod.ts';
import { describe, it } from 'https://deno.land/std@0.218.0/testing/bdd.ts';
import { prepareVirtualFile } from 'https://deno.land/x/mock_file@v1.1.2/mod.ts';
import { compile, GitIgnore, isExcluded, matches, readGitIgnore } from './mod.ts';

describe('matches()', () => {
	interface MatchTest {
		pattern: string;
		filename: string;
		expected?: boolean;
	}

	function matchFunction({ pattern, filename, expected = true }: MatchTest) {
		const rule = compile(pattern);
		const match = matches(filename, rule);
		const actual = match !== null;
		assertEquals(
			actual,
			expected,
			`rule is {pattern: ${rule.pattern}, relative: ${rule.relative}}, match is: ${match}`,
		);
	}

	const tests: MatchTest[] = [
		{
			pattern: '/external/submodule',
			filename: 'external/submodule/src/main.cpp',
		},
		{
			pattern: 'dir/subdir',
			filename: 'dir/subdir/src/main.cpp',
		},
		{
			pattern: '*.ext',
			filename: 'dir1/dir2/dir3.ext2/main.ext',
		},
		{
			pattern: '*.ext',
			filename: 'dir1/dir2/dir3.ext/main.ext2',
		},

		{
			pattern: '/external/submodule',
			filename: 'external/submodules/src/main.cpp',
			expected: false,
		},
		{
			pattern: 'dir/subdir',
			filename: 'another-dir/dir/subdir/src/main.cpp',
			expected: false,
		},
		{
			pattern: '*.ext',
			filename: 'dir1/dir2/dir3.ext2/main.ext2',
			expected: false,
		},
	];

	for (const params of tests) {
		const { pattern, filename, expected = true } = params;
		it(`should ${expected ? '' : 'not '}match "${pattern}" to "${filename}"`, () => matchFunction(params));
	}
});

Deno.test('isExcluded()', { permissions: { read: true } }, async (test) => {
	interface ExcludeTest {
		gitignore: GitIgnore;
		accepted: string[];
		rejected: string[];
		label?: string;
	}

	function excludeFunction(gitignore: GitIgnore, filename: string, excluded: boolean) {
		const actual = isExcluded(filename, [gitignore]);
		assertEquals(actual, excluded);
	}

	prepareVirtualFile(
		'project/.gitignore',
		new TextEncoder().encode(`
build/
dist/
!build/version.h
*.pyc
*.exe
*.obj
`),
	);

	const [projectGitIgnore] = await readGitIgnore('project/.gitignore');

	const tests: ExcludeTest[] = [{
		gitignore: {
			prefix: '',
			excludes: [
				compile('.git'),
				compile('/external/json'),
				compile('/external/libarch'),
			],
			includes: [],
		},
		label: 'generated root .gitignore',
		accepted: ['.gits/config', 'external/CMakeLists.txt', 'side/external/json/CMakeLists.txt'],
		rejected: [
			'.git/config',
			'external/json/CMakeLists.txt',
			'external/json/conanfile.txt',
			'external/libarch/CMakeLists.txt',
			'external/libarch/examples/expand.cc',
			'external/libarch/include/arch/archive.hh',
			'external/libarch/include/arch/base/archive.hh',
			'external/libarch/LICENSE',
			'external/libarch/README.md',
			'external/libarch/src/archive.cc',
			'external/libarch/src/base/archive.cc',
		],
	}, {
		gitignore: {
			prefix: 'tools',
			excludes: [
				compile('*.pyc'),
			],
			includes: [],
		},
		label: 'Python tools',
		accepted: ['tools/tool-name/tool.py', 'app/code-gen.py', 'app/code-gen.pyc'],
		rejected: ['tools/tool-name/tool.pyc'],
	}, {
		gitignore: projectGitIgnore,
		label: 'readGitIgnore',
		accepted: ['build/a.exe', 'build/version.h', 'project/build/version.h'],
		rejected: ['project/build/a.out', 'project/a.exe'],
	}];

	let index = 0;
	for (const params of tests) {
		index += 1;
		await test.step(params.label ?? `.gitignore #${index}`, async (test) => {
			// console.log([params.gitignore]);
			for (const filename of params.accepted) {
				await test.step(`should not exclude "${filename}"`, () =>
					excludeFunction(params.gitignore, filename, false));
			}
			for (const filename of params.rejected) {
				await test.step(`should exclude "${filename}"`, () =>
					excludeFunction(params.gitignore, filename, true));
			}
		});
	}
});
