/** Single-repository pipeline. No sampling, Docker policy, or dataset-wide state. */
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'

const scripts = path.dirname(fileURLToPath(import.meta.url))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'))
const write = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 2) + '\n')
const [repoArg, librariesFile, readmeFile, outputArg] = process.argv.slice(2)
if (!outputArg || process.argv.length !== 6) throw Error('Usage: node collect.mjs REPO LIBRARIES.json HOST-README.md OUTPUT')
const repo = path.resolve(repoArg), output = path.resolve(outputArg)
const readme = await fs.readFile(readmeFile, 'utf8')
// A fenced JSON block avoids guessing URLs/commands from prose. Paths use the README directory.
const blocks = [...readme.matchAll(/```recall-capture\s*\n([\s\S]*?)\n```/g)]
if (blocks.length !== 1) throw Error('Hosting README must contain exactly one recall-capture JSON block')
const config = JSON.parse(blocks[0][1])
const base = path.dirname(path.resolve(readmeFile))
const manifestPath = path.resolve(base, config.manifest || 'package.json')
const manifest = await json(manifestPath)
const selected = await json(librariesFile)
if (!Array.isArray(selected) || !selected.length || selected.some(n => typeof n !== 'string') || new Set(selected).size !== selected.length) throw Error('Libraries must be a nonempty JSON array of unique package names')
for (const name of selected) {
  if (!Object.hasOwn(manifest.dependencies || {}, name)) throw Error(`${name} is not a production dependency in ${manifestPath}`)
}
if (!['http:', 'https:'].includes(new URL(config.url).protocol)) throw Error('Capture URL must use HTTP(S)')
// Refuse to replace existing data, including a failed previous run.
try { await fs.access(output); throw Error('Output already exists; choose a fresh directory') }
catch (error) { if (error.code !== 'ENOENT') throw error }
const commit = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim()
const dirty = Boolean(execFileSync('git', ['-C', repo, 'status', '--porcelain'], {encoding:'utf8'}).trim())
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'recall-collect-'))
const run = (file, args, env = {}) => execFileSync(process.execPath, ['--max-old-space-size=6144', path.join(scripts, file), ...args], {stdio:'inherit', env:{...process.env, ...env}})
try {
  const raw = path.join(scratch, 'raw')
  await write(path.join(scratch, 'selection.json'), {repo:manifest.name || repo, commit, selected})
  run('capture.mjs', [config.url, raw, path.join(scratch, 'capture.json')], {
    ...(config.browserExecutable ? {CHROME_BIN:config.browserExecutable} : {}),
    ...(config.preparePage ? {RECALL_PREPARE_PAGE:path.resolve(base, config.preparePage)} : {}),
  })
  const capture = await json(path.join(scratch, 'capture.json'))
  if (!capture.pageStatus || capture.pageStatus >= 400 || capture.failures.some(f => f.where === 'navigation')) throw Error('Page navigation failed; inspect the hosting instructions and browser hook')
  run('relations.mjs', [scratch, raw])
  run('verify_pairs.mjs', [scratch, raw])
  const relations = await json(path.join(scratch, 'relations.json'))
  // Preserve capture diagnostics inside the one output record, not separate metadata files.
  const result = {
    pairDefinition:relations.pairDefinition, scopePolicy:relations.scopePolicy, libraryReports:relations.libraryReports,
    provenance:{commit, dirtyCheckout:dirty, manifestSHA256:sha(await fs.readFile(manifestPath)), hostingReadmeSHA256:sha(readme)},
    selectedLibraries:selected, capture, coverage:relations.coverage,
    evidence:relations.evidence, sourceFunctionAccounting:relations.sourceFunctionAccounting, relationshipCaution:relations.relationshipCaution,
    missingSourceContents:relations.missingSourceContents, failures:relations.failures,
    pairs:relations.pairs.map(({syntaxIdentical, ...pair}) => pair),
  }
  // Publish only after independent hash/span verification. Stage beside the destination.
  await fs.mkdir(path.dirname(output), {recursive:true})
  const stage = await fs.mkdtemp(path.join(path.dirname(output), '.recall-output-'))
  try {
    for (const name of ['runtime-js','source-maps']) await fs.mkdir(path.join(stage,name))
    for (const asset of capture.assets) {
      for (const [hash, ext, dir] of [[asset.sha256,'js','runtime-js'],[asset.map?.sha256,'map','source-maps']]) {
        if (!hash) continue
        const bytes = await fs.readFile(path.join(raw, hash+'.'+ext))
        if (sha(bytes) !== hash) throw Error('Artifact hash mismatch')
        await fs.writeFile(path.join(stage,dir,hash+'.'+ext), bytes)
      }
    }
    await write(path.join(stage,'func-mapping.json'), result)
    await fs.rename(stage, output)
  } catch (error) { await fs.rm(stage,{recursive:true,force:true}); throw error }
  console.log(`${relations.pairs.length} verified pairs saved to ${output}`)
  if (!relations.pairs.length) console.warn('No qualifying pairs: inspect coverage, missingSourceContents, capture, and failures in func-mapping.json.')
} finally { await fs.rm(scratch, {recursive:true,force:true}) }
