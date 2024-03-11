// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import * as path from 'https://deno.land/std@0.218.0/path/mod.ts';
import { globToRegExp } from 'https://deno.land/std@0.218.0/path/glob_to_regexp.ts';
import { Relative } from './model.ts';
import { GitIgnore } from './model.ts';
import { posixPath } from '../path.ts';

export function compile(line: string) {
	const pattern = globToRegExp(line);
	const isRelative = line.substring(0, line.length - 1).includes('/');
	const isStart = isRelative && line.startsWith('/');
	return { pattern, relative: isRelative ? isStart ? Relative.Start : Relative.Mid : Relative.No };
}

export async function readGitIgnore(fullPath: string, dirname: string): Promise<[GitIgnore, Uint8Array]> {
	const data = await Deno.readFile(fullPath);
	const lines = new TextDecoder('utf-8')
		.decode(data)
		.split('\n')
		.map((line) => line.split('#', 2)[0].trim())
		.filter((line) => line !== '');
	const excludes = lines.filter((line) => !line.startsWith('!')).map(compile);
	const includes = lines.filter((line) => line.startsWith('!')).map((line) => compile(line.substring(1)));
	const temp = posixPath(path.join(path.relative(dirname, path.dirname(fullPath)), 'x'));
	const prefix = temp.substring(0, temp.length - 1);
	return [{ prefix, excludes, includes }, data];
}
