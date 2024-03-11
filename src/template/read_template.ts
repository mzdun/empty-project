// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

import { TemplateVar } from './model.ts';

const CHARS = '@AZaz09_';
const AT = CHARS.charCodeAt(0);
const CAP_A = CHARS.charCodeAt(1);
const CAP_Z = CHARS.charCodeAt(2);
const LOW_A = CHARS.charCodeAt(3);
const LOW_Z = CHARS.charCodeAt(4);
const DIG_0 = CHARS.charCodeAt(5);
const DIG_9 = CHARS.charCodeAt(6);
const UNDERSCORE = CHARS.charCodeAt(7);

function between(code: number, lo: number, hi: number) {
	return code >= lo && code <= hi;
}
function validName(code: number | undefined) {
	return code !== undefined &&
		(between(code, CAP_A, CAP_Z) || between(code, LOW_A, LOW_Z) || between(code, DIG_0, DIG_9) ||
			code === UNDERSCORE);
}

export async function readTemplate(filename: string) {
	const content = await Deno.readFile(filename);
	let index = content.indexOf(AT);
	if (index === -1) {
		return content;
	}

	const decoder = new TextDecoder('utf-8');
	const result: TemplateVar[] = [];
	let chunkStart = 0;

	while (index !== -1) {
		const varNameStart = index + 1;
		index = content.indexOf(AT, varNameStart);
		if (index === -1 || index === varNameStart) continue;

		let variable = true;
		for (let pos = varNameStart; pos < index; ++pos) {
			if (!validName(content.at(pos))) {
				variable = false;
				break;
			}
		}
		if (!variable) continue;

		const varname = decoder.decode(content.slice(varNameStart, index));
		result.push({ prefix: content.slice(chunkStart, varNameStart - 1), varname });
		chunkStart = index + 1;
	}
	if (chunkStart === 0) return content;
	result.push({ prefix: content.slice(chunkStart) });
	return result;
}
