/**
 * The autopilot's deterministic half: reading the ROADMAP, choosing the next
 * approved task, checking a finished branch's diff. Pure functions only;
 * `cli.ts` does the git, the processes and the files. Everything a project
 * may tune arrives as a `Config` built from `.claude/profile.json`.
 */

export interface RoadmapTask {
  id: string
  title: string
  done: boolean
  /** The Env line after `Env:`, e.g. `**Cloud** (pure logic)`. */
  env: string
  /**
   * Task ids and milestones (`M3`); a range `M1–M9` is expanded. The ids on
   * its `Design:` line (`from T8.6`) count too.
   */
  deps: string[]
  /** Everything after the id on the task line: size, *(you)*, *(scaffold)*… */
  marks: string
  /** The `## M<n>` section the task sits in. */
  milestone: string
}

export type TaskKind = 'yours' | 'security' | 'agent'

/** An approved plan, as `/autopilot-plan` writes it to the queue. */
export interface Plan {
  id: string
  security: boolean
  /** The task adds a migration: it stacks on any open one. */
  migration: boolean
  /** Files or folders (trailing `/`) the plan says it touches. */
  files: string[]
  body: string
}

export interface QueueItem {
  order: number
  plan: Plan
}

/** A task a worker is on now. */
export interface Claim {
  id: string
  branch: string
  base: string
  at: string
  security: boolean
  migration: boolean
  /** The run holding it (`runnerOf`); absent on claims older than the field. */
  where?: string
}

export type Status = 'ok' | 'critical' | 'blocked' | 'failed'

/** A task the autopilot has finished with, merged or not. */
export interface Outcome {
  id: string
  branch: string
  base: string
  status: Status
  security: boolean
  migration: boolean
  startedAt: string
  pr?: string
}

export interface State {
  queue: QueueItem[]
  claims: Claim[]
  outcomes: Outcome[]
  /** When each task was started, from the event log. */
  starts: string[]
  stop: boolean
}

export interface Caps {
  /** Autopilot PRs waiting for `/merge-stack`. */
  unmerged: number
  /** Of those, security-sensitive ones. */
  security: number
  /** Tasks started per calendar day (UTC). */
  perDay: number
}

export type Pick =
  | { kind: 'task'; plan: Plan; base: string }
  | { kind: 'stop' | 'wait'; reason: string }

export type Severity = 'critical' | 'minor'

export interface Tripwire {
  rule: string
  severity: Severity
  file: string
  line: string
}

/** A diff rule as the profile writes it: regex sources. */
export interface RuleSpec {
  rule: string
  /** Matched against added and removed lines of code (never Markdown). */
  line?: string
  /** Matched against added lines only. */
  added?: string
  /** Only files matching this; with no line rule, any change to them. */
  file?: string
}

export interface Patterns {
  taskId: string
  yours: string
  yoursMarks: string
  security: string
  choreMarks: string
  docsMarks: string
}

export interface Config {
  main: string
  patterns: Patterns
  rules: RuleSpec[]
  alwaysInPlan: string[]
  testFile: string
  testCall: string
}

/** Defaults: the ROADMAP format contract (reference/roadmap-format.md). */
export const DEFAULT_PATTERNS: Patterns = {
  taskId: String.raw`(?:T|SP)[0-9]*\.[0-9A-Za-z<>]+(?:\.[0-9A-Za-z<>]+)?`,
  yours: String.raw`\*\*Design\*\*|\(you\b|\byour (decision|judgement)\b|visual|real device|hands-on|secrets|go-live`,
  yoursMarks: String.raw`\*\((you|decision|spike)\b`,
  security: String.raw`security-sensitive|deletes data|touches (deletion|identity)`,
  choreMarks: String.raw`\*\((scaffold|spike)\b`,
  docsMarks: String.raw`\*\(docs\b`,
}

/**
 * Stack-neutral guards. Keyword rules miss value-only edits (a source added
 * to a policy, a check dropped from a guard file), so every file that *is* a
 * guard needs a file rule: each `security.sensitive` path gets one
 * automatically (`configFrom`), and a project adds the rest
 * (`autopilot.tripwires`): its headers config, its middleware, its lint
 * config.
 */
export const DEFAULT_RULES: RuleSpec[] = [
  {
    rule: 'headers',
    line: 'Content-Security-Policy|frame-ancestors|frame-src|script-src|Strict-Transport-Security|Permissions-Policy|Referrer-Policy|X-Content-Type-Options|X-Frame-Options',
  },
  { rule: 'cors', line: 'Access-Control-Allow-' },
  { rule: 'cookie', line: String.raw`httpOnly|sameSite|Set-Cookie|\bsecure\s*:|\bmaxAge\b|cookies\(\)\.(set|delete)` },
  {
    rule: 'lint-disable',
    added: String.raw`eslint-disable|@ts-ignore|@ts-expect-error|# noqa|# type: ignore|//\s*nolint|#\[allow\(|@SuppressWarnings`,
  },
  {
    rule: 'skipped-test',
    added: String.raw`\b(it|test|describe)\.(skip|only|todo)\b|\bx(it|describe)\(|pytest\.mark\.(skip|xfail)|\bt\.Skip\(|#\[ignore\]`,
  },
  { rule: 'raw-html', added: String.raw`dangerouslySetInnerHTML|\.innerHTML\s*=|v-html|\|\s*safe\b|mark_safe\(` },
  // What a worker must never change unreported: the rules it works under,
  // the hooks and CI that check it.
  { rule: 'guard', file: String.raw`^(\.claude/|\.githooks/|\.github/)|(^|/)CLAUDE\.md$` },
  {
    rule: 'dependency',
    file: String.raw`(^|/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|uv\.lock|poetry\.lock|Pipfile\.lock|Cargo\.lock|go\.sum|Gemfile\.lock|composer\.lock)$`,
  },
]

export const DEFAULT_CONFIG: Config = {
  main: 'main',
  patterns: DEFAULT_PATTERNS,
  rules: DEFAULT_RULES,
  alwaysInPlan: ['ROADMAP.md', 'docs/log.md'],
  testFile: String.raw`(\.(test|spec)\.[cm]?[jt]sx?$)|((^|/)test_[^/]+\.py$)|(_test\.(py|go)$)`,
  testCall: String.raw`\b(it|test)\(|^\s*(async\s+)?def\s+test_|^func\s+Test`,
}

/** Merge a profile's `autopilot` section over the defaults. */
/** A file rule for each sensitive path: `src/auth/` covers the folder, a file path that file. */
export function sensitiveRules(sensitive: { area?: string; paths?: string[] }[] = []): RuleSpec[] {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return sensitive.flatMap(s =>
    (s.paths ?? []).map(p => ({
      rule: `sensitive:${s.area ?? 'area'}`,
      file: p.endsWith('/') ? `^${escape(p)}` : `^${escape(p)}$`,
    })),
  )
}

export function configFrom(profile: {
  git?: { main?: string }
  docs?: { roadmap?: string; log?: string }
  security?: { sensitive?: { area?: string; paths?: string[] }[] }
  autopilot?: {
    patterns?: Partial<Patterns>
    tripwires?: RuleSpec[]
    alwaysInPlan?: string[]
    testFile?: string
    testCall?: string
  }
}): Config {
  const a = profile.autopilot ?? {}
  const always = a.alwaysInPlan?.length
    ? a.alwaysInPlan
    : [profile.docs?.roadmap ?? 'ROADMAP.md', profile.docs?.log ?? 'docs/log.md']
  return {
    main: profile.git?.main || DEFAULT_CONFIG.main,
    patterns: { ...DEFAULT_PATTERNS, ...(a.patterns ?? {}) },
    rules: [...DEFAULT_RULES, ...sensitiveRules(profile.security?.sensitive), ...(a.tripwires ?? [])],
    alwaysInPlan: always,
    testFile: a.testFile || DEFAULT_CONFIG.testFile,
    testCall: a.testCall || DEFAULT_CONFIG.testCall,
  }
}

const MILESTONE_DEP = /\bM(\d+)(?:\s*[–-]\s*M(\d+))?\b/g

export function parseRoadmap(md: string, config: Config = DEFAULT_CONFIG): Map<string, RoadmapTask> {
  const ID = config.patterns.taskId
  const TASK_LINE = new RegExp(String.raw`^- \[( |x)\] (?:\*\*|~~)?(${ID})(.*)$`)
  const tasks = new Map<string, RoadmapTask>()
  const designs = new Map<string, string[]>()
  let milestone = ''
  let current: RoadmapTask | undefined
  let field: 'deps' | undefined
  let depsText = ''

  const closeDeps = () => {
    if (current && field === 'deps') current.deps = parseDeps(depsText, ID)
    field = undefined
  }

  for (const line of md.split('\n')) {
    const heading = /^## (M\w*)\b/.exec(line)
    if (heading) {
      closeDeps()
      current = undefined
      milestone = heading[1] ?? ''
      continue
    }
    const taskLine = TASK_LINE.exec(line)
    if (taskLine) {
      closeDeps()
      const [, box, id = '', rest = ''] = taskLine
      const title = rest.replace(/^(\*\*|~~)\s*/, '').split(/\*\*|~~|`/)[0]?.trim() ?? ''
      current = { id, title, done: box === 'x', env: '', deps: [], marks: rest, milestone }
      tasks.set(id, current)
      continue
    }
    if (!current) continue
    const bullet = /^ {2}- (Env|Depends on|Design):\s*(.*)$/.exec(line)
    if (bullet) {
      closeDeps()
      if (bullet[1] === 'Design') {
        designs.set(current.id, [...(bullet[2] ?? '').matchAll(new RegExp(String.raw`\b${ID}`, 'g'))].map(m => m[0]))
      } else if (bullet[1] === 'Env') {
        current.env = bullet[2]?.trim() ?? ''
      } else {
        field = 'deps'
        depsText = bullet[2] ?? ''
      }
      continue
    }
    if (field === 'deps' && /^ {4,}\S/.test(line)) {
      depsText += ` ${line.trim()}`
      continue
    }
    closeDeps()
  }
  closeDeps()
  for (const [id, design] of designs) {
    const t = tasks.get(id)
    if (t) t.deps = [...new Set([...t.deps, ...design])]
  }
  return tasks
}

function parseDeps(text: string, ID: string): string[] {
  if (/^\s*nothing\b/i.test(text)) return []
  const deps = [...text.matchAll(new RegExp(String.raw`\b${ID}`, 'g'))].map(m => m[0])
  for (const m of text.matchAll(MILESTONE_DEP)) {
    const from = Number(m[1])
    const to = m[2] === undefined ? from : Number(m[2])
    for (let n = from; n <= to; n++) deps.push(`M${n}`)
  }
  return [...new Set(deps)]
}

/**
 * Yours: design, decisions, *(you)*, anything settled by eye or by hand on a
 * device, anything needing real accounts or secrets, spikes (you choose the
 * approach), and template tasks (an id with a `<placeholder>`).
 */
export function taskKind(task: RoadmapTask, config: Config = DEFAULT_CONFIG): TaskKind {
  const p = config.patterns
  if (task.id.includes('<') || new RegExp(p.yours).test(task.env) || new RegExp(p.yoursMarks).test(task.marks)) {
    return 'yours'
  }
  if (new RegExp(p.security).test(task.env)) return 'security'
  return 'agent'
}

export function parsePlan(text: string): Plan {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  const front = match?.[1] ?? ''
  const plan: Plan = { id: '', security: false, migration: false, files: [], body: match?.[2] ?? text }
  let inFiles = false
  for (const line of front.split('\n')) {
    const item = /^\s+-\s+(.+)$/.exec(line)
    if (inFiles && item) {
      plan.files.push(item[1]?.trim() ?? '')
      continue
    }
    inFiles = false
    const [key, ...rest] = line.split(':')
    const value = rest.join(':').trim()
    if (key === 'id') plan.id = value
    else if (key === 'security') plan.security = value === 'true'
    else if (key === 'migration') plan.migration = value === 'true'
    else if (key === 'files') inFiles = true
  }
  if (!plan.id) throw new Error('plan has no id in its front matter')
  return plan
}

function depDone(dep: string, roadmap: Map<string, RoadmapTask>): boolean {
  if (/^M\d+$/.test(dep)) {
    const inMilestone = [...roadmap.values()].filter(t => t.milestone === dep)
    return inMilestone.length > 0 && inMilestone.every(t => t.done)
  }
  return roadmap.get(dep)?.done === true
}

/**
 * Dependencies the ROADMAP can never satisfy: a task id it lacks, or a
 * milestone with no tasks (which never counts as done).
 */
export function unknownDeps(roadmap: Map<string, RoadmapTask>): string[] {
  const milestones = new Set([...roadmap.values()].map(t => t.milestone))
  const problems: string[] = []
  for (const t of roadmap.values()) {
    for (const d of t.deps) {
      const known = /^M\d+$/.test(d) ? milestones.has(d) : roadmap.has(d)
      if (!known) problems.push(`${t.id}: depends on unknown ${d}`)
    }
  }
  return problems
}

/** Open tasks `/autopilot-plan` may offer: not yours, dependencies done or queued. */
export function candidates(
  roadmap: Map<string, RoadmapTask>,
  queued: Set<string>,
  config: Config = DEFAULT_CONFIG,
): RoadmapTask[] {
  return [...roadmap.values()].filter(
    t =>
      !t.done &&
      !queued.has(t.id) &&
      taskKind(t, config) !== 'yours' &&
      t.deps.every(d => queued.has(d) || depDone(d, roadmap)),
  )
}

function isOpen(o: Outcome, roadmap: Map<string, RoadmapTask>): boolean {
  return (o.status === 'ok' || o.status === 'critical') && roadmap.get(o.id)?.done !== true
}

export function pickNext(
  state: State,
  roadmap: Map<string, RoadmapTask>,
  caps: Caps,
  today: string,
  config: Config = DEFAULT_CONFIG,
): Pick {
  if (state.stop) return { kind: 'stop', reason: 'STOP is set on the state branch' }
  const active = state.claims[0]
  if (active) return { kind: 'wait', reason: `${active.id} is in progress (one autopilot at a time)` }

  const startedToday = state.starts.filter(at => at.startsWith(today)).length
  if (startedToday >= caps.perDay) {
    return { kind: 'stop', reason: `daily cap reached (${startedToday} of ${caps.perDay})` }
  }

  const open = state.outcomes.filter(o => isOpen(o, roadmap))
  if (open.length >= caps.unmerged) {
    return { kind: 'wait', reason: `${open.length} PRs unmerged: run /merge-stack` }
  }
  const openSecurity = open.filter(o => o.security).length
  const finished = new Set(state.outcomes.map(o => o.id))

  const pending = [...state.queue]
    .sort((a, b) => a.order - b.order)
    .filter(q => !finished.has(q.plan.id) && roadmap.get(q.plan.id)?.done !== true)
  if (pending.length === 0) return { kind: 'stop', reason: 'the queue is empty: run /autopilot-plan' }

  const reasons: string[] = []
  for (const { plan } of pending) {
    const task = roadmap.get(plan.id)
    if (!task) {
      reasons.push(`${plan.id}: not in the ROADMAP`)
      continue
    }
    if (taskKind(task, config) === 'yours') {
      reasons.push(`${plan.id}: yours, not the autopilot's`)
      continue
    }
    if (plan.security && openSecurity >= caps.security) {
      reasons.push(`${plan.id}: ${openSecurity} security PRs unmerged`)
      continue
    }
    const why = baseFor(plan, task, open, roadmap, config.main)
    if (typeof why === 'object') return { kind: 'task', plan, base: why.base }
    reasons.push(`${plan.id}: ${why}`)
  }
  return { kind: 'wait', reason: reasons.join('; ') }
}

/**
 * Why nothing may branch from this open PR, if so. Stacks are one level
 * deep, which keeps `/merge-stack` to a single rebase per child.
 */
function stackable(parent: Outcome, main: string): string | undefined {
  if (parent.status === 'critical') return `${parent.id} has critical calls: merge it first`
  if (parent.security) return `${parent.id} is security-sensitive: merge it first`
  if (parent.base !== main) return `${parent.id} is itself stacked: merge its base first`
  return undefined
}

/** The branch a task starts from, or why it can't start yet. */
function baseFor(
  plan: Plan,
  task: RoadmapTask,
  open: Outcome[],
  roadmap: Map<string, RoadmapTask>,
  main: string,
): { base: string } | string {
  const parents = new Set<string>()
  for (const dep of task.deps) {
    if (depDone(dep, roadmap)) continue
    const parent = open.find(o => o.id === dep)
    if (!parent) return `waits for ${dep}`
    const unstackable = stackable(parent, main)
    if (unstackable) return unstackable
    parents.add(parent.branch)
  }
  if (parents.size > 1) return `depends on ${parents.size} open PRs: merge one first`
  let base = [...parents][0] ?? main

  if (plan.migration) {
    const newest = open
      .filter(o => o.migration)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
    if (newest) {
      const unstackable = stackable(newest, main)
      if (unstackable) return `${newest.id} holds the open migration; ${unstackable}`
      if (base === main) base = newest.branch
      else if (base !== newest.branch) return `two migrations would branch apart: merge ${newest.id} first`
    }
  }
  return { base }
}

const STOPWORDS = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'per'])

/** The branch `/task` would create: `<type>/<id>-<short-slug>`. */
export function branchName(task: RoadmapTask, config: Config = DEFAULT_CONFIG): string {
  const type = new RegExp(config.patterns.choreMarks).test(task.marks)
    ? 'chore'
    : new RegExp(config.patterns.docsMarks).test(task.marks)
      ? 'docs'
      : 'feat'
  const id = task.id.toLowerCase().replace(/[.<>]+/g, '-').replace(/-+$/, '')
  const words = task.title
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(w => w && !STOPWORDS.has(w))
    .slice(0, 3)
  return `${type}/${id}-${words.join('-')}`
}

interface FileDiff {
  file: string
  deleted: boolean
  added: string[]
  removed: string[]
}

function splitDiff(diff: string): FileDiff[] {
  const files: FileDiff[] = []
  let current: FileDiff | undefined
  for (const line of diff.split('\n')) {
    const header = /^diff --git a\/(\S+) b\/(\S+)/.exec(line)
    if (header) {
      current = { file: header[2] ?? '', deleted: false, added: [], removed: [] }
      files.push(current)
      continue
    }
    if (!current) continue
    if (line.startsWith('+++ ')) {
      current.deleted = line === '+++ /dev/null'
    } else if (line.startsWith('--- ')) {
      continue
    } else if (line.startsWith('+')) {
      current.added.push(line.slice(1))
    } else if (line.startsWith('-')) {
      current.removed.push(line.slice(1))
    }
  }
  return files
}

function inPlan(file: string, planFiles: string[], always: string[]): boolean {
  return always.includes(file) || planFiles.some(p => (p.endsWith('/') ? file.startsWith(p) : file === p))
}

/** Guard changes in a branch's diff (critical) and files the plan didn't name (minor). */
export function scanDiff(diff: string, planFiles: string[], config: Config = DEFAULT_CONFIG): Tripwire[] {
  const rules = config.rules.map(r => ({
    rule: r.rule,
    line: r.line ? new RegExp(r.line) : undefined,
    added: r.added ? new RegExp(r.added) : undefined,
    file: r.file ? new RegExp(r.file) : undefined,
  }))
  const testFile = new RegExp(config.testFile)
  const testCall = new RegExp(config.testCall)
  const hits: Tripwire[] = []
  for (const f of splitDiff(diff)) {
    const hit = (rule: string, line: string, severity: Severity = 'critical') =>
      hits.push({ rule, severity, file: f.file, line: line.trim() })

    const prose = f.file.endsWith('.md')
    for (const r of rules) {
      if (r.file && !r.file.test(f.file)) continue
      if (prose && (r.line || r.added)) continue
      const lines = [...(r.added ? f.added : []), ...(r.line ? [...f.added, ...f.removed] : [])]
      const re = r.added ?? r.line
      const found = re ? lines.find(l => re.test(l)) : f.added[0] ?? f.removed[0] ?? ''
      if (found !== undefined) hit(r.rule, found)
    }

    if (testFile.test(f.file)) {
      const removed = f.removed.filter(l => testCall.test(l))
      const added = f.added.filter(l => testCall.test(l)).length
      if (f.deleted || removed.length > added) hit('removed-test', removed[0] ?? '(file deleted)')
    }

    if (planFiles.length > 0 && !inPlan(f.file, planFiles, config.alwaysInPlan)) {
      hit('outside-plan', '', 'minor')
    }
  }
  return hits
}

export interface LoggedEvent {
  at: string
  id: string
  level: string
  text: string
}

export interface Assessment {
  /** A critical call reported by this attempt. */
  critical: boolean
  /** BLOCKED reported by this attempt. */
  blocked: boolean
  /** The PR this attempt reported. */
  pr?: string
}

export function assessEvents(events: LoggedEvent[], id: string, since: string): Assessment {
  const attempt = events.filter(e => e.id === id && e.at >= since)
  return {
    critical: attempt.some(e => e.level === 'critical'),
    blocked: attempt.some(e => e.level === 'blocked'),
    pr: attempt.filter(e => e.level === 'pr').at(-1)?.text,
  }
}

type Env = Record<string, string | undefined>

/** A Claude Code cloud session sets `CLAUDE_CODE_REMOTE=true`; it is never set locally. */
export function isCloud(env: Env): boolean {
  return env.CLAUDE_CODE_REMOTE === 'true'
}

/**
 * Where a run holds its claim, for `status` once the run is gone: a cloud
 * session's link (its VM can be reclaimed mid-run), or `local`. Never the
 * machine's name: the state branch is pushed.
 */
export function runnerOf(env: Env): string {
  if (!isCloud(env)) return 'local'
  const session = env.CLAUDE_CODE_REMOTE_SESSION_ID
  return session ? `https://claude.ai/code/${session.replace(/^cse_/, 'session_')}` : 'a cloud session'
}

export type Start = { kind: 'fresh' } | { kind: 'refuse'; reason: string }

/**
 * Every attempt starts fresh. A branch an earlier attempt left behind,
 * pushed or only local, is yours: finish it by hand, or delete it.
 */
export function startFor(branch: { left: boolean }): Start {
  if (!branch.left) return { kind: 'fresh' }
  return {
    kind: 'refuse',
    reason:
      'an earlier attempt left its branch: finish it yourself (check it out, then /ship), or delete it ' +
      '(locally and on origin) and close its PR to start over',
  }
}

const SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The session of a `claude -p --output-format json` run: one result object, or a list of messages. */
export function sessionOf(stdout: string): string | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return undefined
  }
  const messages = (Array.isArray(parsed) ? parsed : [parsed]) as { session_id?: unknown }[]
  const id = messages.map(m => m?.session_id).filter(s => typeof s === 'string').at(-1)
  return typeof id === 'string' && SESSION.test(id) ? id : undefined
}

export interface WorkerEnd {
  /** The worker's exit code. */
  exit: number
  /** Commits on the task branch above its base. */
  commits: number
  /** What the attempt reported so far. */
  reported: Assessment
  /** The session to resume, from the worker's output. */
  session?: string
  /** Resumes the attempt has had. */
  resumes: number
}

export type Resume = { kind: 'resume'; session: string } | { kind: 'check' }

/**
 * A headless worker ends when its turn does, so a turn that ends early (a
 * skill whose report reads as the final answer) leaves work on the branch and
 * no PR. Resume it once; a worker that reported its PR, or stops again, is
 * checked as it stands.
 */
export function resumeFor(w: WorkerEnd): Resume {
  const early = w.exit === 0 && w.commits > 0 && !w.reported.blocked && !w.reported.pr
  return early && w.session && w.resumes < 1 ? { kind: 'resume', session: w.session } : { kind: 'check' }
}
