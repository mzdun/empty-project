// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import * as path from 'https://deno.land/std@0.218.0/path/mod.ts';
import { posixPath } from '../path.ts';

export enum GitFilesMode {
	FILE = 0o100644,
	EXE = 0o100755,
	MODULE = 0o160000,
	SYM_LINK = 0o120000,
}

export interface GitLsFile {
	mode: number;
	object: string;
	name: string;
}

async function runGit(options?: Deno.CommandOptions) {
	const cmd = new Deno.Command('git', options);
	const result = await cmd.output();
	const { stderr } = result;
	if (stderr.length) throw Error(new TextDecoder().decode(stderr).trim());
	return result;
}

export async function gitTopLevel(cwd: string) {
	const cmd = new Deno.Command('git', {
		args: ['rev-parse', '--show-toplevel'],
		cwd,
	});
	const { stdout } = await cmd.output();
	if (stdout.length === 0) return undefined;
	return new TextDecoder('utf-8').decode(stdout).trim();
}

export async function gitInit(cwd: string) {
	await runGit({
		args: ['init'],
		cwd,
	});
}

export async function gitAdd(cwd: string, paths: string[], isExecutable?: boolean) {
	const { stdout } = await runGit({
		args: isExecutable ? ['add', '--chmod=+x', ...paths] : ['add', ...paths],
		cwd,
	});
	if (stdout.length) console.log(new TextDecoder().decode(stdout).trim());
}

export async function gitLsFiles(cwd: string) {
	const { stdout } = await runGit({
		args: ['ls-files', '-s'],
		cwd,
	});

	return new TextDecoder('utf-8').decode(stdout).trim().split('\n').map((line): GitLsFile => {
		const [cfg, name] = line.split('\t', 2);
		const [smode, object] = cfg.split(/\s+/);
		const mode = parseInt(smode, 8);
		return { mode, object, name: posixPath(name) };
	});
}

const mapName = (cwd: string, topLevel: string) => ({ name }: GitLsFile) =>
	posixPath(path.relative(cwd, path.resolve(path.join(topLevel, name))));

export async function gitExecutableFiles(cwd: string) {
	const topLevel = await gitTopLevel(cwd);
	if (topLevel === undefined) return undefined;
	const mapper = mapName(cwd, topLevel);
	return (await gitLsFiles(topLevel)).filter(({ mode }) => mode === GitFilesMode.EXE).map(mapper);
}

export async function gitSubmodules(cwd: string) {
	const topLevel = await gitTopLevel(cwd);
	if (topLevel === undefined) return undefined;
	const mapper = mapName(cwd, topLevel);
	return (await gitLsFiles(topLevel)).filter(({ mode }) => mode === GitFilesMode.MODULE).map(mapper);
}
