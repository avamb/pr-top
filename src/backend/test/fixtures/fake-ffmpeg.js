'use strict';
// Stand-in for ffmpeg in test/ffmpeg-sandbox.test.js (no real ffmpeg needed).
// Behaviour is chosen by a marker in the INPUT file's base name or in its
// first 64 bytes (the real pipeline names its temp files dec-<uuid>.ext):
//   hang       never exits (the wrapper must kill it on timeout)
//   fail       prints an ffmpeg-like error to stderr, exits 1
//   slow       sleeps 300 ms, then behaves like the default
//   dumpenv    writes {env, argv} as JSON to the output path
//   -<N>k      (name only) writes N KiB of valid MPEG-2 Layer III frames
//   default    writes frames totalling half the input size (min 100 KiB),
//              i.e. a "transcode" that roughly halves the file
// `-version` prints a version line and exits 0.
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
if (argv.includes('-version')) {
  process.stdout.write('ffmpeg version fake-for-tests\n');
  process.exit(0);
}
const input = argv[argv.indexOf('-i') + 1] || '';
const output = argv[argv.length - 1];
let head = '';
try {
  const fd = fs.openSync(input, 'r');
  const b = Buffer.alloc(64);
  const n = fs.readSync(fd, b, 0, 64, 0);
  fs.closeSync(fd);
  head = b.subarray(0, n).toString('latin1');
} catch (_) { /* missing input: default behaviour */ }
const base = path.basename(input) + ' ' + head;
let inputSize = 0;
try { inputSize = fs.statSync(input).size; } catch (_) { /* none */ }

function writeFrames(kib) {
  // MPEG-2 Layer III, 32 kbit/s, 16 kHz, mono: header FF F3 48 C4, 144-byte frames
  const frame = Buffer.alloc(144, 0x55);
  Buffer.from([0xff, 0xf3, 0x48, 0xc4]).copy(frame, 0);
  const n = Math.ceil((kib * 1024) / 144);
  const fd = fs.openSync(output, 'w');
  for (let i = 0; i < n; i++) fs.writeSync(fd, frame);
  fs.closeSync(fd);
}

function main() {
  if (base.includes('hang')) {
    setInterval(() => {}, 1000);
    return;
  }
  if (base.includes('fail')) {
    process.stderr.write(`${input}: Invalid data found when processing input\n`);
    process.exit(1);
  }
  if (base.includes('dumpenv')) {
    fs.writeFileSync(output, JSON.stringify({ env: process.env, argv }));
    process.exit(0);
  }
  const m = /-(\d+)k/.exec(path.basename(input));
  writeFrames(m ? parseInt(m[1], 10) : Math.max(100, Math.round(inputSize / 2 / 1024)));
  process.exit(0);
}

if (base.includes('slow')) setTimeout(main, 300);
else main();
