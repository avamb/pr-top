'use strict';
// Track M (wave 3) — services/fileCrypto.js unit tests.
// Self-contained: dummy env, temp DB + temp dir, never reads the repo .env.
// Set RUN_SLOW_TESTS=1 for the full 100 MB memory test (default run: 40 MB).
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { test, before, after } = require('node:test');
const { Readable, Writable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const BACKEND = path.resolve(__dirname, '..');
const SLOW = process.env.RUN_SLOW_TESTS === '1';

const SRC = path.join(BACKEND, 'src');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prtop-trackM-fc-'));
Object.assign(process.env, {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-xxxxxxxxxxxx',
  ENCRYPTION_MASTER_KEY: 'test-master-xxxxxxxxxxxx',
  DATABASE_URL: 'sqlite:' + path.join(tmp, 'test.db').split(path.sep).join('/'),
  BACKUP_DIR: path.join(tmp, 'backups'),
  LOG_LEVEL: 'error',
  MEDIA_TMP_DIR: path.join(tmp, 'media-tmp'),
});
// plaintext leftovers from a "crash" before startup: must be purged at startup
fs.mkdirSync(path.join(tmp, 'media-tmp'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'media-tmp', 'dec-11111111-2222-3333-4444-555555555555.mp3'), 'plaintext');
fs.writeFileSync(path.join(tmp, 'media-tmp', 'split-11111111-2222-3333-4444-555555555555.mp3'), 'plaintext');
fs.writeFileSync(path.join(tmp, 'media-tmp', 'keep.txt'), 'not ours');
process.chdir(tmp);

let fc, enc, conn;
before(async () => {
  conn = require(path.join(SRC, 'db/connection.js'));
  await conn.initDatabase();
  enc = require(path.join(SRC, 'services/encryption.js'));
  fc = require(path.join(SRC, 'services/fileCrypto.js'));
});
after(() => { setTimeout(() => process.exit(process.exitCode || 0), 300).unref(); process.chdir(os.tmpdir()); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* windows: db handle */ } });

const CS = 64 * 1024;
const f = (name) => path.join(tmp, name);

async function readAll(stream) {
  const parts = [];
  for await (const c of stream) parts.push(c);
  return Buffer.concat(parts);
}

async function decryptRange(p, start, end) {
  const r = await fc.openForRead(p);
  return readAll(r.stream(start, end));
}

// Legacy writer = exactly the pre-wave-3 code path.
function writeLegacy(p, buf) {
  const { encrypted } = enc.encrypt(buf.toString('base64'));
  fs.writeFileSync(p, encrypted);
}

test('round trip, random sizes (stream + sync writers)', async () => {
  for (const size of [0, 1, CS - 1, CS, CS + 1, 2 * CS, 5 * 1024 * 1024 + 7]) {
    const data = crypto.randomBytes(size);
    const a = f(`rt-${size}-a.enc`);
    const b = f(`rt-${size}-b.enc`);
    // stream writer fed in odd-sized pieces
    const pieces = [];
    for (let o = 0; o < size; o += 10007) pieces.push(data.subarray(o, Math.min(o + 10007, size)));
    const ia = await fc.encryptStreamToFile(Readable.from(pieces), a, { contentType: 'audio/mpeg' });
    const ib = fc.encryptBufferToFileSync(data, b, { contentType: 'audio/ogg' });
    assert.strictEqual(ia.plaintextSize, size);
    assert.strictEqual(ib.plaintextSize, size);
    for (const p of [a, b]) {
      const r = await fc.openForRead(p);
      assert.strictEqual(r.size, size, `size ${size}`);
      const out = await readAll(r.stream());
      assert.ok(out.equals(data), `round trip ${size} ${p}`);
    }
    const info = await fc.readFileInfo(a);
    assert.strictEqual(info.format, 'v1');
    assert.strictEqual(info.contentType, 'audio/mpeg');
    assert.strictEqual(info.keyVersion, enc.getActiveKeyVersion());
    assert.ok(!fs.existsSync(a + '.part'));
  }
});

test('one huge input buffer is not quadratic', async () => {
  const data = crypto.randomBytes(20 * 1024 * 1024);
  const t0 = Date.now();
  await fc.encryptStreamToFile(Readable.from([data]), f('big1.enc'), { contentType: 'audio/mpeg' });
  const ms = Date.now() - t0;
  assert.ok(ms < 5000, `20MB single-buffer encrypt took ${ms}ms`);
  assert.ok((await decryptRange(f('big1.enc'), 0, data.length - 1)).equals(data));
});

test('range reads at chunk boundaries', async () => {
  const data = crypto.randomBytes(3 * CS + 123);
  const p = f('ranges.enc');
  fc.encryptBufferToFileSync(data, p, { contentType: 'audio/mpeg' });
  const cases = [
    [0, 0], [0, CS - 1], [CS - 1, CS], [CS, CS], [CS - 1, 2 * CS], [CS + 5, 3 * CS + 122],
    [3 * CS, 3 * CS + 122], [3 * CS + 122, 3 * CS + 122], [100, 100 + 2 * CS],
  ];
  for (const [s, e] of cases) {
    const out = await decryptRange(p, s, e);
    assert.ok(out.equals(data.subarray(s, e + 1)), `range ${s}-${e}`);
  }
});

test('parseRange', () => {
  const pr = fc.parseRange;
  assert.deepStrictEqual(pr('bytes=0-', 10), { start: 0, end: 9 });
  assert.deepStrictEqual(pr('bytes=2-5', 10), { start: 2, end: 5 });
  assert.deepStrictEqual(pr('bytes=2-50', 10), { start: 2, end: 9 });
  assert.deepStrictEqual(pr('bytes=-3', 10), { start: 7, end: 9 });
  assert.deepStrictEqual(pr('bytes=-30', 10), { start: 0, end: 9 });
  assert.strictEqual(pr('bytes=10-', 10), 'unsatisfiable');
  assert.strictEqual(pr('bytes=0-', 0), 'unsatisfiable');
  assert.strictEqual(pr('bytes=-0', 10), 'unsatisfiable');
  assert.strictEqual(pr('bytes=5-2', 10), null);
  assert.strictEqual(pr('bytes=0-1,4-5', 10), null);
  assert.strictEqual(pr('items=0-1', 10), null);
  assert.strictEqual(pr(undefined, 10), null);
});

async function expectOpenFails(p, code) {
  await assert.rejects(async () => {
    const r = await fc.openForRead(p);
    await readAll(r.stream());
  }, (e) => (code ? e.code === code : true), `expected failure ${code} for ${path.basename(p)}`);
}

test('tamper detection: ciphertext, tag, header (mime / key version)', async () => {
  const data = crypto.randomBytes(2 * CS + 10);
  const base = f('tamper-base.enc');
  fc.encryptBufferToFileSync(data, base, { contentType: 'audio/mpeg' });
  const orig = fs.readFileSync(base);
  const headerLen = 46 + 'audio/mpeg'.length;

  // flip a byte in chunk 0 ciphertext -> reading chunk 0 fails
  let b = Buffer.from(orig); b[headerLen + 10] ^= 1;
  fs.writeFileSync(f('t1.enc'), b);
  await expectOpenFails(f('t1.enc'), 'DECRYPT_FAILED');
  // middle chunk tamper: a range that avoids it still works, a range over it fails
  b = Buffer.from(orig); b[headerLen + (CS + 16) + 5] ^= 1;
  fs.writeFileSync(f('t2.enc'), b);
  assert.ok((await decryptRange(f('t2.enc'), 0, 100)).equals(data.subarray(0, 101)));
  await assert.rejects(() => decryptRange(f('t2.enc'), CS, CS + 10), (e) => e.code === 'DECRYPT_FAILED');
  // last-chunk tamper -> open fails (final chunk is verified on open)
  b = Buffer.from(orig); b[b.length - 1] ^= 1;
  fs.writeFileSync(f('t3.enc'), b);
  await assert.rejects(() => fc.openForRead(f('t3.enc')), (e) => e.code === 'DECRYPT_FAILED');
  // header: change the stored mime (same length) -> AAD mismatch
  b = Buffer.from(orig); b.write('audio/mpegX'.slice(0, 10).replace('mpeg', 'mpga'), 46, 'latin1');
  fs.writeFileSync(f('t4.enc'), b);
  await assert.rejects(() => fc.openForRead(f('t4.enc')), (e) => e.code === 'DECRYPT_FAILED');
  // header: swap the salt -> different key -> fails
  b = Buffer.from(orig); b[20] ^= 0xff;
  fs.writeFileSync(f('t5.enc'), b);
  await assert.rejects(() => fc.openForRead(f('t5.enc')), (e) => e.code === 'DECRYPT_FAILED');
});

test('truncation detection', async () => {
  const data = crypto.randomBytes(3 * CS + 500);
  const base = f('trunc-base.enc');
  fc.encryptBufferToFileSync(data, base, { contentType: 'audio/mpeg' });
  const orig = fs.readFileSync(base);
  const headerLen = 46 + 'audio/mpeg'.length;
  // cut exactly at a chunk boundary (drop the final chunk)
  fs.writeFileSync(f('tr1.enc'), orig.subarray(0, headerLen + 3 * (CS + 16)));
  await assert.rejects(() => fc.openForRead(f('tr1.enc')), (e) => e.code === 'DECRYPT_FAILED');
  // cut mid-chunk
  fs.writeFileSync(f('tr2.enc'), orig.subarray(0, orig.length - 100));
  await assert.rejects(() => fc.openForRead(f('tr2.enc')), (e) => ['DECRYPT_FAILED', 'CORRUPT'].includes(e.code));
  // cut inside the header / to nothing past header
  fs.writeFileSync(f('tr3.enc'), orig.subarray(0, headerLen + 5));
  await assert.rejects(() => fc.openForRead(f('tr3.enc')), (e) => e.code === 'CORRUPT');
  // append garbage
  fs.writeFileSync(f('tr4.enc'), Buffer.concat([orig, Buffer.alloc(16 + 1)]));
  await assert.rejects(() => fc.openForRead(f('tr4.enc')), (e) => ['DECRYPT_FAILED', 'CORRUPT'].includes(e.code));
});

test('legacy file: read + lazy upgrade in place, verified', async () => {
  const data = crypto.randomBytes(300 * 1024 + 3);
  // Make it look like an mp3 so the upgrade sniffs a content type.
  Buffer.from('ID3').copy(data, 0);
  const p = f('abc.mp3.enc');
  writeLegacy(p, data);
  let info = await fc.readFileInfo(p);
  assert.strictEqual(info.format, 'legacy');
  assert.strictEqual(info.keyVersion, enc.getActiveKeyVersion());
  const r = await fc.openForRead(p); // upgrades
  assert.strictEqual(r.format, 'v1');
  assert.strictEqual(r.contentType, 'audio/mpeg');
  const out = await readAll(r.stream(1000, 200000));
  assert.ok(out.equals(data.subarray(1000, 200001)));
  info = await fc.readFileInfo(p);
  assert.strictEqual(info.format, 'v1');
  assert.strictEqual(info.plaintextSize, data.length);
  assert.ok(!fs.existsSync(p + '.rewrite.part'));
  // second open is a no-op upgrade
  const again = await fc.upgradeLegacyFile(p);
  assert.strictEqual(again.changed, false);
});

test('legacy file: unknown content falls back to extension MIME; whitespace tolerated', async () => {
  const data = crypto.randomBytes(5000);
  const p = f('xyz.m4a.enc');
  const { encrypted } = enc.encrypt(data.toString('base64'));
  fs.writeFileSync(p, encrypted + '\n');
  const r = await fc.openForRead(p);
  assert.strictEqual(r.contentType, 'audio/mp4');
  assert.ok((await readAll(r.stream())).equals(data));
});

test('legacy file: tampered -> DECRYPT_FAILED, original left untouched', async () => {
  const data = crypto.randomBytes(100000);
  const p = f('bad.ogg.enc');
  writeLegacy(p, data);
  const s = fs.readFileSync(p, 'utf8');
  const idx = s.length - 50;
  const ch = s[idx] === 'A' ? 'B' : 'A';
  const tampered = s.slice(0, idx) + ch + s.slice(idx + 1);
  fs.writeFileSync(p, tampered);
  await assert.rejects(() => fc.openForRead(p), (e) => e.code === 'DECRYPT_FAILED');
  assert.strictEqual(fs.readFileSync(p, 'utf8'), tampered, 'legacy file kept');
  assert.ok(!fs.existsSync(p + '.rewrite.part'), 'no temp left');
});

test('legacy upgrade: concurrent opens share one upgrade', async () => {
  const data = crypto.randomBytes(400000);
  const p = f('conc.webm.enc');
  writeLegacy(p, data);
  const readers = await Promise.all([fc.openForRead(p), fc.openForRead(p), fc.openForRead(p)]);
  for (const r of readers) {
    assert.strictEqual(r.format, 'v1');
    assert.ok((await readAll(r.stream())).equals(data));
  }
});

test('legacy stream fallback when upgrade cannot write (read-only), memory-bounded path', async () => {
  const data = crypto.randomBytes(70000);
  const p = f('ro.wav.enc');
  writeLegacy(p, data);
  // simulate a write failure: a directory squatting on the temp path
  fs.mkdirSync(p + '.rewrite.part');
  fs.writeFileSync(path.join(p + '.rewrite.part', 'x'), 'x');
  const r = await fc.openForRead(p);
  assert.strictEqual(r.format, 'legacy');
  assert.strictEqual(r.rangeable, false);
  assert.ok((await readAll(r.stream())).equals(data));
  fs.rmSync(p + '.rewrite.part', { recursive: true, force: true });
});

test('decryptToTempFile: 0600, content, cleanup', async () => {
  const data = crypto.randomBytes(150000);
  Buffer.from('OggS').copy(data, 0);
  const p = f('tx.ogg.enc');
  fc.encryptBufferToFileSync(data, p, { contentType: 'audio/ogg' });
  const t = await fc.decryptToTempFile(p, { tmpDir: f('dec-tmp') });
  assert.ok(fs.readFileSync(t.path).equals(data));
  assert.strictEqual(t.ext, '.ogg');
  if (process.platform !== 'win32') {
    assert.strictEqual(fs.statSync(t.path).mode & 0o777, 0o600);
  }
  await t.cleanup();
  assert.ok(!fs.existsSync(t.path));
});

test('reencryptFile: v1 on old key version moves to active version', async () => {
  const data = crypto.randomBytes(200000);
  const p = f('rot.enc');
  const active = enc.getActiveKeyVersion();
  fc.encryptBufferToFileSync(data, p, { contentType: 'audio/mpeg' });
  // pretend this file is not on the active version by forcing a rewrite
  const res = await fc.reencryptFile(p, { force: true });
  assert.strictEqual(res.changed, true);
  assert.strictEqual(res.to.keyVersion, active);
  assert.ok((await decryptRange(p, 0, data.length - 1)).equals(data));
  const res2 = await fc.reencryptFile(p);
  assert.strictEqual(res2.changed, false);
});

test('SniffStream strict rejects non-media; sweep removes stale .part', async () => {
  const p = f('notmedia.enc');
  const sniff = new fc.SniffStream({ strict: true });
  await assert.rejects(
    () => fc.encryptStreamToFile(Readable.from([Buffer.from('<html><script>alert(1)</script></html>')]), p, { transforms: [sniff], contentType: () => 'x/y' }),
    (e) => e.code === 'UNSUPPORTED_MEDIA_TYPE'
  );
  assert.ok(!fs.existsSync(p) && !fs.existsSync(p + '.part'));
  const stale = f('old.enc.part');
  fs.writeFileSync(stale, 'x');
  const past = new Date(Date.now() - 2 * 3600 * 1000);
  fs.utimesSync(stale, past, past);
  const fresh = f('new.enc.part');
  fs.writeFileSync(fresh, 'x');
  await fc.sweepStaleFiles(tmp);
  assert.ok(!fs.existsSync(stale) && fs.existsSync(fresh));
});

test('housekeeping: startup purges all dec-/split- copies; media-dir .part > 1h; idempotent', async () => {
  const mediaDir = f('media-dir');
  fs.mkdirSync(mediaDir, { recursive: true });
  const oldPart = path.join(mediaDir, 'a.mp3.enc.rewrite.part');
  const newPart = path.join(mediaDir, 'b.mp3.enc.part');
  const staged = path.join(mediaDir, 'c.upload.enc');
  const real = path.join(mediaDir, 'd.mp3.enc');
  for (const p of [oldPart, newPart, staged, real]) fs.writeFileSync(p, 'x');
  const past = new Date(Date.now() - 3 * 3600 * 1000);
  for (const p of [oldPart, staged, real]) fs.utimesSync(p, past, past);
  const t1 = fc.startHousekeeping([mediaDir]);
  const t2 = fc.startHousekeeping([mediaDir]);
  assert.strictEqual(t1, t2, 'second call is a no-op');
  await new Promise((r) => setTimeout(r, 300));
  const left = fs.readdirSync(path.join(tmp, 'media-tmp'));
  assert.ok(!left.some((n) => /^(dec|split)-/.test(n)), 'plaintext copies purged regardless of age: ' + left);
  assert.ok(left.includes('keep.txt'));
  assert.ok(!fs.existsSync(oldPart) && !fs.existsSync(staged), 'old .part / staged upload removed');
  assert.ok(fs.existsSync(newPart), 'recent .part kept');
  assert.ok(fs.existsSync(real), 'finished media never touched');
});

test('reencryptFile contract: .part, unknown, missing, legacy and old key version; concurrent streaming', async () => {
  await assert.rejects(() => fc.reencryptFile(f('x.mp3.enc.part')), (e) => e.code === 'NOT_MEDIA_FILE');
  await assert.rejects(() => fc.reencryptFile(f('x.mp3.enc.rewrite.part')), (e) => e.code === 'NOT_MEDIA_FILE');
  fs.writeFileSync(f('junk.enc'), 'hello world, not encrypted');
  await assert.rejects(() => fc.reencryptFile(f('junk.enc')), (e) => e.code === 'UNKNOWN_FORMAT');
  fs.writeFileSync(f('empty.enc'), '');
  await assert.rejects(() => fc.reencryptFile(f('empty.enc')), (e) => e.code === 'UNKNOWN_FORMAT');
  await assert.rejects(() => fc.reencryptFile(f('missing.enc')), (e) => e.code === 'ENOENT');

  // Files under the current version, then rotate: active becomes v+1.
  const v1 = enc.getActiveKeyVersion();
  const dataA = crypto.randomBytes(3 * CS + 77);
  const dataL = crypto.randomBytes(2 * CS + 5);
  fc.encryptBufferToFileSync(dataA, f('old-v1.enc'), { contentType: 'audio/ogg' });
  writeLegacy(f('old-legacy.m4a.enc'), dataL);
  enc.rotateKey();
  const v2 = enc.getActiveKeyVersion();
  assert.strictEqual(v2, v1 + 1);
  assert.strictEqual((await fc.readFileInfo(f('old-v1.enc'))).keyVersion, v1);

  // Re-encrypt while a reader is mid-stream on the old file.
  const reader = await fc.openForRead(f('old-v1.enc'));
  const stream = reader.stream();
  const firstChunk = await new Promise((r) => stream.once('data', r));
  stream.pause();
  let res;
  try {
    res = await fc.reencryptFile(f('old-v1.enc'));
  } catch (e) {
    // Windows cannot rename over a file another handle has open; the old
    // file must then be intact and a retry after the reader closes works.
    assert.ok(process.platform === 'win32' && ['EPERM', 'EACCES', 'EBUSY'].includes(e.code), e.code + ' ' + e.message);
    res = null;
  }
  const rest = [firstChunk];
  stream.resume();
  for await (const c of stream) rest.push(c);
  assert.ok(Buffer.concat(rest).equals(dataA), 'in-flight reader got the complete original plaintext');
  if (!res) res = await fc.reencryptFile(f('old-v1.enc'));
  assert.deepStrictEqual([res.changed, res.from.format, res.from.keyVersion, res.to.format, res.to.keyVersion, res.to.contentType],
    [true, 'v1', v1, 'v1', v2, 'audio/ogg']);
  assert.ok((await readAll((await fc.openForRead(f('old-v1.enc'))).stream())).equals(dataA));
  assert.strictEqual((await fc.reencryptFile(f('old-v1.enc'))).changed, false, 'idempotent');

  const resL = await fc.reencryptFile(f('old-legacy.m4a.enc'));
  assert.deepStrictEqual([resL.changed, resL.from.format, resL.to.format, resL.to.keyVersion, resL.to.contentType],
    [true, 'legacy', 'v1', v2, 'audio/mp4']);
  assert.ok((await readAll((await fc.openForRead(f('old-legacy.m4a.enc'))).stream())).equals(dataL));

  // Concurrent calls on the same file: one rewrite, the other a no-op.
  fc.encryptBufferToFileSync(dataA, f('conc-v.enc'), { contentType: 'audio/ogg', keyVersion: v1 });
  const both = await Promise.all([fc.reencryptFile(f('conc-v.enc')), fc.reencryptFile(f('conc-v.enc')), fc.openForRead(f('conc-v.enc')).then((r) => readAll(r.stream()))]);
  assert.deepStrictEqual(both.slice(0, 2).map((r) => r.changed).sort(), [false, true]);
  assert.ok(both[2].equals(dataA));
  assert.ok(!fs.existsSync(f('conc-v.enc.rewrite.part')));
});

test(`memory: stream a ${SLOW ? 100 : 40} MB file with bounded RSS growth`, async () => {
  const p = f('mem100.enc');
  const total = (SLOW ? 100 : 40) * 1024 * 1024;
  let produced = 0;
  const src = new Readable({
    read() {
      if (produced >= total) return this.push(null);
      const n = Math.min(256 * 1024, total - produced);
      produced += n;
      this.push(crypto.randomBytes(n));
    },
  });
  await fc.encryptStreamToFile(src, p, { contentType: 'audio/mpeg' });
  global.gc && global.gc();
  const rss0 = process.memoryUsage().rss;
  let peak = rss0;
  const r = await fc.openForRead(p);
  let n = 0;
  await pipeline(r.stream(), new Writable({
    write(c, _e, cb) {
      n += c.length;
      const rss = process.memoryUsage().rss;
      if (rss > peak) peak = rss;
      cb();
    },
  }));
  assert.strictEqual(n, total);
  const growthMB = (peak - rss0) / 1024 / 1024;
  console.log(`  [mem] full decrypt stream: RSS growth ${growthMB.toFixed(1)} MB`);
  assert.ok(growthMB < 30, `RSS growth ${growthMB} MB`);
  fs.unlinkSync(p);
});
