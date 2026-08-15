#!/usr/bin/env node
// Extracts one version's section body from CHANGELOG.md -- everything
// between its "## [X.Y.Z]" heading and the next "## [" heading -- for use
// as GitHub Release notes. Usage: node scripts/changelog-section.mjs 2.0.0-alpha
//
// Ported unchanged from alxndr/sparse-boolean-codec.

import {readFileSync} from 'node:fs'

const version = process.argv[2]
if (!version) {
  console.error('usage: node scripts/changelog-section.mjs <version>')
  process.exit(1)
}

const changelogPath = new URL('../CHANGELOG.md', import.meta.url)
const changelogLines = readFileSync(changelogPath, 'utf8').split('\n')

const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const headingPattern = new RegExp(`^## \\[${escapedVersion}\\]`)

const headingIndex = changelogLines.findIndex((line) => headingPattern.test(line))
if (headingIndex === -1) {
  console.error(`no CHANGELOG.md section found for version ${version}`)
  process.exit(1)
}

const linesAfterHeading = changelogLines.slice(headingIndex + 1)
const nextHeadingOffset = linesAfterHeading.findIndex((line) => /^## \[/.test(line))
const sectionLines = nextHeadingOffset === -1
  ? linesAfterHeading
  : linesAfterHeading.slice(0, nextHeadingOffset)

// the oldest entry has no next "## [" heading to stop at, so it runs to the
// end of the file and picks up the trailing reference-style link
// definitions (`[x.y.z]: https://...`) -- strip those too, not just blanks.
const isBlankOrLinkReference = (line) => line.trim() === '' || /^\[[^\]]+\]:\s*\S/.test(line)

while (sectionLines.length && isBlankOrLinkReference(sectionLines[0]))
  sectionLines.shift()
while (sectionLines.length && isBlankOrLinkReference(sectionLines[sectionLines.length - 1]))
  sectionLines.pop()

console.log(sectionLines.join('\n'))
