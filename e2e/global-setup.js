// Runs once before the e2e tests.
//
// Behind a TLS-inspecting HTTPS proxy (Claude Code cloud sessions, some office
// networks) Chromium must trust the proxy's certificate, or every Firebase call from
// the test browser fails with "Network error". Chromium on Linux reads trust from the
// NSS store in ~/.pki/nssdb, which a fresh session may not have set up. This adds the
// proxy CA there, once, keeping certificate checks ON. It only touches the test
// machine: the live site and real phones are not affected.
//
// It does nothing when there is no proxy or no CA file (a normal laptop). With a proxy
// and a CA but no certutil it stops the run, so a missing tool never shows up as
// "Network error" in the tests.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CA_CANDIDATES = [process.env.E2E_PROXY_CA, '/root/.ccr/agent-proxy-ca.crt', '/root/.ccr/ca-bundle.crt'];
const NICKNAME = 'e2e-https-proxy';

function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

export default function globalSetup() {
  if (!(process.env.HTTPS_PROXY || process.env.https_proxy)) return;
  const ca = CA_CANDIDATES.find((p) => p && existsSync(p));
  if (!ca) return;
  try { run('certutil', ['-H']); } catch (e) {
    if (e.code === 'ENOENT') {
      throw new Error(`Install libnss3-tools so Chromium can trust the proxy CA (certutil not found; needed to add ${ca} to ~/.pki/nssdb).`);
    }
  }

  const dir = join(homedir(), '.pki', 'nssdb');
  const db = `sql:${dir}`;
  if (!existsSync(join(dir, 'cert9.db'))) {
    mkdirSync(dir, { recursive: true });
    run('certutil', ['-d', db, '-N', '--empty-password']);
  }
  const listed = run('certutil', ['-d', db, '-L']);
  if (/ccr-agent-proxy|e2e-https-proxy/.test(listed)) return; // already trusted
  run('certutil', ['-d', db, '-A', '-t', 'C,,', '-n', NICKNAME, '-i', ca]);
  console.log(`[e2e] Chromium now trusts the HTTPS proxy CA (${ca}).`);
}
