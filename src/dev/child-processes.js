'use strict';
const { spawn } = require('node:child_process');
function signalTree(child, signal) {
  if (!child || !child.pid) return;
  try {
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', ...(signal === 'SIGKILL' ? ['/F'] : [])], { stdio: 'ignore', windowsHide: true });
      killer.on('error', () => { try { child.kill(signal); } catch (_) { /* Already exited. */ } }); killer.unref();
    } else process.kill(-child.pid, signal);
  } catch (error) { if (error.code !== 'ESRCH') throw error; }
}
class ChildProcesses {
  constructor() { this.children = new Set(); }
  spawn(command, args, options = {}) {
    // Windows npm/npx shims only receive fixed arguments / validated script names.
    const shell = process.platform === 'win32' && /^(npm|npx)\.cmd$/i.test(command);
    const child = spawn(command, args, { ...options, shell, detached: process.platform !== 'win32' });
    this.children.add(child); child.once('close', () => this.children.delete(child)); return child;
  }
  run(command, args, root) {
    return new Promise(resolve => {
      const child = this.spawn(command, args, { cwd: root, stdio: 'inherit' });
      child.once('error', () => resolve({ code: null, failed: true }));
      child.once('close', (code, signal) => resolve({ code, signal, failed: code !== 0 }));
    });
  }
  async stop() {
    const children = [...this.children]; for (const child of children) signalTree(child, 'SIGTERM');
    await Promise.all(children.map(child => new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode) return resolve();
      const timeout = setTimeout(resolve, 1000); child.once('close', () => { clearTimeout(timeout); resolve(); });
    })));
    // Shells can exit before descendants; address the original group/tree as well.
    for (const child of children) signalTree(child, 'SIGKILL');
  }
}
module.exports = { ChildProcesses };
