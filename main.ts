// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import * as path from 'https://deno.land/std@0.218.0/path/mod.ts';
import { Git } from './src/git/mod.ts';
import { getArgs, printedVars } from './src/args.ts';
import { TemplateWriter } from './src/template/mod.ts';
import { posixPath } from './src/path.ts';

export async function openDstRepo(directory: string) {
	try {
		await Deno.remove(directory, { recursive: true });
	} catch (e) {
		if (e.code == 'EBUSY') throw e;
	}

	await Deno.mkdir(directory, { recursive: true });
	return await new Git(directory, { init: true }).initialized;
}

export async function copyTemplates(
	repo: Git,
	input: string,
	vars: Record<string, string | undefined>,
	onMissingVariable?: (_: string) => void,
) {
	const { execs, excluded } = await (async () => {
		const srcRepo = new Git(input, { lsFiles: true });
		const execs = new Set(await srcRepo.executableFiles());
		const excluded = (await srcRepo.submodules()).map((dir) => `/${dir}`);
		return { execs, excluded };
	})();

	await new TemplateWriter(repo, execs, vars, onMissingVariable).copyTemplates(input, excluded);
}

async function _main() {
	const args = getArgs();
	const repo = await openDstRepo(args.output);

	await Promise.all(([
		['APP_AUTHOR', () => repo.userName()],
		['APP_AUTHOR_EMAIL', () => repo.userEmail()],
	] as [string, () => Promise<string>][]).map(async ([key, getter]) => {
		if (args.VARS[key] === undefined) {
			args.VARS[key] = await getter();
		}
	}));

	const template = (() => {
		if (!import.meta.dirname) return args.template;
		return posixPath(path.join('$EP_HOME', path.relative(import.meta.dirname, args.template)));
	})();

	console.log(`Creating \x1b[0;36m${args.output}\x1b[m from \x1b[0;36m${template}\x1b[m`);
	const vars = printedVars(args.VARS, { key: '0;33', value: '0;32' });
	if (vars.length) {
		console.log('Using:');
		console.log(vars);
	}
	console.log('');

	const missingVars: Set<string> = new Set();
	await copyTemplates(repo, args.template, args.VARS, (varName) => missingVars.add(varName));

	if (missingVars.size > 0) {
		console.warn(
			`Some used variables were not set:\n${
				Array.from(missingVars).sort().map((name) => `  - ${name}`).join('\n')
			}`,
		);
	}
}

if (import.meta.main) {
	await _main();
}
