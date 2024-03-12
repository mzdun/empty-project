// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import { Git } from './src/git/mod.ts';
import { getArgs } from './src/args.ts';
import { TemplateWriter } from './src/template/mod.ts';

export async function openDstRepo(directory: string) {
	try {
		await Deno.remove(directory, { recursive: true });
	} catch (e) {
		if (e.code == 'EBUSY') throw e;
	}

	await Deno.mkdir(directory, { recursive: true });
	return await new Git(directory, { init: true }).initialized;
}

export async function copyTemplates(repo: Git, input: string, vars: Record<string, string | undefined>) {
	const { execs, excluded } = await (async () => {
		const srcRepo = new Git(input, { lsFiles: true });
		const execs = new Set(await srcRepo.executableFiles());
		const excluded = (await srcRepo.submodules()).map((dir) => `/${dir}`);
		return { execs, excluded };
	})();

	await new TemplateWriter(repo, execs, vars).copyTemplates(input, excluded);
}

async function _main() {
	const args = getArgs();
	console.log(args);

	const repo = await openDstRepo(args.output);
	await copyTemplates(repo, args.template, args.VARS);
}

if (import.meta.main) {
	await _main();
}
