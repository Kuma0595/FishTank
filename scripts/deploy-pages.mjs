import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repository = 'https://github.com/Kuma0595/FishTank.git'
// Homebrew's standard path also supports shells which omit it from PATH.
const env = { ...process.env, PATH: process.platform === 'darwin' ? `/opt/homebrew/bin:${process.env.PATH ?? ''}` : process.env.PATH }
const hasGh = spawnSync('gh', ['--version'], { env, stdio: 'ignore' }).status === 0
const credentialArgs = hasGh ? ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential'] : []
function run(command, args, cwd = root, allowed = [0]) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8' })
  if (!allowed.includes(result.status)) throw new Error(result.stderr || result.error?.message || `${command} failed`)
  return result
}
function git(args, cwd, allowed) { return run('git', [...credentialArgs, ...args], cwd, allowed) }
let staging
try {
  console.log('Building FishTank…')
  const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: root, env, stdio: 'inherit' })
  if (build.status !== 0) throw new Error('Build failed; nothing was published.')
  staging = mkdtempSync(join(tmpdir(), 'fishtank-pages-'))
  git(['init', '--initial-branch=gh-pages'], staging)
  git(['remote', 'add', 'origin', repository], staging)
  const existing = git(['ls-remote', '--exit-code', '--heads', 'origin', 'gh-pages'], staging, [0, 2])
  if (existing.status === 0) {
    git(['fetch', '--depth=1', 'origin', 'gh-pages'], staging)
    git(['checkout', '-B', 'gh-pages', 'FETCH_HEAD'], staging)
    git(['rm', '-r', '--ignore-unmatch', '.'], staging)
  }
  cpSync(join(root, 'dist'), staging, { recursive: true })
  writeFileSync(join(staging, '.nojekyll'), '')
  git(['add', '--all'], staging)
  const diff = git(['diff', '--cached', '--quiet'], staging, [0, 1])
  if (diff.status === 0) {
    console.log('The published build is already up to date.')
  } else {
    const revision = run('git', ['rev-parse', '--short', 'HEAD']).stdout.trim()
    git(['-c', 'user.name=FishTank Pages', '-c', 'user.email=pages@users.noreply.github.com', 'commit', '-m', `Deploy FishTank from ${revision}`], staging)
    git(['push', 'origin', 'HEAD:gh-pages'], staging)
    console.log('Published build pushed. GitHub Pages will finish deployment shortly.')
  }
  console.log('https://kuma0595.github.io/FishTank/')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  if (staging) rmSync(staging, { recursive: true, force: true })
}
