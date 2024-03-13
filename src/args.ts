// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import * as path from 'https://deno.land/std@0.218.0/path/mod.ts';
import { parseArgs } from 'https://deno.land/std@0.218.0/cli/parse_args.ts';
import { quoteString } from './template/mod.ts';
import { posixPath } from './path.ts';

const CXX_STANDARD = '23';

function apply<T, Q>(value: T | undefined, fn: (t: T) => Q): Q | undefined {
	if (value === undefined) return undefined;
	return fn(value);
}

interface VariableInfo {
	name: string[];
	help?: string;
	required?: boolean;
	default?: string;
	defaultsTo?: string;
	canHaveEpVar?: boolean;
}
const VARIABLES: Record<string, VariableInfo> = {
	APP_NAME: { name: ['n', 'name'], required: true },
	APP_DESCRIPTION: { name: ['d', 'description'], required: true },
	APP_PREFIX: {
		name: ['p', 'prefix'],
		defaultsTo: 'APP_NAME, upper cased and with all dashes replaced by underscore (e.g. "UNKNOWN_PROJECT")',
	},
	APP_AUTHOR: { name: ['a', 'author'], defaultsTo: "Git's user.name inside output directory", canHaveEpVar: true },
	APP_AUTHOR_EMAIL: {
		name: ['ae', 'author-email'],
		defaultsTo: "Git's user.email inside output directory",
		canHaveEpVar: true,
	},
	APP_GITHUB_ORG: { name: ['gh', 'github-org'], default: '<github>', canHaveEpVar: true },
	APP_VENDOR: { name: ['vendor'], canHaveEpVar: true },
	CXX_STANDARD: {
		name: ['std'],
		help: 'C++ standard to use in the project',
		default: CXX_STANDARD,
		canHaveEpVar: true,
	},
};

function getTemplateDir(): string | undefined {
	if (import.meta.dirname === undefined) return undefined;
	const result = path.resolve(path.join(import.meta.dirname, '../template'));
	if (!Deno.statSync(result).isDirectory) return undefined;
	return result;
}

function printableTemplateDir() {
	const dir = getTemplateDir();
	if (dir === undefined) return undefined;
	return `"${quoteString(posixPath(dir))}"`;
}

export function printedVars(VARS: Record<string, string | undefined>) {
	return Object.entries(VARS).map((
		[key, value],
	) => value === undefined ? '' : ` @${key}@: "${quoteString(value)}"`).filter((line) => line !== '').join('\n');
}

function argName(arg: string) {
	return arg.length === 1 ? `-${arg}` : `--${arg}`;
}

function quoted(s: string) {
	return `"${quoteString(s)}"`;
}

function defaultFor(key: string, info: VariableInfo) {
	if (!info.canHaveEpVar) return info.default;
	return Deno.env.get(`EP_${key}`) ?? info.default;
}

function helpFor(name: string, info: VariableInfo) {
	const help = info.help ?? `value for the @${name}@ variable`;
	const defValue = defaultFor(name, info);
	const fromEnv = defValue !== info.default;
	const quotedDefault = apply(defValue, quoted);
	const defaultsTo = apply(
		info.defaultsTo ?? (fromEnv ? `${quotedDefault} (from $EP_${name})` : quotedDefault),
		(value: string) => `defaults to ${value}`,
	);
	return [help, defaultsTo].filter((line) => line !== undefined).join('; ');
}

function usageOption(prefixWidth: number, columns: number, prefix: string, words: string[]) {
	const result: string[] = [];
	let line = [`  ${prefix.padEnd(prefixWidth - 2)}`];
	let used = prefixWidth;
	words.forEach((word) => {
		while (true) {
			const newUsed = used + 1 + word.length;
			if (used === prefixWidth || newUsed <= columns) {
				line.push(word);
				used = newUsed;
				return;
			}

			result.push(line.join(' '));
			line = [' '.padEnd(prefixWidth)];
			used = prefixWidth;
		}
	});
	if (line.length > 0) result.push(line.join(' '));
	return result.join('\n');
}

function usage({ error, VARS = {} }: { error?: string; VARS?: Record<string, string | undefined> }) {
	const options: [string, string[]][] = [
		['-h --help', 'show this message and exit'],
		['-t --template <dir>', `set the directory to copy project from; defaults to ${printableTemplateDir()}`],
		['-o --output <dir>', 'value of the directory to put the template in; defaults to APP_NAME'],
		...Object.entries(VARIABLES).map((
			[name, info],
		): [string, string] => [`${info.name.map(argName).join(' ')} <val>`, helpFor(name, info)]),
	].map(([prefix, descr]) => [prefix, descr.split(/\s+/)]);
	const prefixWidth = options.reduce((prev, opt) => Math.max(prev, opt[0].length), 0) + 2;
	const { columns } = Deno.consoleSize();

	console.log(
		`empty-project [-h] [-t <dir>] [-o <dir>] ${
			Object.values(VARIABLES).map((info) =>
				info.required ? `${argName(info.name[0])} <val>` : `[${argName(info.name[0])} <val>]`
			).join(' ')
		}`,
	);
	if (error) {
		console.log(`
${error}`);
	}

	console.log('\nOptional flags:');
	console.log(options.map(([prefix, words]) => usageOption(prefixWidth, columns, prefix, words)).join('\n'));

	const vars = printedVars(VARS);
	if (vars.length > 0) {
		console.log(`
Current values:
${vars}`);
	}
}

export function getArgs() {
	const boolean = ['help'];
	const string = [
		'tag',
		'template',
		'output',
		...Object.values(VARIABLES).map((info) => info.name[0]),
	];
	const alias = {
		help: 'h',
		output: 'o',
		...Object.fromEntries(
			Object.values(VARIABLES).filter((info) => info.name[1]).map((info) => [info.name[0], info.name[1]]),
		),
	};
	const defaults = {
		template: getTemplateDir(),
		...Object.fromEntries(
			Object.entries(VARIABLES).map(([key, info]) => [info.name[0], defaultFor(key, info)]).filter((
				[_name, defValue],
			) => defValue !== undefined),
		),
	};
	const args = parseArgs(Deno.args, { boolean, string, alias, default: defaults });

	const known = new Set([...boolean, ...string, ...Object.keys(alias), ...Object.values(alias), '_']);
	const unknown = Object.keys(args).find((key) => !known.has(key));

	if (unknown !== undefined) {
		const errName = unknown.length === 1 ? `-${unknown}` : `--${unknown}`;
		usage({ error: `Unknown argument: ${errName}` });
		Deno.exit(1);
	}

	const missing = Object.values(VARIABLES).find((info) => info.required && args[info.name[0]] === undefined);
	if (missing !== undefined) {
		const errName = missing.name[0].length === 1 ? `-${missing.name[0]}` : `--${missing.name[0]}`;
		usage({ error: `Required argument missing: ${errName}` });
		Deno.exit(1);
	}

	const VARS: Record<string, string | undefined> = Object.fromEntries(
		Object.entries(VARIABLES).map(([key, info]): [string, string | undefined] => [key, args[info.name[0]]]),
	);
	const template = apply(args.template, posixPath);
	const output = args.output ?? VARS.APP_NAME!;

	if (args.help) {
		usage({ VARS });
		Deno.exit(0);
	}

	if (template === undefined) {
		usage({ error: `--template is required when running from GitHub` });
		Deno.exit(1);
	}

	return { template, output, VARS };
}
