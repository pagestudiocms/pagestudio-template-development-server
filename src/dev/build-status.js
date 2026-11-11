'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const HEARTBEAT_MS = 1000;
const STALE_MS = 10000;
const STATES = new Set(['idle', 'building', 'ready', 'failed']);
const PHASES = new Set(['startup', 'assets', 'html', 'preview', 'watcher', 'status', 'shutdown']);
function processIdentity(pid) {
  try { return fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ').pop().split(' ')[19]; }
  catch (_) { return null; }
}
function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    try { if (fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ').pop().startsWith('Z ')) return false; } catch (_) { /* No proc filesystem. */ }
    return true;
  } catch (error) { return error.code === 'EPERM'; }
}
function paths(root) {
  const base = fs.realpathSync(root), directory = path.join(base, '.pagestudio');
  if (fs.existsSync(directory) && fs.realpathSync(directory) !== directory) throw new Error('Status directory must not be a symlink');
  return { base, directory, status: path.join(directory, 'build-status.json'), lock: path.join(directory, 'dev.lock') };
}
function readJson(filename) {
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) throw new Error('Invalid status record');
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}
function validOwner(owner, base, now) {
  return owner && owner.projectRoot === base && typeof owner.sessionId === 'string' && alive(owner.pid) &&
    (!owner.processIdentity || owner.processIdentity === processIdentity(owner.pid)) &&
    Number.isFinite(Date.parse(owner.heartbeatAt)) && now - Date.parse(owner.heartbeatAt) >= -2000 && now - Date.parse(owner.heartbeatAt) <= STALE_MS;
}
function safeFailure(failure) {
  if (!failure || !PHASES.has(failure.phase)) return null;
  return { phase: failure.phase, code: Number.isInteger(failure.code) ? failure.code : null,
    message: `${failure.phase} phase failed; see the development terminal for details.` };
}
function getBuildStatus(root = process.env.PAGESTUDIO_PROJECT_ROOT || process.cwd(), now = Date.now()) {
  const unavailable = (reason, record) => ({ schemaVersion: '1.0', available: false, ready: false, state: 'unavailable', reason,
    lastFailure: safeFailure(record && record.failure) });
  let files, record, owner;
  try { files = paths(root); record = readJson(files.status); }
  catch (error) { return unavailable(error.code === 'ENOENT' ? 'missing' : 'invalid'); }
  try { owner = readJson(files.lock); } catch (_) { return unavailable('stopped', record); }
  if (!record || !owner || typeof record !== 'object' || typeof owner !== 'object') return unavailable('invalid');
  if (record.schemaVersion !== '1.0' || record.projectRoot !== files.base || !STATES.has(record.state) ||
      !Number.isSafeInteger(record.generation) || record.generation < 0 || !record.pendingChanges ||
      !Number.isInteger(record.pendingChanges.count) || record.pendingChanges.count < 0) return unavailable('invalid', record);
  if (owner.sessionId !== record.sessionId || owner.pid !== record.pid) return unavailable('owner-mismatch', record);
  if (owner.generation !== record.generation || owner.state !== record.state || owner.activeGeneration !== record.activeGeneration ||
      !owner.pendingChanges || owner.pendingChanges.count !== record.pendingChanges.count) return unavailable('updating', record);
  if (!alive(record.pid) || (record.processIdentity && record.processIdentity !== processIdentity(record.pid))) return unavailable('process-not-running', record);
  if (!validOwner(record, files.base, now) || !validOwner(owner, files.base, now)) return unavailable('stale', record);
  const ready = record.state === 'ready' && record.pendingChanges.count === 0 && record.activeGeneration === null &&
    record.lastSuccessfulBuild && record.lastSuccessfulBuild.generation === record.generation &&
    record.preview && record.preview.state === 'listening' && !record.failure;
  if (record.state === 'ready' && !ready) return unavailable('invalid-ready-record', record);
  return { schemaVersion: '1.0', available: true, ready: Boolean(ready), state: record.state, projectRoot: files.base,
    sessionId: record.sessionId, pid: record.pid, startedAt: record.startedAt, heartbeatAt: record.heartbeatAt,
    generation: record.generation, activeGeneration: record.activeGeneration,
    pendingChanges: { count: record.pendingChanges.count, files: (Array.isArray(record.pendingChanges.files) ? record.pendingChanges.files : []).filter(file => typeof file === 'string').slice(0, 100) },
    phase: PHASES.has(record.phase) ? record.phase : null, lastSuccessfulBuild: record.lastSuccessfulBuild,
    failure: safeFailure(record.failure), preview: record.preview, assetBuild: record.assetBuild,
    limitations: ['Readiness covers observed watched inputs and successful command exits, not visual correctness.',
      'Check sessionId and generation again after validation; source files are not locked.',
      'Heartbeat freshness is bounded to 10 seconds; process start identity is additionally checked where /proc is available.'] };
}
function createBuildStatus(root) {
  const files = paths(root); fs.mkdirSync(files.directory, { recursive: true });
  const sessionId = randomUUID(), startedAt = new Date().toISOString();
  const record = { schemaVersion: '1.0', projectRoot: files.base, sessionId, pid: process.pid,
    processIdentity: processIdentity(process.pid), startedAt, heartbeatAt: startedAt, state: 'idle', phase: 'startup',
    generation: 0, activeGeneration: null, pendingChanges: { count: 0, files: [] }, lastSuccessfulBuild: null,
    failure: null, preview: { state: 'stopped' }, assetBuild: null };
  let lock;
  try { lock = fs.openSync(files.lock, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const recoveryFile = files.lock + '.recovery'; let recovery;
    try { recovery = fs.openSync(recoveryFile, 'wx', 0o600); }
    catch (_) { throw new Error('Another dev process is reclaiming this project; retry after it starts (inspect a leftover dev.lock.recovery only after dev stops)'); }
    try {
      let existing;
      try { existing = readJson(files.lock); } catch (_) { throw new Error('Invalid dev owner lock; inspect and remove it only after the old dev process stops'); }
      if (!existing || !Number.isSafeInteger(existing.pid) || existing.pid <= 0 || typeof existing.sessionId !== 'string') throw new Error('Invalid dev owner lock');
      if (alive(existing.pid) && (!existing.processIdentity || existing.processIdentity === processIdentity(existing.pid))) throw new Error('Another dev process already owns this project');
      fs.unlinkSync(files.lock); lock = fs.openSync(files.lock, 'wx', 0o600);
    } finally { fs.closeSync(recovery); fs.unlinkSync(recoveryFile); }
  }
  fs.writeFileSync(lock, JSON.stringify(record)); fs.closeSync(lock);
  let closed = false;
  function atomic(filename, value) {
    const temporary = `${filename}.${sessionId}.tmp`;
    try { fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); fs.renameSync(temporary, filename); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  function update(patch = {}) {
    if (closed) return;
    if (readJson(files.lock).sessionId !== sessionId) throw new Error('Dev status ownership was lost');
    Object.assign(record, patch, { heartbeatAt: new Date().toISOString() });
    atomic(files.lock, record); atomic(files.status, record);
  }
  update();
  return { record, update, close() {
    if (closed) return;
    try { update({ state: 'idle', phase: 'shutdown', preview: { state: 'stopped' }, activeGeneration: null }); }
    finally { closed = true; try { if (readJson(files.lock).sessionId === sessionId) fs.unlinkSync(files.lock); } catch (_) { /* Ownership lost. */ } }
  } };
}
module.exports = { createBuildStatus, getBuildStatus, HEARTBEAT_MS, STALE_MS };
