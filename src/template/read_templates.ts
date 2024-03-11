// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import * as path from 'https://deno.land/std@0.218.0/path/mod.ts';
import { walk, WalkError } from 'https://deno.land/std@0.218.0/fs/walk.ts';
import { GitIgnore, isExcluded, readGitIgnore } from '../git/mod.ts';
import { templatePath } from '../path.ts';
import { Template, TemplateType } from './model.ts';
import { readTemplate } from './read_template.ts';
import { compile } from '../git/mod.ts';

export async function readTemplates(
	dirname: string,
	excludes: string[],
	onTemplate?: (template: Template) => Promise<void>,
) {
	const gitignore: GitIgnore[] = [{
		prefix: '',
		excludes: [compile('.git/'), ...excludes.map(compile)],
		includes: [],
	}];

	const files: Template[] = [];

	const storeTemplate = onTemplate ?? ((template) => {
		files.push(template);
		return Promise.resolve(undefined);
	});

	try {
		for await (const entry of walk(dirname, { includeDirs: false })) {
			const filename = templatePath(dirname, entry.path);
			if (isExcluded(filename, gitignore)) continue;

			if (entry.name === '.gitignore') {
				const [rules, content] = await readGitIgnore(entry.path, dirname);
				if ((rules.excludes.length + rules.includes.length) > 0) {
					gitignore.push(rules);
				}
				storeTemplate({ filename, type: TemplateType.File, content });

				continue;
			}

			if (entry.isSymlink) {
				const symlink = templatePath(path.dirname(entry.path), await Deno.readLink(entry.path));
				storeTemplate({ filename, type: TemplateType.Symlink, symlink });
				continue;
			}

			const content = await readTemplate(entry.path);
			if (content instanceof Uint8Array) {
				storeTemplate({ filename, type: TemplateType.File, content });
			} else {
				storeTemplate({ filename, type: TemplateType.Variable, chunks: content });
			}
		}
	} catch (e) {
		console.error(e);
		if (e instanceof WalkError) return [];
	}

	return files;
}
