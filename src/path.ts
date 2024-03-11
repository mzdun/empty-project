// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import * as path from 'https://deno.land/std@0.218.0/path/mod.ts';

const SEPARATOR_PATTERN = new RegExp(path.SEPARATOR_PATTERN.source, path.SEPARATOR_PATTERN.flags + 'g');

export function posixPath(filename: string) {
	if (path.SEPARATOR !== '/') {
		return filename.replace(SEPARATOR_PATTERN, '/');
	}
	return filename;
}

export function templatePath(dirname: string, filename: string) {
	return posixPath(path.relative(dirname, filename));
}
