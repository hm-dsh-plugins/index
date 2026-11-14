#!/usr/bin/env node
/**
 * Point one `index.json` entry at a plugin's current release.
 *
 * The index is a single file the plugin market fetches, so publishing a version
 * means copying four facts into it by hand: the version, the commit, the
 * timestamp, and sometimes the description. Three of them live in the plugin's
 * own repository, which is where this script reads them from — a hand-typed
 * commit is the one thing no one can verify by looking at the diff.
 *
 * It never commits: the point of the printed summary is that a person reads it
 * before the index moves.
 *
 *   node scripts/publish.mjs dsh-sidebar-notes
 *   node scripts/publish.mjs dsh-sidebar-notes --dry
 *   node scripts/publish.mjs dsh-sidebar-notes --zh "新描述" --en "new text"
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

/** This repository's root: the directory holding `index.json`. */
const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** The one index this repository publishes. */
const INDEX = join(ROOT, 'index.json')

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dry: { type: 'boolean', short: 'n' },
    zh: { type: 'string' },
    en: { type: 'string' },
  },
})

/**
 * Stop with one line of explanation.
 * @param {string} message - what is wrong.
 * @returns {never} never returns.
 */
function fail(message) {
  console.error(`publish: ${message}`)
  process.exit(1)
}

const [name, ...rest] = positionals
if (name === undefined || rest.length > 0) {
  fail('usage: node scripts/publish.mjs <plugin-name> [--dry] [--zh <text>] [--en <text>]')
}

const directory = join(ROOT, name)
if (!existsSync(join(directory, 'package.json'))) {
  fail(`no ${name}/package.json — the plugin directory sits beside this index.`)
}

const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
  fail(`${name}/package.json has no version.`)
}

const git = (...args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim()

const commit = git('rev-parse', 'HEAD')
// The index is read from another machine, so a commit no remote has is not a
// release: it would install nothing.
if (git('branch', '-r', '--contains', commit) === '') {
  fail(`${name}: ${commit.slice(0, 7)} is not on any remote branch yet — push the plugin first.`)
}

const index = JSON.parse(readFileSync(INDEX, 'utf8'))
const entry = index.plugins?.find((plugin) => plugin.name === name)
if (entry === undefined) fail(`index.json has no entry named ${name}.`)

const current = entry.versions?.[0]
if (current === undefined) fail(`index.json's ${name} entry lists no versions.`)

const versionChanged = manifest.version !== current.version
const commitChanged = current.source?.commit !== commit
const descriptionChanged = (values.zh !== undefined && entry.description?.zh !== values.zh)
  || (values.en !== undefined && entry.description?.en !== values.en)

// A timestamp alone is not a release: re-running the script with nothing else
// new must leave the index exactly as it is.
if (!versionChanged && !commitChanged && !descriptionChanged) {
  console.log(`${name} already points at ${manifest.version} (${commit.slice(0, 7)}); nothing to update.`)
  process.exit(0)
}
if (!versionChanged) {
  console.warn(`publish: ${name} is still ${manifest.version} — did you forget to bump package.json?`)
}

const timestamp = Math.floor(Date.now() / 1000)
const changes = []
const note = (what, before, after) => {
  if (before !== after) changes.push([what, before, after])
}

note('version', current.version, manifest.version)
note('commit', current.source?.commit?.slice(0, 7), commit.slice(0, 7))
note('published', current.publishTimestamp, timestamp)
if (values.zh !== undefined) note('description.zh', entry.description?.zh, values.zh)
if (values.en !== undefined) note('description.en', entry.description?.en, values.en)

for (const [what, before, after] of changes) {
  console.log(`  ${what.padEnd(14)} ${String(before ?? '—')} → ${after}`)
}

if (values.dry) {
  console.log(`(${name}: dry run, index.json untouched)`)
  process.exit(0)
}

entry.versions[0] = {
  ...current,
  version: manifest.version,
  publishTimestamp: timestamp,
  source: { ...current.source, commit },
}
if (values.zh !== undefined) entry.description = { ...entry.description, zh: values.zh }
if (values.en !== undefined) entry.description = { ...entry.description, en: values.en }

writeFileSync(INDEX, `${JSON.stringify(index, null, 2)}\n`)
console.log(`wrote index.json — ${name} ${manifest.version} at ${commit.slice(0, 7)}`)
