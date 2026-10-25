/**
 * `playbook-autopilot <command>`: the git, files and processes around the
 * pure functions in `autopilot.ts`. Settings come from the project's
 * `.claude/profile.json` (`autopilot`, `verify`, `gate`, `stack.setup`,
 * `docs`).
 *
 * State lives on the state branch (`autopilot-state`) so every route sees
 * it: reads go through `origin/<state>`, writes through a worktree of that
 * branch, committed and pushed at once. A rejected push is retried from a
 * fresh fetch, which is what makes a claim a lock across machines; a lock
 * folder serialises writers on this one.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  assessEvents,
  branchName,
  candidates,
  configFrom,
  parsePlan,
  parseRoadmap,
  pickNext,
  resumeFor,
  scanDiff,
  sessionOf,
  startFor,
  taskKind,
  unknownDeps,
  type Caps,
  type Claim,
  type Config,
  type Outcome,
  type Plan,
  type State,
  type Status,
  type Tripwire,
} from './autopilot.ts'

const STATUSES: Status[] = ['ok', 'critical', 'blocked', 'failed']
const LEVELS = ['info', 'minor', 'critical', 'blocked', 'pr'] as const
type Level = (typeof LEVELS)[number]

interface Event {
  at: string
  id: string
  level: Level
  text: string
}

interface Profile {
  stack?: { setup?: string }
  verify?: Record<string, string>
  gate?: string[]
  docs?: { roadmap?: string; log?: string }
  git?: { main?: string }
  autopilot?: {
    mode?: 'off' | 'plan-only' | 'local-queue'
    stateBranch?: string
    caps?: Partial<Caps>
    permissionMode?: string
    workerTimeoutHours?: number
    keepAwake?: string
    copyIntoWorktree?: string[]
  } & Parameters<typeof configFrom>[0]['autopilot']
}

function git(args: string[], cwd = process.cwd()): string {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
  }).trim()
}

function tryGit(args: string[], cwd = process.cwd()): string | undefined {
  try {
    return git(args, cwd)
  } catch {
    return undefined
  }
}

/** The primary checkout, whichever worktree we run in. */
function repoRoot(): string {
  return resolve(git(['rev-parse', '--path-format=absolute', '--git-common-dir']), '..')
}

/** This worktree's profile: a worker reads the one on its own branch. */
function loadProfile(): Profile {
  const file = join(git(['rev-parse', '--show-toplevel']), '.claude', 'profile.json')
  if (!existsSync(file)) throw new Error(`no ${file}: run /playbook:boot first`)
  return JSON.parse(readFileSync(file, 'utf8')) as Profile
}

const profile: Profile = ['help', '--help'].includes(process.argv[2] ?? '') ? {} : loadProfile()
const config: Config = configFrom(profile)
const ap = profile.autopilot ?? {}
const MAIN = config.main
const STATE_BRANCH = ap.stateBranch || 'autopilot-state'
const REMOTE_STATE = `origin/${STATE_BRANCH}`
const ROADMAP = profile.docs?.roadmap || 'ROADMAP.md'
const LOG = profile.docs?.log || 'docs/log.md'

function positive(name: string, fromProfile: number | undefined, fallback: number): number {
  const value = Number(process.env[name] ?? fromProfile ?? fallback)
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`)
  return value
}

function requireMode(...modes: string[]): void {
  const mode = ap.mode ?? 'off'
  if (!modes.includes(mode)) {
    throw new Error(`autopilot.mode is "${mode}" in .claude/profile.json; this needs ${modes.join(' or ')}`)
  }
}

const worktrees = () => join(repoRoot(), '.claude', 'worktrees')
const logs = () => join(worktrees(), 'autopilot-logs')
const safe = (id: string) => id.replace(/[<>]/g, '_')

/**
 * One line per event, on stdout and in `autopilot-logs/live.log`: the
 * foreman follows that file, so a worker's own events reach it as they
 * happen, not when its task ends.
 */
function out(level: string, id: string, text: string): void {
  const line = `AUTOPILOT ${level} ${id} ${text}`.trimEnd()
  console.log(line)
  try {
    mkdirSync(logs(), { recursive: true })
    appendFileSync(join(logs(), 'live.log'), `${line}\n`)
  } catch {
    // The live log is for the foreman; losing a line must not fail a state write.
  }
}

// ── state: reads ────────────────────────────────────────────────────────────

function fetchState(): boolean {
  tryGit(['fetch', '-q', 'origin', `+refs/heads/${STATE_BRANCH}:refs/remotes/${REMOTE_STATE}`])
  return tryGit(['rev-parse', '-q', '--verify', REMOTE_STATE]) !== undefined
}

function list(dir: string): string[] {
  const names = tryGit(['ls-tree', '--name-only', `${REMOTE_STATE}:${dir}`])
  return names ? names.split('\n').filter(Boolean) : []
}

function show(path: string): string | undefined {
  return tryGit(['show', `${REMOTE_STATE}:${path}`])
}

function parseEvents(text: string): Event[] {
  return text.split('\n').filter(Boolean).map(l => JSON.parse(l) as Event)
}

const isStart = (e: Event) => e.level === 'info' && e.text.startsWith('started on ')

function readState(): State & { queueFiles: Map<string, string> } {
  const queueFiles = new Map<string, string>()
  if (!fetchState()) return { queue: [], claims: [], outcomes: [], starts: [], stop: false, queueFiles }
  const queue = list('queue').map(name => {
    const plan = parsePlan(`${show(`queue/${name}`) ?? ''}\n`)
    queueFiles.set(plan.id, name)
    return { order: Number(name.split('-')[0]), plan }
  })
  const json = <T>(dir: string) => list(dir).map(n => JSON.parse(show(`${dir}/${n}`) ?? '{}') as T)
  return {
    queue,
    claims: json<Claim>('claims'),
    outcomes: json<Outcome>('outcomes'),
    starts: parseEvents(show('events.jsonl') ?? '').filter(isStart).map(e => e.at),
    stop: show('STOP') !== undefined,
    queueFiles,
  }
}

function readEvents(): Event[] {
  return fetchState() ? parseEvents(show('events.jsonl') ?? '') : []
}

function mainRoadmap() {
  tryGit(['fetch', '-q', 'origin', MAIN])
  return parseRoadmap(git(['show', `origin/${MAIN}:${ROADMAP}`]), config)
}

// ── state: writes ───────────────────────────────────────────────────────────

function stateTree(): string {
  const dir = join(worktrees(), STATE_BRANCH)
  if (existsSync(dir)) return dir
  mkdirSync(dirname(dir), { recursive: true })
  if (fetchState()) {
    git(['worktree', 'add', '-q', '-B', STATE_BRANCH, dir, REMOTE_STATE])
  } else {
    git(['worktree', 'add', '-q', '--orphan', '-b', STATE_BRANCH, dir])
    writeFileSync(
      join(dir, 'README.md'),
      '# Autopilot state\n\nWritten by `playbook-autopilot` only. Never merged into the main branch.\n',
    )
    git(['add', '-A'], dir)
    git(['commit', '-q', '-m', 'chore: start autopilot state'], dir)
    git(['push', '-q', '-u', 'origin', STATE_BRANCH], dir)
  }
  return dir
}

function ownerOf(dir: string): string {
  try {
    return readFileSync(join(dir, 'owner'), 'utf8')
  } catch {
    return ''
  }
}

/** Serialise writers on this machine: a worker's event and your `stop` share the state worktree. */
function withLocalLock<T>(fn: () => T): T {
  mkdirSync(worktrees(), { recursive: true })
  const lock = join(worktrees(), `${STATE_BRANCH}.lock`)
  const owner = join(lock, 'owner')
  const token = `${process.pid}-${Math.random().toString(36).slice(2)}`
  const deadline = Date.now() + 60_000
  for (;;) {
    let made = false
    try {
      mkdirSync(lock)
      made = true
    } catch {
      try {
        // A lock older than two minutes belongs to a process that died. Renaming
        // first means only one waiter breaks it. Accepted: two waiters breaking
        // an ownerless lock in the same few milliseconds can still collide.
        if (Date.now() - statSync(lock).mtimeMs > 120_000) {
          const seen = ownerOf(lock)
          const stale = `${lock}.stale-${token}`
          renameSync(lock, stale)
          // Another waiter may have broken it and taken a fresh lock between our
          // read and our rename: if so, give that lock back.
          if (ownerOf(stale) !== seen) renameSync(stale, lock)
          else rmSync(stale, { recursive: true, force: true })
        }
      } catch {
        // Released or broken by someone else meanwhile: just try again.
      }
    }
    if (made) {
      try {
        writeFileSync(owner, token)
      } catch (error) {
        rmSync(lock, { recursive: true, force: true })
        throw error
      }
      break
    }
    if (Date.now() > deadline) throw new Error(`the state is locked: ${lock}`)
    spawnSync('sleep', ['0.2'])
  }
  try {
    return fn()
  } finally {
    // Only our own lock: after a stale break it may be someone else's.
    try {
      if (readFileSync(owner, 'utf8') === token) rmSync(lock, { recursive: true, force: true })
    } catch {
      // Already gone.
    }
  }
}

/** Apply `change` to a fresh copy of the state and push it; retried on a race. */
function mutate(change: (dir: string) => string): void {
  withLocalLock(() => {
    const dir = stateTree()
    for (let attempt = 1; ; attempt++) {
      git(['fetch', '-q', 'origin', STATE_BRANCH], dir)
      git(['reset', '-q', '--hard', REMOTE_STATE], dir)
      const message = change(dir)
      git(['add', '-A'], dir)
      // `diff --quiet` succeeds only when nothing changed.
      if (tryGit(['diff', '--cached', '--quiet'], dir) !== undefined) return
      git(['commit', '-q', '-m', message], dir)
      if (tryGit(['push', '-q', 'origin', STATE_BRANCH], dir) !== undefined) return
      if (attempt === 5) throw new Error('could not push the autopilot state after 5 attempts')
    }
  })
}

function writeJson(dir: string, path: string, value: unknown): void {
  mkdirSync(join(dir, path, '..'), { recursive: true })
  writeFileSync(join(dir, path), `${JSON.stringify(value, null, 2)}\n`)
}

function appendEvent(dir: string, event: Event): void {
  appendFileSync(join(dir, 'events.jsonl'), `${JSON.stringify(event)}\n`)
}

const claimed = (dir: string) =>
  existsSync(join(dir, 'claims')) ? readdirSync(join(dir, 'claims')).map(n => n.replace(/\.json$/, '')) : []

function recordEvent(id: string, level: Level, text: string): void {
  mutate(dir => {
    appendEvent(dir, { at: new Date().toISOString(), id, level, text })
    return `chore: autopilot ${level} ${id}`
  })
  out(level, id, text)
}

// ── commands ────────────────────────────────────────────────────────────────

function caps(): Caps {
  return {
    unmerged: positive('AUTOPILOT_MAX_UNMERGED', ap.caps?.unmerged, 4),
    security: positive('AUTOPILOT_MAX_SECURITY', ap.caps?.security, 2),
    perDay: positive('AUTOPILOT_MAX_PER_DAY', ap.caps?.perDay, 6),
  }
}

function status(): void {
  const state = readState()
  const roadmap = mainRoadmap()
  const merged = (id: string) => roadmap.get(id)?.done === true
  console.log(`Mode: ${ap.mode ?? 'off'}`)
  console.log(`STOP: ${state.stop ? 'set' : 'not set'}`)
  console.log('\nQueue:')
  for (const q of [...state.queue].sort((a, b) => a.order - b.order)) {
    const sec = q.plan.security ? ' (security)' : ''
    console.log(`  ${q.order}. ${q.plan.id}${sec}${merged(q.plan.id) ? ' merged' : ''}`)
  }
  console.log('\nIn progress:')
  for (const c of state.claims) console.log(`  ${c.id} on ${c.branch} (base ${c.base}) since ${c.at}`)
  console.log('\nFinished:')
  for (const o of state.outcomes) {
    console.log(`  ${o.id} ${merged(o.id) ? 'merged' : o.status} ${o.branch} (base ${o.base}) ${o.pr ?? ''}`.trimEnd())
  }
  const pick = pickNext(state, roadmap, caps(), today(), config)
  console.log(`\nNext: ${pick.kind === 'task' ? `${pick.plan.id} from ${pick.base}` : `${pick.kind}: ${pick.reason}`}`)
}

function listCandidates(): void {
  const state = readState()
  const queued = new Set([...state.queue.map(q => q.plan.id), ...state.outcomes.map(o => o.id)])
  for (const t of candidates(mainRoadmap(), queued, config)) {
    console.log(`${t.id}\t${taskKind(t, config)}\t${t.title}\t${t.env}`)
  }
}

function enqueue(file: string): void {
  requireMode('local-queue')
  const text = readFileSync(file, 'utf8')
  const plan = parsePlan(text)
  const task = mainRoadmap().get(plan.id)
  if (!task) throw new Error(`${plan.id} is not in ${ROADMAP} on ${MAIN}`)
  if (taskKind(task, config) === 'yours') throw new Error(`${plan.id} is yours, not the autopilot's`)
  if (plan.security !== (taskKind(task, config) === 'security')) {
    throw new Error(`${plan.id}: the plan's security flag disagrees with its Env line`)
  }
  mutate(dir => {
    mkdirSync(join(dir, 'queue'), { recursive: true })
    const names = readdirSync(join(dir, 'queue'))
    if (names.some(n => n.endsWith(`-${safe(plan.id)}.md`))) throw new Error(`${plan.id} is already queued`)
    const next = Math.max(0, ...names.map(n => Number(n.split('-')[0]))) + 1
    writeFileSync(join(dir, 'queue', `${String(next).padStart(3, '0')}-${safe(plan.id)}.md`), text)
    return `chore: autopilot queue ${plan.id}`
  })
  out('info', plan.id, 'queued')
}

function dequeue(id: string): void {
  mutate(dir => {
    if (claimed(dir).includes(safe(id))) {
      throw new Error(`${id} is in progress: \`playbook-autopilot release ${id}\` first`)
    }
    for (const n of existsSync(join(dir, 'queue')) ? readdirSync(join(dir, 'queue')) : []) {
      if (n.endsWith(`-${safe(id)}.md`)) rmSync(join(dir, 'queue', n))
    }
    rmSync(join(dir, 'outcomes', `${safe(id)}.json`), { force: true })
    appendEvent(dir, { at: new Date().toISOString(), id, level: 'info', text: 'dequeued' })
    return `chore: autopilot dequeue ${id}`
  })
  out('info', id, 'dequeued; its branch and PR, if any, are kept')
}

function branchLeft(branch: string): boolean {
  return (
    tryGit(['rev-parse', '-q', '--verify', `origin/${branch}`]) !== undefined ||
    tryGit(['rev-parse', '-q', '--verify', `refs/heads/${branch}`]) !== undefined
  )
}

/** Run a task again from its approved plan, from scratch. */
function requeue(id: string): void {
  const task = mainRoadmap().get(id)
  if (!task) throw new Error(`${id} is not in ${ROADMAP} on ${MAIN}`)
  git(['fetch', '-q', '--prune', 'origin'])
  const start = startFor({ left: branchLeft(branchName(task, config)) })
  if (start.kind === 'refuse') throw new Error(`${id}: ${start.reason}; then requeue`)
  mutate(dir => {
    const queued =
      existsSync(join(dir, 'queue')) && readdirSync(join(dir, 'queue')).some(n => n.endsWith(`-${safe(id)}.md`))
    if (!queued) throw new Error(`${id} has no approved plan in the queue: enqueue one`)
    if (claimed(dir).includes(safe(id))) throw new Error(`${id} is in progress`)
    rmSync(join(dir, 'outcomes', `${safe(id)}.json`), { force: true })
    appendEvent(dir, { at: new Date().toISOString(), id, level: 'info', text: 'requeued' })
    return `chore: autopilot requeue ${id}`
  })
  out('info', id, 'requeued: the next run starts it from scratch')
}

function planText(id: string): string {
  const name = readState().queueFiles.get(id)
  if (!name) throw new Error(`${id} has no approved plan in the queue`)
  return show(`queue/${name}`) ?? ''
}

/** For `/task`: exit 1 when the autopilot owns the task, unless this is its own worker. */
function owns(id: string): void {
  if ((ap.mode ?? 'off') === 'off') return
  const state = readState()
  const roadmap = mainRoadmap()
  const claim = state.claims.find(c => c.id === id)
  if (claim) {
    if (tryGit(['branch', '--show-current']) === claim.branch) return
    console.log(`${id} is in progress on ${claim.branch}. If no run is going, \`playbook-autopilot release ${id}\`.`)
    process.exitCode = 1
    return
  }
  const outcome = state.outcomes.find(o => o.id === id)
  if (outcome && (outcome.status === 'ok' || outcome.status === 'critical') && roadmap.get(id)?.done !== true) {
    console.log(`${id} has an open autopilot PR ${outcome.pr ?? `on ${outcome.branch}`}: merge it with /merge-stack.`)
    process.exitCode = 1
    return
  }
  if (!outcome && state.queue.some(q => q.plan.id === id)) {
    console.log(`${id} is queued for the autopilot: \`playbook-autopilot dequeue ${id}\` to take it back.`)
    process.exitCode = 1
  }
}

function setStop(on: boolean): void {
  mutate(dir => {
    if (on) writeFileSync(join(dir, 'STOP'), `${new Date().toISOString()}\n`)
    else rmSync(join(dir, 'STOP'), { force: true })
    return `chore: autopilot ${on ? 'stop' : 'resume'}`
  })
  out(on ? 'stopped' : 'info', '-', on ? 'STOP set: the run ends after the current task' : 'STOP cleared')
}

function claim(c: Claim): void {
  mutate(dir => {
    if (claimed(dir).length > 0) throw new Error('another task is in progress')
    writeJson(dir, `claims/${safe(c.id)}.json`, c)
    appendEvent(dir, { at: c.at, id: c.id, level: 'info', text: `started on ${c.branch} from ${c.base}` })
    return `chore: autopilot claim ${c.id}`
  })
  out('start', c.id, `${c.branch} from ${c.base}`)
}

function finish(c: Claim, status: Status, pr?: string, note?: string): void {
  const o: Outcome = {
    id: c.id, branch: c.branch, base: c.base, status, security: c.security, migration: c.migration, startedAt: c.at, pr,
  }
  mutate(dir => {
    rmSync(join(dir, 'claims', `${safe(o.id)}.json`), { force: true })
    writeJson(dir, `outcomes/${safe(o.id)}.json`, o)
    const reason = note ? ` (${note})` : ''
    appendEvent(dir, { at: new Date().toISOString(), id: o.id, level: 'info', text: `finished: ${o.status}${reason}` })
    return `chore: autopilot ${o.status} ${o.id}`
  })
  out(o.status === 'ok' ? 'done' : o.status, o.id, note ?? o.pr ?? '')
}

/** A claim a run left behind (crash, Ctrl-C): record it as finished. */
function release(id: string, status: Status): void {
  const c = readState().claims.find(x => x.id === id)
  if (!c) throw new Error(`${id} is not in progress`)
  finish(c, status)
}

/** `/merge-stack` after a squash merge: a child now starts from main. */
function rebased(id: string, base: string): void {
  mutate(dir => {
    const file = join(dir, 'outcomes', `${safe(id)}.json`)
    if (!existsSync(file)) throw new Error(`${id} has no outcome`)
    const o = JSON.parse(readFileSync(file, 'utf8')) as Outcome
    writeJson(dir, `outcomes/${safe(id)}.json`, { ...o, base })
    appendEvent(dir, { at: new Date().toISOString(), id, level: 'info', text: `rebased onto ${base}` })
    return `chore: autopilot rebase ${id}`
  })
  out('info', id, `now based on ${base}`)
}

// ── checking a finished task ────────────────────────────────────────────────

interface CheckResult {
  status: Status
  tripwires: Tripwire[]
  problems: string[]
  pr?: string
}

function baseRef(base: string): string {
  return `origin/${base}`
}

/** The profile's gate commands, by name. */
function gateCommands(): [string, string][] {
  return (profile.gate ?? []).map(name => [name, profile.verify?.[name] ?? ''] as [string, string]).filter(([, cmd]) => cmd)
}

function check(c: Claim, plan: Plan, cwd: string, verify: boolean): CheckResult {
  const problems: string[] = []
  tryGit(['fetch', '-q', 'origin'], cwd)
  const { pr, blocked, critical: reportedCritical } = assessEvents(readEvents(), c.id, c.at)

  if (blocked) return { status: 'blocked', tripwires: [], problems: [], pr }
  const commits = tryGit(['rev-list', '--count', `${baseRef(c.base)}..HEAD`], cwd) ?? '0'
  if (commits === '0') return { status: 'failed', tripwires: [], problems: ['no commits, and no BLOCKED reported'], pr }

  const diff = git(['diff', `${baseRef(c.base)}...HEAD`], cwd)
  const tripwires = scanDiff(diff, plan.files, config)
  // The committed state only: an uncommitted check-off doesn't count.
  if (git(['status', '--porcelain'], cwd) !== '') problems.push('uncommitted changes left behind')
  const onBranch = parseRoadmap(git(['show', `HEAD:${ROADMAP}`], cwd), config).get(c.id)
  if (onBranch?.done !== true) problems.push(`${c.id} is not checked off in ${ROADMAP}`)
  if (!diff.includes(`diff --git a/${LOG}`)) problems.push(`no ${LOG} entry`)
  if (tryGit(['rev-parse', `origin/${c.branch}`], cwd) !== git(['rev-parse', 'HEAD'], cwd)) {
    problems.push('the branch is not pushed as it stands')
  }
  if (!pr) problems.push('no PR reported')
  if (verify) {
    for (const [name, cmd] of gateCommands()) {
      const run = spawnSync('sh', ['-c', cmd], { cwd, stdio: 'ignore' })
      if (run.status !== 0) problems.push(`${name} fails (${cmd})`)
    }
  }

  const critical = reportedCritical || tripwires.some(t => t.severity === 'critical')
  const status: Status = problems.length > 0 ? 'failed' : critical ? 'critical' : 'ok'
  return { status, tripwires, problems, pr }
}

// ── the local loop ──────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function workerTree(): string {
  const dir = join(worktrees(), 'autopilot')
  if (!existsSync(dir)) {
    git(['fetch', '-q', 'origin', MAIN])
    git(['worktree', 'add', '-q', '--detach', dir, `origin/${MAIN}`])
    // `git worktree add` skips .worktreeinclude: copy the gitignored files by hand.
    for (const name of ap.copyIntoWorktree ?? ['.env.local']) {
      const from = join(repoRoot(), name)
      if (existsSync(from)) copyFileSync(from, join(dir, name))
    }
  }
  return dir
}

/** Put the worker tree on a new branch for the task, from its base. */
function prepare(c: Claim, wt: string): void {
  git(['fetch', '-q', '--prune', 'origin'], wt)
  git(['reset', '-q', '--hard'], wt)
  git(['clean', '-qfd'], wt)
  git(['switch', '-q', '--no-track', '-c', c.branch, baseRef(c.base)], wt)
  const setup = profile.stack?.setup
  if (setup) {
    const install = spawnSync('sh', ['-c', setup], { cwd: wt, stdio: 'ignore' })
    if (install.status !== 0) throw new Error(`setup failed in the worker tree (${setup})`)
  }
}

const LIMIT = /usage limit|rate limit|limit reached|limit will reset/i

type Ending = 'next' | 'stop'

/** One task, start to finish. Whatever goes wrong, the claim ends as an outcome. */
function runOne(c: Claim, plan: Plan, wt: string, verify: boolean): { status: Status; ending: Ending } {
  let finished = false
  const end = (status: Status, pr?: string, note?: string) => {
    finish(c, status, pr, note)
    finished = true
  }
  try {
    prepare(c, wt)
    // One time limit for the worker and its resume together.
    const deadline = Date.now() + (ap.workerTimeoutHours ?? 4) * 60 * 60 * 1000
    const log = join(logs(), `${safe(c.id)}-${c.at.replace(/[:.]/g, '-')}`)
    const work = (args: string[], suffix: string) => {
      const worker = spawnSync(
        'claude',
        [
          ...args,
          '--output-format', 'json',
          '--permission-mode', process.env.AUTOPILOT_PERMISSION_MODE ?? ap.permissionMode ?? 'auto',
          '--name', `autopilot ${c.id}`,
        ],
        { cwd: wt, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: Math.max(deadline - Date.now(), 1) },
      )
      const output = `${worker.stdout ?? ''}${worker.stderr ?? ''}`
      writeFileSync(`${log}${suffix}.json`, output)
      return { worker, output }
    }

    let { worker, output } = work(['-p', `/playbook:autopilot-next ${c.id}`], '')
    for (let resumes = 0; ; resumes++) {
      if (worker.error || worker.status === null) {
        const why = worker.error?.message ?? `killed (${worker.signal ?? 'timeout'})`
        end('failed', undefined, `worker did not run to the end: ${why}`)
        return { status: 'failed', ending: 'stop' }
      }
      if (worker.status !== 0 && LIMIT.test(output)) {
        end('failed', undefined, 'usage limit')
        out('limit', c.id, 'usage limit reached: once it resets, finish its branch with /ship, or delete it and requeue')
        return { status: 'failed', ending: 'stop' }
      }
      const next = resumeFor({
        exit: worker.status,
        commits: Number(tryGit(['rev-list', '--count', `${baseRef(c.base)}..HEAD`], wt) ?? '0'),
        reported: assessEvents(readEvents(), c.id, c.at),
        session: sessionOf(worker.stdout ?? ''),
        resumes,
      })
      if (next.kind === 'check' || Date.now() >= deadline) break
      recordEvent(c.id, 'info', 'worker ended before its PR: resuming it once')
      ;({ worker, output } = work(
        [
          '-p',
          'You ended your turn before this task was done. Carry on from where you stopped: finish `ship` ' +
            `and report the PR with \`playbook-autopilot event ${c.id} pr <url>\`, or stop BLOCKED.`,
          '--resume', next.session,
        ],
        '-resume',
      ))
    }

    const result = check(c, plan, wt, verify)
    for (const t of result.tripwires) {
      recordEvent(c.id, t.severity, `tripwire ${t.rule} in ${t.file}: ${t.line}`.slice(0, 300))
    }
    for (const p of result.problems) recordEvent(c.id, 'info', `check: ${p}`)
    end(result.status, result.pr)
    // BLOCKED usually means something the next task would hit too (a locked credential store, a wrong plan).
    return { status: result.status, ending: result.status === 'blocked' ? 'stop' : 'next' }
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error)
    // Never overwrite an outcome already recorded.
    if (finished) out('info', c.id, `error after finishing: ${why}`)
    else end('failed', undefined, why)
    return { status: 'failed', ending: 'stop' }
  } finally {
    // Leave the branch checked out nowhere, so you can finish or delete it by hand;
    // one with nothing on it (setup failed, worker died early) is just removed.
    tryGit(['switch', '-q', '--detach'], wt)
    const empty = tryGit(['rev-list', '--count', `${baseRef(c.base)}..${c.branch}`], wt) === '0'
    const pushed = tryGit(['rev-parse', '-q', '--verify', `origin/${c.branch}`], wt) !== undefined
    if (empty && !pushed) tryGit(['branch', '-q', '-D', c.branch], wt)
  }
}

function run(max: number, verify: boolean): void {
  requireMode('local-queue')
  const wt = workerTree()
  mkdirSync(logs(), { recursive: true })
  let failsInRow = 0

  for (let n = 0; n < max; n++) {
    const state = readState()
    const roadmap = mainRoadmap()
    const pick = pickNext(state, roadmap, caps(), today(), config)
    if (pick.kind !== 'task') {
      out(pick.kind === 'stop' ? 'stopped' : 'waiting', '-', pick.reason)
      return
    }
    const { plan, base } = pick
    const task = roadmap.get(plan.id)
    if (!task) throw new Error(`${plan.id} vanished from ${ROADMAP}`)
    const branch = branchName(task, config)
    git(['fetch', '-q', '--prune', 'origin'])
    const start = startFor({ left: branchLeft(branch) })
    if (start.kind === 'refuse') {
      out('blocked', plan.id, `not started on ${branch}: ${start.reason}`)
      out('stopped', '-', `${plan.id} needs you before the queue can go on`)
      return
    }
    // The claim comes first: it is the lock, and nothing touches the worker tree without it.
    const c: Claim = {
      id: plan.id, branch, base, at: new Date().toISOString(), security: plan.security, migration: plan.migration,
    }
    claim(c)

    const { status, ending } = runOne(c, plan, wt, verify)
    if (ending === 'stop') {
      out('stopped', '-', `stopped after ${c.id} ended ${status}`)
      return
    }
    failsInRow = status === 'failed' ? failsInRow + 1 : 0
    if (failsInRow >= 2) {
      out('stopped', '-', 'two failed tasks in a row')
      return
    }
  }
  out('stopped', '-', `ran ${max} tasks, the run's maximum`)
}

// ── checking a ROADMAP against the format contract ──────────────────────────

/** For boot and doctor: parse the working copy's ROADMAP, report what the commands can't use. */
function lintRoadmap(path: string): void {
  const file = resolve(git(['rev-parse', '--show-toplevel']), path)
  if (!existsSync(file)) throw new Error(`no ${file}`)
  const md = readFileSync(file, 'utf8')
  const tasks = parseRoadmap(md, config)
  const problems: string[] = []
  const looksLikeTask = md.split('\n').filter(l => /^- \[( |x)\] /.test(l)).length
  if (tasks.size === 0) problems.push('no task lines in the contract format (- [ ] **T0.1 Title** `[S]`)')
  if (looksLikeTask > tasks.size) {
    problems.push(`${looksLikeTask - tasks.size} checklist lines don't parse as tasks (id format?)`)
  }
  const kinds = { yours: 0, security: 0, agent: 0 }
  const milestones = new Set<string>()
  for (const t of tasks.values()) {
    kinds[taskKind(t, config)]++
    if (t.milestone) milestones.add(t.milestone)
    else problems.push(`${t.id}: not under a "## M<n>" milestone heading`)
    if (!t.done && !t.env) problems.push(`${t.id}: no Env line`)
  }
  problems.push(...unknownDeps(tasks))
  console.log(`${tasks.size} tasks in ${milestones.size} milestones (${[...milestones].join(', ')})`)
  console.log(`kinds: ${kinds.agent} agent, ${kinds.security} security, ${kinds.yours} yours`)
  for (const p of problems) console.log(`problem: ${p}`)
  if (problems.length > 0) process.exitCode = 1
}

// ── entry ───────────────────────────────────────────────────────────────────

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

function required(value: string | undefined, what: string): string {
  if (!value) throw new Error(`missing ${what}`)
  return value
}

const USAGE = `usage: playbook-autopilot <command>
  status                         mode, queue, task in progress, finished tasks, what runs next
  candidates                     open tasks /autopilot-plan may offer
  enqueue <plan.md>              add an approved plan to the queue (mode local-queue)
  dequeue <id>                   take a task back (not while it runs)
  requeue <id>                   run a task again from scratch
  plan <id>                      print a task's approved plan
  owns <id>                      exit 1 if the autopilot owns the task (for /task)
  event <id> <level> <text>      level: ${LEVELS.join(', ')}
  events [<id>]                  the event log
  stop | resume                  set or clear STOP
  release <id> [--status s]      end a claim a dead run left behind (default failed)
  rebased <id> <base>            record a stacked PR's new base (/merge-stack)
  run [--max N] [--no-verify]    the local loop (default 3 tasks; mode local-queue)
  lint-roadmap [path]            check the working copy's ROADMAP against the format contract`

function main(argv: string[]): void {
  const [command = 'status', ...args] = argv
  const id = () => required(args[0], 'task id')
  switch (command) {
    case 'status': return status()
    case 'candidates': return listCandidates()
    case 'enqueue': return enqueue(required(args[0], 'plan file'))
    case 'dequeue': return dequeue(id())
    case 'requeue': return requeue(id())
    case 'plan': return void console.log(planText(id()))
    case 'owns': return owns(id())
    case 'stop': return setStop(true)
    case 'resume': return setStop(false)
    case 'release': {
      const status = (flag(args, '--status') ?? 'failed') as Status
      if (!STATUSES.includes(status)) throw new Error(`--status must be one of ${STATUSES.join(', ')}`)
      return release(id(), status)
    }
    case 'rebased': return rebased(id(), required(args[1], 'new base'))
    case 'event': {
      const level = args[1] as Level
      if (!LEVELS.includes(level)) throw new Error(`level must be one of ${LEVELS.join(', ')}`)
      return recordEvent(id(), level, required(args.slice(2).join(' '), 'event text'))
    }
    case 'events':
      for (const e of readEvents().filter(e => !args[0] || e.id === args[0])) {
        console.log(`${e.at} ${e.level} ${e.id} ${e.text}`)
      }
      return
    case 'run': {
      const max = Number(flag(args, '--max') ?? 3)
      if (!Number.isInteger(max) || max < 1) throw new Error('--max must be a positive integer')
      return run(max, !args.includes('--no-verify'))
    }
    case 'lint-roadmap':
      return lintRoadmap(args[0] ?? ROADMAP)
    case 'help':
    case '--help':
      return void console.log(USAGE)
    default:
      throw new Error(`unknown command ${command}\n${USAGE}`)
  }
}

try {
  main(process.argv.slice(2))
} catch (error) {
  console.error(`playbook-autopilot: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
