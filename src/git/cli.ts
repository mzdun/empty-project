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

async function _runGit(options?: Deno.CommandOptions) {
	const cmd = new Deno.Command('git', options);
	const result = await cmd.output();
	const { stderr } = result;
	if (stderr.length) throw Error(new TextDecoder().decode(stderr).trim());
	return result;
}

async function _gitTopLevel(cwd: string) {
	const cmd = new Deno.Command('git', {
		args: ['rev-parse', '--show-toplevel'],
		cwd,
	});
	const { stdout } = await cmd.output();
	if (stdout.length === 0) return undefined;
	return new TextDecoder('utf-8').decode(stdout).trim();
}

async function _gitInit(cwd: string) {
	await _internal.runGit({
		args: ['init'],
		cwd,
	});
}

async function _gitAdd(cwd: string, paths: string[], isExecutable?: boolean) {
	const { stdout } = await _internal.runGit({
		args: isExecutable ? ['add', '--chmod=+x', ...paths] : ['add', ...paths],
		cwd,
	});
	if (stdout.length) console.log(new TextDecoder().decode(stdout).trim());
}

async function _gitLsFiles(cwd: string) {
	const { stdout } = await _internal.runGit({
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

export const _internal = {
	runGit: _runGit,
	gitTopLevel: _gitTopLevel,
	gitInit: _gitInit,
	gitLsFiles: _gitLsFiles,
	gitAdd: _gitAdd,
};

export interface GitInitOptions {
	init?: boolean;
	lsFiles?: boolean;
}
export class Git {
	topLevel?: string;
	files: GitLsFile[] = [];
	ready: Promise<void>;
	constructor(public readonly cwd: string, options?: GitInitOptions) {
		this.ready = this.#init(options);
	}

	async #init({ init, lsFiles }: GitInitOptions = {}) {
		this.topLevel = await _internal.gitTopLevel(this.cwd);
		if (this.topLevel === undefined) {
			if (!init) return;
			await _internal.gitInit(this.cwd);
			this.topLevel = await _internal.gitTopLevel(this.cwd);
			if (this.topLevel === undefined) return;
		}
		if (lsFiles) this.files = await _internal.gitLsFiles(this.topLevel);
	}

	async lsFilesFilteredBy(filter: GitFilesMode) {
		await this.ready;
		if (!this.topLevel) return [];
		const mapper = mapName(this.cwd, this.topLevel);
		return this.files.filter(({ mode }) => mode === filter).map(mapper);
	}

	async executableFiles() {
		return await this.lsFilesFilteredBy(GitFilesMode.EXE);
	}

	async submodules() {
		return await this.lsFilesFilteredBy(GitFilesMode.MODULE);
	}

	async add(paths: string[], isExecutable?: boolean) {
		return await _internal.gitAdd(this.cwd, paths, isExecutable);
	}
}
