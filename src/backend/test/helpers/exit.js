'use strict';
// Require this from plain node:test files (those that do not use
// helpers/checks.js): once the last test of the file has finished, the process
// exits itself, because the code under test leaves timers/handles behind and
// `--test-force-exit` can drop the final TAP lines. A failing test still gives
// a non-zero exit code (node:test sets process.exitCode when a test fails).
const { after } = require('node:test');

after(() => {
  setTimeout(() => process.exit(process.exitCode || 0), 300).unref();
});
