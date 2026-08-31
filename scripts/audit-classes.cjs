/**
 * Audits UnoCSS utility usage in src/.
 *
 * Catches two failure modes that are silent at build time:
 *  1. tokens UnoCSS cannot generate at all (dead classes)
 *  2. tokens where a normally-unitless property got a length, e.g.
 *     `leading-1.85` -> `line-height: 14.8rpx` instead of `line-height: 1.85`
 *     (the fix is to bracket the value: `leading-[1.85]`)
 */
const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')

// `leading-1.85` reads like a ratio but UnoCSS resolves the bare decimal against the
// spacing scale, yielding `line-height: 14.8rpx`. Only `leading-[1.85]` gives a ratio.
const BARE_DECIMAL_LEADING = /^-?leading-\d+\.\d+$/

// UnoCSS emits no rule for these on their own; they only mark an element as the
// target of a `group-*` / `peer-*` variant elsewhere.
const VARIANT_MARKERS = new Set(['group', 'peer'])

// Class selectors the project defines by hand, so they are not "dead" just because
// UnoCSS does not generate them.
function collectDefinedClasses(source) {
  const found = new Set()
  for (const m of source.matchAll(/\.(-?[A-Z_][\w-]*)/gi)) found.add(m[1])
  return found
}

// A dynamic `:class` is a JS expression, so most string literals in it are not class
// lists: `status === 'streaming'`, `key as 'a' | 'b'`, `t('foo.bar')`. Only a ternary
// branch (`? 'x' : 'y'`) or an object key (`{ 'x': cond }`) yields classes.
function classListLiterals(expr) {
  const out = []
  for (const m of expr.matchAll(/'([^']*)'/g)) {
    const before = expr.slice(0, m.index).replace(/\s+$/, '').at(-1)
    const after = expr.slice(m.index + m[0].length).replace(/^\s+/, '').at(0)
    if (before === '?' || before === ':' || after === ':')
      out.push(m[1])
  }
  return out
}

async function main() {
  const { loadConfig } = await import('@unocss/config')
  const { createGenerator } = await import('unocss')

  const root = path.resolve(__dirname, '..')
  const { config } = await loadConfig(root)
  // The icon safelist is emitted on every generate() call, which would make
  // `matched` non-empty for every token and hide all dead classes.
  const uno = await createGenerator({ ...config, safelist: [] })

  const files = []
  const stylesheets = []
  ;(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'uni_modules' || e.name === 'node_modules')
          continue
        walk(p)
      }
      else if (/\.(?:vue|ts|tsx|js)$/.test(e.name)) {
        files.push(p)
      }
      else if (/\.(?:scss|css)$/.test(e.name)) {
        stylesheets.push(p)
      }
    }
  })(path.join(root, 'src'))

  const defined = new Set()
  for (const p of stylesheets) {
    for (const c of collectDefinedClasses(fs.readFileSync(p, 'utf8'))) defined.add(c)
  }
  for (const p of files.filter(f => f.endsWith('.vue'))) {
    const src = fs.readFileSync(p, 'utf8')
    for (const block of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      for (const c of collectDefinedClasses(block[1])) defined.add(c)
    }
  }

  const dead = []
  const suspicious = []

  for (const file of files) {
    const rel = path.relative(root, file)
    const tokens = new Map()

    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/(:|v-bind:)?class\s*=\s*("([^"]*)"|'([^']*)')/g)) {
        const dynamic = Boolean(m[1])
        const raw = m[3] ?? m[4] ?? ''
        // A static class attribute is a literal class list; a dynamic one needs the
        // class-bearing literals picked out of the surrounding expression.
        const chunks = dynamic ? classListLiterals(raw) : [raw]
        for (const chunk of chunks) {
          for (const tok of chunk.split(/\s+/)) {
            const t = tok.trim()
            if (!t || !/^[\w:./%[\]#(),!<>+~*'-]+$/.test(t))
              continue
            if (/[${}?]/.test(t))
              continue
            if (!tokens.has(t))
              tokens.set(t, new Set())
            tokens.get(t).add(i + 1)
          }
        }
      }
    })

    for (const [tok, lns] of tokens) {
      const res = await uno.generate(tok, { preflights: false, minify: true })
      const where = `${rel}:${[...lns].join(',')}`
      if (res.matched.size === 0) {
        if (!defined.has(tok) && !VARIANT_MARKERS.has(tok))
          dead.push([tok, where])
        continue
      }
      if (BARE_DECIMAL_LEADING.test(tok)) {
        const lh = res.css.match(/[;{]line-height:([^;}]+)/)
        suspicious.push([tok, lh ? lh[1].trim() : '?', where])
      }
    }
  }

  console.log(`=== dead classes (UnoCSS generates nothing): ${dead.length} ===`)
  for (const [tok, where] of dead) console.log(`  ${tok}  <- ${where}`)

  console.log(`\n=== bare-decimal leading (resolves to a length, not a ratio): ${suspicious.length} ===`)
  for (const [tok, lh, where] of suspicious)
    console.log(`  ${tok} => line-height: ${lh}   use leading-[${tok.replace(/^-?leading-/, '')}]   <- ${where}`)

  if (dead.length || suspicious.length)
    process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
