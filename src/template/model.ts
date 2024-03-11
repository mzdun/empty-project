// Copyright (c) 2024 Marcin Zdun
// This code is licensed under MIT license (see LICENSE for details)

export enum TemplateType {
	File,
	Symlink,
	Variable,
}

export interface TemplateBase {
	filename: string;
	type: TemplateType;
}

export interface SymlinkTemplate extends TemplateBase {
	filename: string;
	type: TemplateType.Symlink;
	symlink: string;
}

export interface FileTemplate extends TemplateBase {
	filename: string;
	type: TemplateType.File;
	content: Uint8Array;
}

export interface TemplateVar {
	prefix: Uint8Array;
	varname?: string;
}
export interface VariableTemplate extends TemplateBase {
	filename: string;
	type: TemplateType.Variable;
	chunks: TemplateVar[];
}

export type Template = FileTemplate | SymlinkTemplate | VariableTemplate;
