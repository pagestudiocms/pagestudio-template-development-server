/*!
  *
  * A simple test runner for Node.js that supports async tests and prints colored output.
  * 
  */
// Small colored logger and simple TestRunner to produce JUnit-like output.
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorize(text, color) {
  const code = COLORS[color] || '';
  return code + text + COLORS.reset;
}

function logColored(message, color = 'white', newline = true) {
  if (newline) process.stdout.write(colorize(message, color) + '\n');
  else process.stdout.write(colorize(message, color));
}

class TestRunner {
  constructor() {
    this.tests = [];
    this.failures = 0;
    this.errors = 0;
    this.startTime = null;
  }

  add(name, fn) { this.tests.push({ name, fn }); }

  async run() {
    this.startTime = Date.now();
    logColored('Running tests...', 'blue');
    
    for (const t of this.tests) {
      const start = Date.now();
      // process.stdout.write('\n'); // Print newline 
      try {
        await Promise.resolve(t.fn());
        const timeMs = Date.now() - start;
        // Print a single-line result similar to JUnit per-test line
        logColored(`${t.name} ... ${colorize('OK', 'green')} (${timeMs} ms)`, 'white');
      } catch (err) {
        this.failures += 1;
        const timeMs = Date.now() - start;
        logColored(`${t.name} ... ${colorize('FAILED', 'red')} (${timeMs} ms)`, 'white');
        // Print stack trace in red
        logColored(err.stack || String(err), 'red');
      }
    }

    this._printSummary();
    if (this.failures > 0) process.exitCode = 1;
  }

  _printSummary() {
    const total = this.tests.length;
    const elapsed = (Date.now() - this.startTime) / 1000;
    logColored('', 'white');
    if (this.failures === 0) {
      logColored(`Tests run: ${total}, Failures: 0, Time elapsed: ${elapsed.toFixed(3)} s`, 'green');
    } else {
      logColored(`Tests run: ${total}, Failures: ${this.failures}, Time elapsed: ${elapsed.toFixed(3)} s`, 'red');
    }
  }
}

module.exports = { TestRunner };