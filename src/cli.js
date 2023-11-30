#!/usr/bin/env node
const fs = require("node:fs/promises")
const path = require("node:path")
const process = require("node:process")

async function findFunctionsToBeExported(dir, context = null) {
	if (context === null) context = [];

	const entries = await fs.readdir(dir)

	for (const entry of entries) {
		const entry_path = path.join(dir, entry)
		const stat = await fs.lstat(entry_path)

		if (stat.isFile() && entry.endsWith(".fn.mjs")) {
			context.push(entry_path)
		} else if (stat.isDirectory()) {
			await findFunctionsToBeExported(entry_path, context)
		}
	}

	return context
}

async function getExportedFunctions(dir) {
	const dir_resolved = await fs.realpath(dir)
	const files = await findFunctionsToBeExported(dir_resolved)
	const fns = []

	for (const file of files) {
		const relative_path = path.relative(dir_resolved, file)
		const fn_name = path.basename(file).slice(0, -(".fn.mjs").length)

		fns.push({
			fn_name,
			relative_path
		})
	}

	return fns
}

function createImports(functions) {
	let tmp = ""

	for (const {fn_name, relative_path} of functions) {
		tmp += `import ${fn_name}_impl from "./${relative_path}"\n`
	}

	return tmp
}

function createExports(functions) {
	let tmp = ""

	for (const {fn_name} of functions) {
		tmp += `export const ${fn_name} = ${fn_name}_impl;\n`
	}

	return tmp
}

function createDefaultExport(functions) {
	let tmp = "export default {\n"

	tmp += functions.map(({fn_name}) => `   ${fn_name}`).join(",\n")

	return `${tmp}\n}`
}

async function main(dir) {
	const functions = await getExportedFunctions(dir)
	let source_code = "/* Warning! This file was automatically created! */\n"

	source_code += createImports(functions)
	source_code += "\n"
	source_code += createExports(functions)
	source_code += "\n"
	source_code += createDefaultExport(functions)
	source_code += "\n"

	process.stderr.write(`Writing ${path.join(dir, "_index.mjs")}\n`)

	await fs.writeFile(
		path.join(dir, "_index.mjs"), source_code
	)
}

if (process.argv.length !== 3) {
	process.stderr.write(`Usage: anio_core_libgen <dir>\n`)
	process.exit(2)
}

main(process.argv[2])
