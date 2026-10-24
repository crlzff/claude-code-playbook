// Run: node --test plugins/playbook/autopilot/src/ (Node 22.18+ strips types).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assessEvents,
  branchName,
  candidates,
  configFrom,
  DEFAULT_CONFIG,
  parsePlan,
  parseRoadmap,
  pickNext,
  scanDiff,
  startFor,
  taskKind,
  unknownDeps,
  type Caps,
  type Config,
  type Outcome,
  type Plan,
  type State,
} from './autopilot.ts'

/** Every key of `want` matches `got`: RegExp tests strings, the rest compares deeply. */
function like(got: unknown, want: Record<string, unknown>): void {
  const g = got as Record<string, unknown>
  for (const [k, v] of Object.entries(want)) {
    if (v instanceof RegExp) assert.match(String(g[k]), v, `${k}`)
    else assert.deepEqual(g[k], v, `${k}`)
  }
}

const contains = (got: string[], want: string[]) => {
  for (const w of want) assert.ok(got.includes(w), `missing ${w} in ${JSON.stringify(got)}`)
}

const ROADMAP = `# Roadmap

## M0 Foundation — done

- [x] **T0.5** Database layer with in-memory tests (#7). D-4 local env file.
- [x] ~~T0.6 Container build check~~ *(cancelled, D-9)*

## M2 Sync

- [x] **T2.3 Sync endpoint (server side)** \`[M]\`
  - Env: **Local** (security-sensitive: request validation boundary)
  - Depends on: T0.5
- [ ] **T2.7 Shared list content in the API** \`[M]\`
  - Env: **Local** (list content reaches other people)
  - Depends on: T2.3

## M3 Reminders

- [ ] **T3.3 Reminders schema** \`[S]\`
  - Env: **Cloud** (schema with constraint test; run alone)
  - Depends on: T0.5
- [ ] **T3.4 Reminder scheduling job** \`[M]\`
  - Env: **Cloud** (idempotency is test-defined)
  - Depends on: T3.3,
    T0.5
- [ ] **T3.5 Today's reminders by user timezone** \`[S]\`
  - Env: **Local** (security-sensitive: no other user's reminders)
  - Depends on: T3.3

## M4 Lists

- [ ] **T4.2 Lists and items schema** \`[S]\`
  - Env: **Cloud** (schema with constraint tests; run alone)
  - Depends on: T0.5
- [ ] **T4.3 Activity recorder** \`[S]\`
  - Env: **Cloud** (small, test-defined)
  - Depends on: T4.2, T3.4

- [ ] **T4.7 List page: edit, reorder, share** \`[M]\`
  - Env: **Local** (visual and end-to-end check)
  - Depends on: T0.5
- [ ] **T4.8 Nightly cleanup job** \`[M]\`
  - Env: **Local** (deletes data)
  - Depends on: T0.5
- [ ] **T9.<f>.a Importer for one file format** \`[L]\` *(parallel-safe)*
  - Env: **Cloud** (ideal: pure logic with property tests)
  - Depends on: T0.5

- [ ] **T7.5 Help pages** \`[S]\`
  - Env: **Cloud** (rendering from markdown; you review the copy separately)
  - Design: help page layout from T8.6.
  - Depends on: T0.5

## M8 Design

- [ ] **T8.6 Help page layout** \`[M]\`
  - Env: **Design**
  - Depends on: T8.2

- [ ] **T8.2 App name and icon** \`[M]\` *(decision, then design)*
  - Env: **Design**
  - Depends on: nothing (any time)
- [ ] **T9.<f>.p Trial week with testers** \`[S]\` *(you)*
  - Env: **Local**
  - Depends on: T9.<f>.b
- [ ] **T10.0 Hosting setup** \`[M]\` *(scaffold)*
  - Env: **Local** (hosting accounts and secrets)
  - Depends on: nothing
- [ ] **T10.1 E2E suite for the success criteria** \`[M]\`
  - Env: **Cloud** (test writing against listed criteria)
  - Depends on: M2–M3
- [ ] **T10.2 Contributor guide** \`[S]\` *(docs)*
  - Env: **Cloud** (writing)
  - Depends on: nothing
`

/** A project's own tripwires and the node-pnpm pack's, as a profile would add them (invented example). */
const projectConfig: Config = configFrom({
  autopilot: {
    tripwires: [
      { rule: 'sandbox', line: String.raw`\bsandbox\b|allow-same-origin` },
      { rule: 'scope', line: String.raw`scopedQuery\(|\.rawQuery\(` },
      { rule: 'secret', added: String.raw`\bapiSecret\b`, file: '^src/client/' },
      { rule: 'middleware', file: String.raw`^src/middleware\.ts$` },
      { rule: 'guard', file: '^config/lint/' },
      {
        rule: 'dependency',
        file: String.raw`(^|/)package\.json$`,
        added: String.raw`^\s*"(?!version")[@\w./-]+":\s*"(catalog:|workspace:|npm:|[\^~]?\d)`,
      },
    ],
  },
})

const roadmap = parseRoadmap(ROADMAP)
const task = (id: string) => {
  const t = roadmap.get(id)
  if (!t) throw new Error(`no ${id} in the fixture`)
  return t
}

function plan(id: string, extra: Partial<Plan> = {}): Plan {
  return { id, security: false, migration: false, files: [], body: '', ...extra }
}

function outcome(id: string, extra: Partial<Outcome> = {}): Outcome {
  return {
    id,
    branch: `feat/${id.toLowerCase().replace(/\./g, '-')}`,
    base: 'main',
    status: 'ok',
    security: false,
    migration: false,
    startedAt: '2030-01-14T22:00:00Z',
    ...extra,
  }
}

const caps: Caps = { unmerged: 4, security: 2, perDay: 6 }
const today = '2030-01-15'

function state(extra: Partial<State> = {}): State {
  return { queue: [], claims: [], outcomes: [], starts: [], stop: false, ...extra }
}

const queue = (...plans: Plan[]) => plans.map((p, i) => ({ order: i + 1, plan: p }))

describe('configFrom', () => {
  it('keeps the defaults and adds the project rules after them', () => {
    const c = configFrom({})
    assert.deepEqual(c, { ...DEFAULT_CONFIG })
    assert.equal(projectConfig.rules.length, DEFAULT_CONFIG.rules.length + 6)
  })

  it('takes the main branch, the doc paths and pattern overrides from the profile', () => {
    const c = configFrom({
      git: { main: 'trunk' },
      docs: { roadmap: 'plan/ROADMAP.md', log: 'plan/log.md' },
      autopilot: { patterns: { security: 'risky' } },
    })
    assert.equal(c.main, 'trunk')
    assert.deepEqual(c.alwaysInPlan, ['plan/ROADMAP.md', 'plan/log.md'])
    assert.equal(c.patterns.security, 'risky')
    assert.equal(c.patterns.taskId, DEFAULT_CONFIG.patterns.taskId)
  })
})

describe('parseRoadmap', () => {
  it('reads id, title, done, env and dependencies', () => {
    like(task('T3.3'), {
      title: 'Reminders schema',
      done: false,
      env: '**Cloud** (schema with constraint test; run alone)',
      deps: ['T0.5'],
      milestone: 'M3',
    })
    assert.equal(task('T2.3').done, true)
  })

  it('reads a task whose title sits outside the bold id, and cancelled ones', () => {
    like(task('T0.5'), { done: true, milestone: 'M0' })
    assert.equal(task('T0.6').done, true)
  })

  it('follows a Depends line onto its continuation', () => {
    assert.deepEqual(task('T3.4').deps, ['T3.3', 'T0.5'])
  })

  it('counts the design a task builds from as a dependency', () => {
    assert.deepEqual(task('T7.5').deps, ['T0.5', 'T8.6'])
  })

  it('reads "nothing" as no dependency, and expands milestone ranges', () => {
    assert.deepEqual(task('T8.2').deps, [])
    assert.deepEqual(task('T10.1').deps, ['M2', 'M3'])
  })
})

describe('taskKind', () => {
  it('keeps design, decision and (you) tasks for you', () => {
    assert.equal(taskKind(task('T8.2')), 'yours')
    assert.equal(taskKind(task('T9.<f>.p')), 'yours')
  })

  it('keeps tasks settled by eye or by hand, and template tasks, for you', () => {
    assert.equal(taskKind(task('T4.7')), 'yours') // visual
    assert.equal(taskKind(task('T10.0')), 'yours') // hosting accounts and secrets
    assert.equal(taskKind(task('T9.<f>.a')), 'yours') // a template id
  })

  it('keeps spikes for you, whatever their Env line says', () => {
    const spike = parseRoadmap('## MS Spikes\n\n- [ ] **SP.1 Spike: sync library** `[M]` *(spike)*\n  - Env: **Local** (spike: you decide the approach)\n').get('SP.1')
    assert.ok(spike)
    assert.equal(taskKind(spike), 'yours')
  })

  it('marks security-sensitive tasks, deletion included, from their Env line', () => {
    assert.equal(taskKind(task('T3.5')), 'security')
    assert.equal(taskKind(task('T4.8')), 'security')
    assert.equal(taskKind(task('T3.3')), 'agent')
  })

  it('follows a profile override of the security phrases', () => {
    const c = configFrom({ autopilot: { patterns: { security: 'idempotency' } } })
    assert.equal(taskKind(task('T3.4'), c), 'security')
    assert.equal(taskKind(task('T3.5'), c), 'agent')
  })
})

describe('parsePlan', () => {
  it('reads the front matter and keeps the body', () => {
    const p = parsePlan(`---
id: T3.3
security: false
migration: true
files:
  - src/db/schema/reminders.ts
  - migrations/
---
# Plan

Write the schema.
`)
    assert.deepEqual(p, {
      id: 'T3.3',
      security: false,
      migration: true,
      files: ['src/db/schema/reminders.ts', 'migrations/'],
      body: '# Plan\n\nWrite the schema.\n',
    })
  })

  it('refuses a plan without an id', () => {
    assert.throws(() => parsePlan('---\nsecurity: true\n---\nbody\n'), /id/)
  })
})

describe('unknownDeps', () => {
  it('names dependencies on tasks or milestones the ROADMAP lacks', () => {
    const r = parseRoadmap('## M2 Lists\n\n- [ ] **T2.4 Guide** `[S]`\n  - Env: **Cloud** (writing)\n  - Depends on: M1, T2.9, M2\n')
    assert.deepEqual(unknownDeps(r).sort(), ['T2.4: depends on unknown M1', 'T2.4: depends on unknown T2.9'])
  })
})

describe('candidates', () => {
  it('offers open agent and security tasks whose dependencies are done or queued', () => {
    const ids = candidates(roadmap, new Set(['T3.3'])).map(t => t.id)
    contains(ids, ['T2.7', 'T3.4', 'T3.5', 'T4.2'])
    assert.ok(!ids.includes('T3.3')) // already queued
    assert.ok(!ids.includes('T4.3')) // T4.2 neither done nor queued
    assert.ok(!ids.includes('T8.2')) // yours
    assert.ok(!ids.includes('T10.1')) // M2 and M3 not done
    assert.ok(!ids.includes('T7.5')) // its design, T8.6, isn't done
  })
})

describe('pickNext', () => {
  it('takes the first queued task whose dependencies are on main', () => {
    const pick = pickNext(state({ queue: queue(plan('T3.3'), plan('T4.2')) }), roadmap, caps, today)
    assert.deepEqual(pick, { kind: 'task', plan: plan('T3.3'), base: 'main' })
  })

  it('starts from the profile\'s main branch', () => {
    const c = configFrom({ git: { main: 'trunk' } })
    const pick = pickNext(state({ queue: queue(plan('T3.3')) }), roadmap, caps, today, c)
    assert.deepEqual(pick, { kind: 'task', plan: plan('T3.3'), base: 'trunk' })
  })

  it('stops on STOP and on the daily cap', () => {
    like(pickNext(state({ stop: true, queue: queue(plan('T3.3')) }), roadmap, caps, today), { kind: 'stop' })
    // Counted from starts, not outcomes: dequeuing a task can't reset the cap.
    const starts = [`${today}T01:00:00Z`, `${today}T02:00:00Z`, '2030-01-14T23:00:00Z']
    like(pickNext(state({ starts, queue: queue(plan('T3.3')) }), roadmap, { ...caps, perDay: 2 }, today), {
      kind: 'stop',
      reason: /daily/,
    })
    like(pickNext(state({ starts, queue: queue(plan('T3.3')) }), roadmap, { ...caps, perDay: 3 }, today), {
      kind: 'task',
    })
  })

  it('waits while a task is claimed: one autopilot at a time', () => {
    const claims = [
      { id: 'T4.2', branch: 'feat/t4-2-x', base: 'main', at: `${today}T01:00:00Z`, security: false, migration: true },
    ]
    like(pickNext(state({ claims, queue: queue(plan('T3.3')) }), roadmap, caps, today), {
      kind: 'wait',
      reason: /T4\.2/,
    })
  })

  it('waits when too many PRs are unmerged', () => {
    const outcomes = [outcome('T3.3'), outcome('T4.2')]
    like(pickNext(state({ outcomes, queue: queue(plan('T3.4')) }), roadmap, { ...caps, unmerged: 2 }, today), {
      kind: 'wait',
      reason: /unmerged/,
    })
  })

  it("stacks a task on its dependency's open PR", () => {
    const outcomes = [outcome('T3.3', { branch: 'feat/t3-3-reminders-schema' })]
    assert.deepEqual(pickNext(state({ outcomes, queue: queue(plan('T3.4')) }), roadmap, caps, today), {
      kind: 'task',
      plan: plan('T3.4'),
      base: 'feat/t3-3-reminders-schema',
    })
  })

  it('never stacks on a critical or security-sensitive PR, and skips ahead', () => {
    const critical = [outcome('T3.3', { status: 'critical' })]
    assert.deepEqual(
      pickNext(state({ outcomes: critical, queue: queue(plan('T3.4'), plan('T4.2')) }), roadmap, caps, today),
      { kind: 'task', plan: plan('T4.2'), base: 'main' },
    )
    const security = [outcome('T3.3', { security: true })]
    like(pickNext(state({ outcomes: security, queue: queue(plan('T3.4')) }), roadmap, caps, today), { kind: 'wait' })
  })

  it('stacks one level deep only: never on a PR that is itself stacked', () => {
    const outcomes = [
      outcome('T3.3', { branch: 'feat/t3-3-reminders-schema', base: 'feat/t2-7-shared-list-content', migration: true }),
    ]
    like(pickNext(state({ outcomes, queue: queue(plan('T3.4')) }), roadmap, caps, today), {
      kind: 'wait',
      reason: /T3\.3.*stacked/,
    })
    like(pickNext(state({ outcomes, queue: queue(plan('T4.2', { migration: true })) }), roadmap, caps, today), {
      kind: 'wait',
      reason: /T3\.3.*stacked/,
    })
  })

  it('waits on a dependency that is neither merged nor an open PR', () => {
    like(pickNext(state({ queue: queue(plan('T3.4')) }), roadmap, caps, today), { kind: 'wait', reason: /T3\.3/ })
  })

  it('stacks a migration on the newest open migration, even without a dependency', () => {
    const outcomes = [outcome('T3.3', { migration: true, branch: 'feat/t3-3-reminders-schema' })]
    assert.deepEqual(
      pickNext(state({ outcomes, queue: queue(plan('T4.2', { migration: true })) }), roadmap, caps, today),
      { kind: 'task', plan: plan('T4.2', { migration: true }), base: 'feat/t3-3-reminders-schema' },
    )
  })

  it('holds a security task once two security PRs are unmerged', () => {
    const outcomes = [outcome('T9.1', { security: true }), outcome('T9.2', { security: true })]
    assert.deepEqual(
      pickNext(state({ outcomes, queue: queue(plan('T3.5', { security: true }), plan('T4.2')) }), roadmap, caps, today),
      { kind: 'task', plan: plan('T4.2'), base: 'main' },
    )
  })

  it('skips tasks already done, already tried, or yours', () => {
    const outcomes = [outcome('T4.2', { status: 'blocked' })]
    like(
      pickNext(state({ outcomes, queue: queue(plan('T2.3'), plan('T4.2'), plan('T8.2')) }), roadmap, caps, today),
      { kind: 'wait' },
    )
  })

  it('stops when the queue is empty', () => {
    like(pickNext(state(), roadmap, caps, today), { kind: 'stop', reason: /queue/ })
  })
})

describe('branchName', () => {
  it('follows /task: type, lowercased id with dashes, short slug', () => {
    assert.equal(branchName(task('T3.3')), 'feat/t3-3-reminders-schema')
    assert.equal(branchName(task('T3.5')), 'feat/t3-5-todays-reminders-user')
    assert.equal(branchName(task('T10.0')), 'chore/t10-0-hosting-setup')
    assert.equal(branchName(task('T10.2')), 'docs/t10-2-contributor-guide')
  })
})

describe('scanDiff', () => {
  const diff = `diff --git a/src/components/preview-frame.tsx b/src/components/preview-frame.tsx
--- a/src/components/preview-frame.tsx
+++ b/src/components/preview-frame.tsx
@@ -1,3 +1,3 @@
-      sandbox="allow-scripts"
+      sandbox="allow-scripts allow-same-origin"
diff --git a/src/lib/lists.test.ts b/src/lib/lists.test.ts
--- a/src/lib/lists.test.ts
+++ b/src/lib/lists.test.ts
@@ -1,6 +1,3 @@
-  it('rejects another user', async () => {
-    expect(1).toBe(1)
-  })
+  it.skip('rejects an empty title', async () => {})
diff --git a/src/db/lists.ts b/src/db/lists.ts
--- a/src/db/lists.ts
+++ b/src/db/lists.ts
@@ -1,2 +1,2 @@
-  return scopedQuery(db, userId).select().from(lists)
+  return db.select().from(lists) // eslint-disable-line
diff --git a/ROADMAP.md b/ROADMAP.md
--- a/ROADMAP.md
+++ b/ROADMAP.md
@@ -1 +1 @@
-- [ ] **T4.4 Item reorder API**
+- [x] **T4.4 Item reorder API**
`

  it('flags guard changes as critical, once per rule and file', () => {
    const hits = scanDiff(diff, [], projectConfig)
    const rules = hits.map(h => `${h.rule} ${h.file}`)
    contains(rules, [
      'sandbox src/components/preview-frame.tsx',
      'skipped-test src/lib/lists.test.ts',
      'removed-test src/lib/lists.test.ts',
      'scope src/db/lists.ts',
      'lint-disable src/db/lists.ts',
    ])
    assert.ok(hits.every(h => h.severity === 'critical'))
    assert.equal(new Set(rules).size, rules.length)
  })

  it('leaves project rules out until the profile adds them', () => {
    const rules = scanDiff(diff, []).map(h => h.rule)
    assert.ok(!rules.includes('scope'))
    assert.ok(!rules.includes('sandbox'))
    contains(rules, ['skipped-test', 'removed-test', 'lint-disable'])
  })

  it('flags files outside the plan as minor, but never the ROADMAP or the log', () => {
    const hits = scanDiff(diff, ['src/components/', 'src/lib/lists.test.ts'], projectConfig)
    const outside = hits.filter(h => h.rule === 'outside-plan').map(h => h.file)
    assert.deepEqual(outside, ['src/db/lists.ts'])
    assert.equal(hits.find(h => h.rule === 'outside-plan')?.severity, 'minor')
  })

  it('reads code, not prose: Markdown never trips a line rule', () => {
    const prose = `diff --git a/docs/log.md b/docs/log.md
--- a/docs/log.md
+++ b/docs/log.md
@@ -1 +1,2 @@
+Queries go through scopedQuery; the iframe keeps sandbox="allow-scripts".
`
    assert.deepEqual(scanDiff(prose, [], projectConfig), [])
  })

  it("flags the playbook's own guards and dependency changes as critical", () => {
    const guards = `diff --git a/.claude/profile.json b/.claude/profile.json
--- a/.claude/profile.json
+++ b/.claude/profile.json
@@ -1 +1 @@
-  "tdd": { "mode": "strict-stub" },
+  "tdd": { "mode": "off" },
diff --git a/config/lint/rules.mjs b/config/lint/rules.mjs
--- a/config/lint/rules.mjs
+++ b/config/lint/rules.mjs
@@ -1 +1 @@
-const zones = []
+const zones = [1]
diff --git a/packages/web/package.json b/packages/web/package.json
--- a/packages/web/package.json
+++ b/packages/web/package.json
@@ -1,2 +1,3 @@
+    "left-pad": "catalog:",
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -1 +1 @@
+  left-pad@1.3.0:
`
    const rules = scanDiff(guards, [], projectConfig).map(h => `${h.rule} ${h.file} ${h.severity}`)
    contains(rules, [
      'guard .claude/profile.json critical',
      'guard config/lint/rules.mjs critical',
      'dependency packages/web/package.json critical',
      'dependency pnpm-lock.yaml critical',
    ])
  })

  it('catches skips and removed tests in other languages with the default patterns', () => {
    const py = `diff --git a/tests/test_api.py b/tests/test_api.py
--- a/tests/test_api.py
+++ b/tests/test_api.py
@@ -1,4 +1,2 @@
-def test_rejects_future_dates():
-    assert False
+@pytest.mark.skip
diff --git a/uv.lock b/uv.lock
--- a/uv.lock
+++ b/uv.lock
@@ -1 +1 @@
+name = "left-pad"
`
    const rules = scanDiff(py, []).map(h => `${h.rule} ${h.file}`)
    contains(rules, ['skipped-test tests/test_api.py', 'removed-test tests/test_api.py', 'dependency uv.lock'])
  })

  it('leaves a package version bump alone', () => {
    const bump = `diff --git a/tools/cli/package.json b/tools/cli/package.json
--- a/tools/cli/package.json
+++ b/tools/cli/package.json
@@ -1 +1 @@
-  "version": "0.0.0",
+  "version": "0.0.1",
`
    assert.deepEqual(scanDiff(bump, ['tools/cli/'], projectConfig), [])
  })

  it('finds nothing in a quiet diff', () => {
    const quiet = `diff --git a/src/lib/ids.ts b/src/lib/ids.ts
--- a/src/lib/ids.ts
+++ b/src/lib/ids.ts
@@ -1 +1 @@
-export const PREFIX = 'a'
+export const PREFIX = 'b'
`
    assert.deepEqual(scanDiff(quiet, ['src/lib/ids.ts'], projectConfig), [])
  })
})

describe('guard files', () => {
  const guarded = configFrom({
    security: { sensitive: [{ area: 'auth', paths: ['src/auth/', 'src/middleware.ts'] }] },
  })
  const edit = (file: string, from: string, to: string) =>
    `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-${from}\n+${to}\n`

  it('trips on a value-only edit to any file under a sensitive path', () => {
    const hits = scanDiff(edit('src/auth/roles.ts', "export const ROLES = ['admin']", "export const ROLES = ['admin', 'guest']"), [], guarded)
    assert.deepEqual(hits.map(h => `${h.rule} ${h.severity}`), ['sensitive:auth critical'])
  })

  it('trips on a sensitive file named exactly, and not on its neighbours', () => {
    const rules = (file: string) => scanDiff(edit(file, 'const a = 1', 'const a = 2'), [], guarded).map(h => h.rule)
    assert.deepEqual(rules('src/middleware.ts'), ['sensitive:auth'])
    assert.deepEqual(rules('src/middleware.test-helpers.ts'), [])
    assert.deepEqual(rules('src/authors/list.ts'), [])
  })

  it('trips on any change to CLAUDE.md, prose or not', () => {
    const rules = scanDiff(edit('CLAUDE.md', '- Never merge red.', '- Merge when convenient.'), []).map(h => h.rule)
    assert.deepEqual(rules, ['guard'])
  })

  it('trips on raw HTML injection added anywhere', () => {
    const rules = scanDiff(edit('src/components/note.tsx', '<p>{text}</p>', '<p dangerouslySetInnerHTML={{ __html: text }} />'), []).map(h => h.rule)
    assert.deepEqual(rules, ['raw-html'])
  })

  it('stays quiet on an ordinary edit', () => {
    assert.deepEqual(scanDiff(edit('src/lib/format.ts', 'const sep = ","', 'const sep = ";"'), [], guarded), [])
  })
})

describe('assessEvents', () => {
  const ev = (at: string, level: string, text: string, id = 'T3.3') => ({ at, id, level, text })
  const first = '2030-01-15T01:00:00Z'
  const second = '2030-01-15T05:00:00Z'
  const log = [
    ev(first, 'info', 'started on feat/t3-3-reminders-schema from main'),
    ev('2030-01-15T02:00:00Z', 'critical', 'relaxed the uniqueness check'),
    ev('2030-01-15T03:00:00Z', 'pr', 'https://example.test/pull/1'),
    ev('2030-01-15T03:30:00Z', 'blocked', 'keychain locked'),
    ev('2030-01-15T04:00:00Z', 'info', 'requeued'),
    ev(second, 'info', 'started on feat/t3-3-reminders-schema from main'),
    ev('2030-01-15T06:00:00Z', 'critical', "another task's call", 'T4.2'),
  ]

  it('reads calls, BLOCKED and the PR of the attempt that started at `since`', () => {
    assert.deepEqual(assessEvents(log, 'T3.3', first), {
      critical: true,
      blocked: true,
      pr: 'https://example.test/pull/1',
    })
  })

  it('starts every attempt clean: a requeue starts fresh, with fresh commits', () => {
    assert.deepEqual(assessEvents(log, 'T3.3', second), { critical: false, blocked: false, pr: undefined })
  })
})

describe('startFor', () => {
  it('starts fresh when the branch was never pushed', () => {
    assert.deepEqual(startFor({ left: false }), { kind: 'fresh' })
  })

  it('refuses a pushed branch: finish it by hand, or delete it to start over', () => {
    like(startFor({ left: true }), { kind: 'refuse', reason: /\/ship[\s\S]*delete/ })
  })
})
