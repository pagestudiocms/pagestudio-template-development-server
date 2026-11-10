'use strict';
const fs = require('node:fs');
const path = require('node:path');
const chokidar = require('chokidar');
const { createBuildStatus, HEARTBEAT_MS } = require('./build-status');
const { resolveDevConfig } = require('./config');
const { ChildProcesses } = require('./child-processes');
const CLI = path.resolve(__dirname, '../../bin/pagestudio.js');
const under = (file, root) => file === root || file.startsWith(root + path.sep);
class DevLifecycle {
  constructor(options = {}, dependencies = {}) {
    this.options = options; this.root = fs.realpathSync(dependencies.root || process.cwd());
    this.children = dependencies.children || new ChildProcesses(); this.watch = dependencies.watch || chokidar.watch;
    this.pending = new Set(); this.needs = { assets: false, html: false }; this.removedLayouts = new Set();
    this.failures = {}; this.success = { assets: false, html: false }; this.running = false; this.stopped = false; this.preview = null;
  }
  publish(patch = {}) {
    if (this.stopped) return;
    this.status.update({ pendingChanges: { count: this.pending.size, files: [...this.pending].sort().slice(0, 100).map(file => file.slice(0, 512)) },
      failure: Object.values(this.failures)[0] || null, ...patch });
  }
  failure(phase, code = null) {
    this.failures[phase] = { phase, code, message: `${phase} phase failed; see terminal.` };
    console.error(`PageStudio ${phase} failed${code === null ? '' : ` (exit ${code})`}.`); this.publish({ state: 'failed', phase });
  }
  async start() {
    this.status = createBuildStatus(this.root);
    try {
      this.config = resolveDevConfig(this.options, this.root); this.success.assets = !this.config.assetBuild;
      this.publish({ assetBuild: this.config.assetBuild ? this.config.assetBuild.label : 'none (HTML-only readiness)' });
      console.log(`PageStudio dev: ${this.config.assetBuild ? this.config.assetBuild.label : 'no asset build configured; HTML only'}`);
      this.heartbeat = setInterval(() => { try { this.publish(); } catch (error) { this.fatal('status', error); } }, HEARTBEAT_MS);
      const watchPaths = [...this.config.htmlWatch, ...this.config.buildWatch, ...(this.config.assetBuild ? this.config.assetWatch : [])];
      this.watcher = this.watch(watchPaths, { ignoreInitial: true, persistent: true, followSymlinks: false,
        ignored: file => /(^|[\\/])(?:node_modules|\.git|\.pagestudio)(?:[\\/]|$)/.test(file) || under(path.resolve(file), this.config.out) });
      this.watcher.on('all', (event, filename) => {
        if (!['add', 'change', 'unlink', 'addDir', 'unlinkDir'].includes(event)) return;
        const file = path.resolve(filename);
        if (this.config.buildWatch.includes(file)) {
          // Reload commands/watch topology explicitly rather than executing stale configuration.
          this.pending.add(path.relative(this.root, file)); this.restartRequired = true;
          this.failure('startup'); this.publish({ state: 'failed', phase: 'startup', generation: this.status.record.generation + 1 });
          console.error('Build configuration changed. Restart npm run start to reload commands and watch paths.'); return;
        }
        const assets = this.config.assetBuild && this.config.assetWatch.some(root => under(file, root));
        const html = this.config.htmlWatch.some(root => under(file, root));
        if (event === 'unlink' && under(file, this.config.layouts) && file.endsWith('.html')) this.removedLayouts.add(file);
        if (assets || html) this.request(path.relative(this.root, file), { assets, html });
      });
      this.watcher.on('error', error => this.fatal('watcher', error));
      await new Promise((resolve, reject) => { this.readyResolve = resolve; this.watcher.once('ready', resolve); this.watcher.once('error', reject); });
      if (this.stopped) return this;
      this.request('(startup)', { assets: Boolean(this.config.assetBuild), html: true }); await this.drain(); return this;
    } catch (error) {
      if (this.stopped) return this;
      this.failure('startup'); await this.stop(); throw error;
    }
  }
  request(file, needs) {
    if (this.stopped || this.restartRequired) return;
    this.pending.add(file); this.needs.assets ||= Boolean(needs.assets || this.failures.assets); this.needs.html ||= Boolean(needs.html || this.failures.html);
    this.lastChange = Date.now(); this.publish({ generation: this.status.record.generation + 1, state: this.running ? 'building' : 'idle' });
    clearTimeout(this.timer); this.timer = setTimeout(() => this.drain().catch(error => this.fatal('status', error)), this.config.debounceMs);
  }
  async build(phase, command, args) {
    this.publish({ state: 'building', phase }); console.log(`PageStudio ${phase} build (generation ${this.activeGeneration})`);
    const result = await this.children.run(command, args, this.root);
    if (this.stopped) return;
    if (result.failed) { this.success[phase] = false; this.failure(phase, result.code); }
    else { this.success[phase] = true; delete this.failures[phase]; }
  }
  async startPreview() {
    if (this.preview || this.stopped) return;
    fs.mkdirSync(this.config.out, { recursive: true }); this.publish({ preview: { state: 'starting' }, phase: 'preview' });
    this.preview = this.children.spawn(process.execPath, [CLI, 'server', '--root', this.config.out, '--watch', this.config.out,
      '--host', this.config.host, '--port', String(this.config.port), '--open', this.config.open], {
      cwd: this.root, env: { ...process.env, PAGESTUDIO_DEV_CHILD: '1' }, stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
    await new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => done(new Error('Preview startup timed out')), 15000);
      const done = error => { if (settled) return; settled = true; clearTimeout(timeout); error ? reject(error) : resolve(); };
      this.preview.on('message', message => {
        if (message && message.type === 'pagestudio:preview-ready') { this.publish({ preview: { state: 'listening', port: message.port, host: this.config.host } }); done(); }
        else if (message && message.type === 'pagestudio:preview-error') { done(new Error('Preview failed')); this.fatal('preview'); }
      });
      this.preview.once('error', error => { done(error); this.fatal('preview', error); });
      this.preview.once('close', () => { done(new Error('Preview exited')); if (!this.stopped) this.fatal('preview'); });
    });
  }
  async drain() {
    if (this.running || this.stopped || this.restartRequired || !this.pending.size) return;
    this.running = true; clearTimeout(this.timer);
    try {
      while (!this.stopped && !this.restartRequired && this.pending.size) {
        const delay = this.config.debounceMs - (Date.now() - this.lastChange);
        if (delay > 0) await new Promise(resolve => { this.quietResolve = resolve; this.quietTimer = setTimeout(resolve, delay); });
        if (this.stopped || this.restartRequired) break;
        if (Date.now() - this.lastChange < this.config.debounceMs) continue;
        const needs = this.needs; this.needs = { assets: false, html: false }; this.pending.clear();
        this.activeGeneration = this.status.record.generation; this.publish({ state: 'building', activeGeneration: this.activeGeneration });
        if (needs.assets && this.config.assetBuild) await this.build('assets', this.config.assetBuild.command, this.config.assetBuild.args);
        if (needs.html && !this.stopped) {
          for (const file of this.removedLayouts) {
            const output = path.resolve(this.config.out, path.relative(this.config.layouts, file)); if (under(output, this.config.out)) fs.rmSync(output, { force: true });
          }
          this.removedLayouts.clear();
          const args = [CLI, 'compile', '--src', this.config.src, '--out', this.config.out, '--layouts', this.config.layouts, '--partials', this.config.partials, '--data-src', this.config.dataSrc];
          if (fs.existsSync(this.config.configFile)) args.push('--config', this.config.configFile);
          await this.build('html', process.execPath, args);
        }
        if (!this.stopped) await this.startPreview();
        if (this.stopped) break;
        if (this.restartRequired) { this.publish({ state: 'failed', activeGeneration: null, phase: 'startup' }); break; }
        if (!this.pending.size && this.success.assets && this.success.html && !Object.keys(this.failures).length) {
          this.publish({ state: 'ready', phase: null, activeGeneration: null, lastSuccessfulBuild: { generation: this.activeGeneration, completedAt: new Date().toISOString() } });
          console.log(`PageStudio ready (generation ${this.activeGeneration}).`);
        } else this.publish({ state: this.pending.size ? 'building' : 'failed', activeGeneration: null });
      }
    } finally { this.running = false; }
  }
  fatal(phase, error) {
    if (this.stopped) return;
    if (error) console.error(error.message);
    try { this.failure(phase); } catch (_) { /* Status itself may be unavailable. */ }
    process.exitCode = 1; this.stop().catch(stopError => console.error(stopError.message));
  }
  async stop() {
    if (this.stopped) return this.stopping;
    this.stopped = true; clearInterval(this.heartbeat); clearTimeout(this.timer); clearTimeout(this.quietTimer);
    if (this.readyResolve) this.readyResolve(); if (this.quietResolve) this.quietResolve();
    // Invalidate readiness before waiting for any child/watcher teardown. Keep ownership until teardown finishes.
    if (this.status) {
      try { this.status.update({ state: 'idle', phase: 'shutdown', preview: { state: 'stopped' }, activeGeneration: null }); }
      catch (error) { console.error(error.message); }
    }
    this.stopping = (async () => {
      try { await Promise.all([this.watcher ? this.watcher.close() : Promise.resolve(), this.children.stop()]); }
      finally { if (this.status) this.status.close(); }
    })(); return this.stopping;
  }
}
module.exports = { DevLifecycle };
