// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import * as path from 'https://deno.land/std@0.218.0/path/mod.ts';
import { parseArgs } from 'https://deno.land/std@0.218.0/cli/parse_args.ts';
import { quoteString } from './template/mod.ts';

function getModuleDir(importMeta: ImportMeta): string {
	return path.resolve(path.dirname(path.dirname(path.fromFileUrl(importMeta.url))));
}

function usage({ error, VARS = {} }: { error?: string; VARS?: Record<string, string | undefined> }) {
	console.log('deno task main [-h] [-t <dir>] [-n <val>] [-p <val>] [-d <val>] [-o <dir>]');
	if (error) {
		console.log(`
${error}`);
	}

	console.log(`
Optional flags:
  -h --help              show this message and exit
  -t --template <dir>    set the directory to copy project from; defaults to
                         ${path.join(getModuleDir(import.meta), 'template')}
  -n --name <val>        value for the @APP_NAME@ variable; defaults to
                         unknown-project
  -p --prefix <val>      value for the @APP_PREFIX@ variable; defaults to APP_NAME, upper cased and with all dashes replaced by underscore
                         (e.g. UNKNOWN_PROJECT)
  -d --description <val> value for the @APP_DESCRIPTION@ variable
  -o --output <dir>      value of the directory to put the template in; defaults to APP_NAME`);

	const vars = Object.entries(VARS);
	if (vars.length > 0) {
		console.log(`
Current values:
${
			vars.map((
				[key, value],
			) => value === undefined ? '' : ` @${key}@: ${quoteString(value)}`).filter((line) => line !== '').join('\n')
		}`);
	}
}

export function getArgs() {
	const boolean = ['help'];
	const string = ['tag', 'template', 'name', 'prefix', 'description', 'output'];
	const alias = { help: 'h', template: 't', name: 'n', prefix: 'p', description: 'd', output: 'o' };
	const defaults = { template: path.join(getModuleDir(import.meta), 'template'), name: 'unknown-project' };
	const args = parseArgs(Deno.args, { boolean, string, alias, default: defaults });

	const known = new Set([...boolean, ...string, ...Object.keys(alias), ...Object.values(alias), '_']);
	const unknown = Object.keys(args).find((key) => !known.has(key));

	if (unknown !== undefined) {
		const errName = unknown.length === 1 ? `-${unknown}` : `--${unknown}`;
		usage({ error: `Unknown argument: ${errName}` });
		Deno.exit(1);
	}

	const template = args.template ?? path.join(getModuleDir(import.meta), 'template');
	const name = args.name ?? 'unknown-project';
	const prefix = args.prefix ?? name.toUpperCase().replace(/-/g, '_');
	const description = args.description;
	const output = args.output ?? name;

	const VARS: Record<string, string | undefined> = {
		APP_NAME: name,
		APP_PREFIX: prefix,
		APP_DESCRIPTION: description,
	};

	if (args.help) {
		usage({ VARS });
		Deno.exit(0);
	}
	return { template, output, VARS };
}
