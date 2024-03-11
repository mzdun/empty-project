// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import * as path from 'https://deno.land/std@0.218.0/path/mod.ts';
import { readTemplates, SymlinkTemplate, TemplateType, TemplateVar } from './src/template/mod.ts';
import { gitExecutableFiles, gitSubmodules, gitTopLevel } from './src/git/mod.ts';
import { createQuotable, createQuoted, createReflect, Variables, VarType } from './src/template/mod.ts';
import { getArgs } from './src/args.ts';
import { posixPath } from './src/path.ts';
import { gitInit } from './src/git/cli.ts';
import { gitAdd } from './src/git/cli.ts';

const args = getArgs();
console.log(args);

try {
	await Deno.remove(args.output, { recursive: true });
} catch (_e) {
	// empty
}

await Deno.mkdir(args.output, { recursive: true });
if ((await gitTopLevel(args.output)) === undefined) {
	await gitInit(args.output);
}

const gitExecs = await gitExecutableFiles(args.template);
const gitModules = (await gitSubmodules(args.template) ?? []).map((dir) => `/${dir}`);

const execs = new Set(gitExecs ?? []);

const _vars = new Variables();
_vars.add(createQuotable());
_vars.add(createQuoted());
_vars.add(createReflect('PROJECT_', true));
_vars.add({ key: 'YEAR', type: VarType.String, value: `${new Date().getFullYear()}` });
Object.entries(args.VARS).forEach(([key, value]) => {
	if (value != undefined) {
		_vars.add({ key, type: VarType.String, isQuotable: true, value });
	}
});

async function copyFile(filename: string, chunks: TemplateVar[], vars: Variables) {
	await Deno.mkdir(path.dirname(filename), { recursive: true });

	const output = await Deno.open(filename, { create: true, write: true });
	let length = 0;
	try {
		const encoder = new TextEncoder();
		for (const { prefix, varname } of chunks) {
			await output.write(prefix);
			length += prefix.length;

			if (varname !== undefined) {
				const value = vars.encoded(varname, encoder);
				await output.write(value);
				length += value.length;
			}
		}
	} finally {
		output.close();
	}

	return length;
}

const symlinks: SymlinkTemplate[] = [];
const [filesToAdd, execFilesToAdd]: string[][] = [[], []];

await readTemplates(args.template, gitModules, async (file) => {
	const exeFlag = execs.has(file.filename) ? 'x' : '-';
	const filename = `${posixPath(path.join(args.output, file.filename))}`;
	(execs.has(file.filename) ? execFilesToAdd : filesToAdd).push(file.filename);
	if (file.type === TemplateType.Symlink) {
		symlinks.push(file);
		return;
	}

	let size = 0;
	if (file.type === TemplateType.File) {
		size = await copyFile(filename, [{ prefix: file.content }], _vars);
	} else if (file.type === TemplateType.Variable) {
		size = await copyFile(filename, file.chunks, _vars);
	}

	console.log(`-${exeFlag} ${filename}: ${size}`);
});

for (const link of symlinks) {
	const exeFlag = execs.has(link.filename) ? 'x' : '-';
	const newName = path.join(args.output, link.filename);
	const oldName = path.join(path.dirname(newName), link.symlink);
	await Deno.symlink(oldName, newName);
	console.log(`s${exeFlag} ${posixPath(newName)} -> ${link.symlink}`);
}

await gitAdd(args.output, filesToAdd).then(() => gitAdd(args.output, execFilesToAdd, true));
