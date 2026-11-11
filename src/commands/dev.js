'use strict';
const { DevLifecycle } = require('../dev/lifecycle');
exports.run = async (options = {}) => {
  const lifecycle = new DevLifecycle(options);
  const stop = () => lifecycle.stop().catch(error => { console.error(error.message); process.exitCode = 1; });
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try { await lifecycle.start(); }
  catch (error) { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); throw error; }
  return lifecycle;
};
