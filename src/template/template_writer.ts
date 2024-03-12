// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import * as path from 'https://deno.land/std@0.218.0/path/mod.ts';
import { Git } from '../git/mod.ts';
import { posixPath } from '../path.ts';
import { SymlinkTemplate, Template, TemplateType, TemplateVar } from './model.ts';
import { Variables, VarType } from './variables.ts';
import { readTemplates } from './read_templates.ts';

function filePerms(oct: number) {
	return `${oct & 4 ? 'r' : '-'}${oct & 2 ? 'w' : '-'}${oct & 1 ? 'x' : '-'}`;
}

interface LnFile {
	filename: string;
	size: number;
	sizeLabel: string;
	permissions: number;
	link?: string;
}

export class TemplateWriter {
	#symlinks: SymlinkTemplate[] = [];
	#filesToAdd: string[] = [];
	#execFilesToAdd: string[] = [];
	#vars: Variables;
	#reportedFiles: LnFile[] = [];

	constructor(
		public readonly repo: Git,
		public readonly execs: Set<string>,
		vars: Record<string, string | undefined>,
	) {
		this.#vars = Variables.createCMakeSetup();
		this.#vars.add({ key: 'YEAR', type: VarType.String, value: `${new Date().getFullYear()}` });
		Object.entries(vars).forEach(([key, value]) => {
			if (value != undefined) {
				this.#vars.add({ key, type: VarType.String, isQuotable: true, value });
			}
		});
	}

	async copyTemplates(dirname: string, excludes: string[]) {
		this.#execFilesToAdd = [];
		this.#filesToAdd = [];
		this.#symlinks = [];
		this.#reportedFiles = [];
		await readTemplates(dirname, excludes, this.#onFile);

		for (const link of this.#symlinks) {
			await this.#linkFile(link);
		}

		this.#outputReportedFiles();

		await this.repo.add(this.#filesToAdd);
		await this.repo.add(this.#execFilesToAdd, true);
		if (Deno.build.os !== 'windows') {
			for (const file of this.#execFilesToAdd) {
				console.log(path.join(this.repo.cwd, file));
				await Deno.chmod(path.join(this.repo.cwd, file), 0o755);
			}
		}
	}

	#onFile = async (file: Template) => {
		const filename = `${posixPath(path.join(this.repo.cwd, file.filename))}`;
		const isExec = this.execs.has(file.filename);
		(isExec ? this.#execFilesToAdd : this.#filesToAdd).push(file.filename);
		if (file.type === TemplateType.Symlink) {
			this.#symlinks.push(file);
			return;
		}

		let size = 0;
		if (file.type === TemplateType.File) {
			size = await this.#copyFile(filename, [{ prefix: file.content }]);
		} else if (file.type === TemplateType.Variable) {
			size = await this.#copyFile(filename, file.chunks);
		}

		this.#reportFile(filename, isExec ? 0o755 : 0o644, size);
	};

	async #copyFile(filename: string, chunks: TemplateVar[]) {
		await Deno.mkdir(path.dirname(filename), { recursive: true });

		const output = await Deno.open(filename, { create: true, write: true });
		let length = 0;
		try {
			const encoder = new TextEncoder();
			for (const { prefix, varname } of chunks) {
				await output.write(prefix);
				length += prefix.length;

				if (varname !== undefined) {
					const value = this.#vars.encoded(varname, encoder);
					await output.write(value);
					length += value.length;
				}
			}
		} finally {
			output.close();
		}

		return length;
	}

	async #linkFile(link: SymlinkTemplate) {
		const newName = path.join(this.repo.cwd, link.filename);
		const oldName = path.join(path.dirname(newName), link.symlink);
		const isDirectory = (await Deno.statSync(oldName)).isDirectory;
		await Deno.symlink(link.symlink, newName, { type: isDirectory ? 'dir' : 'file' });
		this.#reportFile(
			posixPath(newName),
			this.execs.has(link.filename) ? 0o755 : 0o644,
			new TextEncoder().encode(link.symlink).length,
			link.symlink,
		);
	}

	#reportFile(filename: string, permissions: number, size: number, link?: string) {
		let suffix = '';
		let humanSize = size * 10;
		if (humanSize > 10240) {
			suffix = 'K';
			humanSize = Math.floor(humanSize / 1024);
			if (humanSize > 10240) {
				suffix = 'M';
				humanSize = Math.floor(humanSize / 1024);

				if (humanSize > 10240) {
					suffix = 'G';
					humanSize = Math.floor(humanSize / 1024);
				}
			}
		}
		const rem = humanSize % 10;
		const whole = (humanSize - rem) / 10;
		const remStr = rem ? `.${rem}` : '';

		this.#reportedFiles.push({ filename, permissions, size, sizeLabel: `${whole}${remStr}${suffix}`, link });
	}

	#outputReportedFiles() {
		this.#reportedFiles.sort((a, b) => a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0);
		const labelLength = this.#reportedFiles.reduce((length, file) => Math.max(length, file.sizeLabel.length), 0);
		this.#reportedFiles.forEach(({ filename, link, permissions, sizeLabel }) => {
			const fileType = link ? 'l' : '-';
			const filePermissions = `${filePerms((permissions >> 6) & 7)}${filePerms((permissions >> 3) & 7)}${
				filePerms((permissions >> 0) & 7)
			}`;
			const sizeString = sizeLabel.padStart(labelLength);
			const linked = link ? ` -> ${link}` : '';
			console.log(`${fileType}${filePermissions} ${sizeString} ${filename}${linked}`);
		});
	}
}