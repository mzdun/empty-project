// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

export enum Relative {
	No,
	Mid,
	Start,
}

export interface GitIgnoreRule {
	pattern: RegExp;
	relative: Relative;
}

export interface GitIgnore {
	prefix: string;
	excludes: GitIgnoreRule[];
	includes: GitIgnoreRule[];
}
