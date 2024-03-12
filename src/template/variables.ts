// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

export enum VarType {
	String,
	Dynamic,
}

export interface VariableBase {
	key: string;
	isPrefix?: boolean;
	isQuotable?: boolean;
	type: VarType;
}

export interface StringVariable extends VariableBase {
	type: VarType.String;
	value: string;
}

export interface DynamicVariableT<Vars> extends VariableBase {
	type: VarType.Dynamic;
	call: (varName: string, vars: Vars) => string | undefined;
}

export type VariableT<Vars> = StringVariable | DynamicVariableT<Vars>;

export class Variables {
	#vars: VariableT<Variables>[] = [];

	add(variable: VariableT<Variables>) {
		this.#vars.push(variable);
	}

	convertWith(varName: string): [string | undefined, VariableBase | undefined] {
		for (const variable of this.#vars) {
			const result = this.#convert(varName, variable);
			if (result !== undefined) return [result, variable];
		}
		return [undefined, undefined];
	}
	convert(varName: string) {
		return this.convertWith(varName)[0];
	}
	encoded(varName: string, encoder: TextEncoder) {
		return encoder.encode(this.convert(varName) ?? '');
	}

	#convert(varName: string, variable: VariableT<Variables>) {
		if (variable.isPrefix) {
			if (!varName.startsWith(variable.key)) return undefined;
		} else {
			if (varName !== variable.key) return undefined;
		}

		if (variable.type == VarType.String) return variable.value;
		return variable.call(varName, this);
	}

	static createCMakeSetup() {
		const vars = new Variables();
		vars.add(createQuotable());
		vars.add(createQuoted());
		vars.add(createReflect('PROJECT_', true));
		return vars;
	}
}

export type Variable = VariableT<Variables>;
export type DynamicVariable = DynamicVariableT<Variables>;

export function createReflect(key: string, isPrefix: boolean): DynamicVariable {
	return {
		key,
		isPrefix,
		isQuotable: false,
		type: VarType.Dynamic,
		call: (key) => `@${key}@`,
	};
}

export function createQuoted(): DynamicVariable {
	const key = 'QUOTED_';
	return {
		key,
		isPrefix: true,
		type: VarType.Dynamic,
		call: (varName, vars) => {
			const [result] = vars.convertWith(`QUOTABLE_${varName.substring(key.length)}`);
			if (result === undefined) return undefined;
			return `"${result}"`;
		},
	};
}

export function quoteString(result: string) {
	let value = result.replace(/[\\"]/g, (s) => `\\${s}`);
	const replace = { '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\v': '\\v' };
	Object.entries(replace).forEach(([key, repl]) => (value = value.replace(new RegExp(`/${key}/g`), repl)));
	return value;
}

export function createQuotable(): DynamicVariable {
	const key = 'QUOTABLE_';
	return {
		key,
		isPrefix: true,
		type: VarType.Dynamic,
		call: (varName, vars) => {
			const [result, converter] = vars.convertWith(varName.substring(key.length));
			if (result === undefined || !converter?.isQuotable) return result;
			return quoteString(result);
		},
	};
}
