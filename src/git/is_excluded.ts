// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import * as path from 'https://deno.land/std@0.218.0/path/mod.ts';
import { GitIgnoreRule, Relative } from './model.ts';
import { GitIgnore } from './model.ts';

export function loop(filename: string, matcher: (s: string) => RegExpMatchArray | null) {
	while (true) {
		const result = matcher(filename);
		if (result !== null) {
			return result;
		}

		const prev = filename;
		filename = path.dirname(filename);
		if (prev === filename || filename === '') break;
	}
	return null;
}

export function matches(filename: string, { pattern, relative }: GitIgnoreRule) {
	switch (relative) {
		case Relative.No:
			return loop(filename, (filename) => path.basename(filename).match(pattern));
		case Relative.Mid:
			return loop(filename, (filename) => filename.match(pattern));
		case Relative.Start:
			break;
	}
	return loop(filename, (filename) => `/${filename}`.match(pattern));
}

export function isExcluded(filename: string, gitignore: GitIgnore[]) {
	let excluded = false;

	for (const { prefix, excludes, includes } of gitignore) {
		if (!filename.startsWith(prefix)) continue;
		const relative = path.relative(prefix, filename);

		if (!excluded) {
			excluded = excludes.some((rule) => matches(relative, rule) !== null);
		}
		if (!excluded) continue;

		excluded = !includes.some((rule) => matches(relative, rule) !== null);
	}

	return excluded;
}
