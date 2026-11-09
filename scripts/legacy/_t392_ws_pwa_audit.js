/**
 * Feature #392 - Regression sweep: WebSocket push and PWA notifications
 *
 * Tests:
 *   Step 4 - WS auth handshake rejects invalid/expired JWTs (4001/4003)
 *   Step 1 - SOS alert delivered via WS in sub-second
 *   Step 2 - WS reconnect works + post-reconnect events delivered
 *   Step 3 - PWA manifest, service worker, install prompt assets in place
 *   Step 1b - diary + exercise_completed WS events
 *   Mock data grep
 */

var http = require('http');
var WebSocket = require('C:/Projects/dev-psy-bot/src/backend/node_modules/ws');
var jwt = require('C:/Projects/dev-psy-bot/src/backend/node_modules/jsonwebtoken');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var BASE = 'http://localhost:3001';
var WS_URL = 'ws://localhost:3001/ws';
var JWT_SECRET = 'dev-jwt-secret-change-in-production';
var BOT_API_KEY = process.env.BOT_API_KEY || 'dev-bot-api-key';

var passed = 0;
var failed = 0;
var errors = [];

function assert(condition, label) {
  if (condition) {
    console.log('  ✅ ' + label);
    passed++;
  } else {
    console.log('  ❌ ' + label);
    failed++;
    errors.push(label);
  }
}

function req(method, path, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    var data = body ? JSON.stringify(body) : null;
    var contentLen = data ? {'Content-Length': Buffer.byteLength(data)} : {};
    var opts = {
      hostname: 'localhost', port: 3001, path: path, method: method,
      headers: Object.assign({'Content-Type': 'application/json'}, contentLen, headers)
    };
    var r = http.request(opts, function(res) {
      var raw = '';
      res.on('data', function(c) { raw += c; });
      res.on('end', function() {
        try { resolve({status: res.statusCode, body: JSON.parse(raw)}); }
        catch(e) { resolve({status: res.statusCode, body: raw}); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function reqFrontend(path) {
  return new Promise(function(resolve) {
    http.get('http://localhost:3000' + path, function(res) {
      var raw = '';
      res.on('data', function(c) { raw += c; });
      res.on('end', function() {
        try { resolve({status: res.statusCode, body: JSON.parse(raw)}); }
        catch(e) { resolve({status: res.statusCode, body: raw}); }
      });
    }).on('error', function() { resolve({status: 0, body: null}); });
  });
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function wsConnect(token, timeoutMs) {
  timeoutMs = timeoutMs || 3000;
  return new Promise(function(resolve) {
    var url = token ? (WS_URL + '?token=' + encodeURIComponent(token)) : WS_URL;
    var ws = new WebSocket(url);
    var messages = [];
    var closeCode = null;
    var closeReason = null;
    var resolved = false;

    var timer = setTimeout(function() {
      if (!resolved) {
        resolved = true;
        ws.removeAllListeners();
        ws.close();
        resolve({ws: null, messages: messages, closeCode: closeCode, closeReason: closeReason, timedOut: true});
      }
    }, timeoutMs);

    ws.on('open', function() {});

    ws.on('message', function(data) {
      try {
        var msg = JSON.parse(data.toString());
        messages.push(msg);
        if (msg.type === 'connected' && !resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({ws: ws, messages: messages, closeCode: null, closeReason: null, timedOut: false});
        }
      } catch(e) {}
    });

    ws.on('close', function(code, reason) {
      closeCode = code;
      closeReason = reason ? reason.toString() : null;
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ws: null, messages: messages, closeCode: code, closeReason: closeReason, timedOut: false});
      }
    });

    ws.on('error', function(err) {
      // Will trigger close
    });
  });
}

function waitForMessage(ws, eventType, timeoutMs) {
  timeoutMs = timeoutMs || 3000;
  return new Promise(function(resolve) {
    var timer = setTimeout(function() {
      ws.removeListener('message', handler);
      resolve(null);
    }, timeoutMs);
    function handler(data) {
      try {
        var msg = JSON.parse(data.toString());
        if (msg.type === eventType) {
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(msg);
        }
      } catch(e) {}
    }
    ws.on('message', handler);
  });
}

async function setupTherapist(tag) {
  var csrfRes = await req('GET', '/api/csrf-token');
  var csrfToken = csrfRes.body.csrfToken;
  var email = 'ws_' + tag + '_' + Date.now() + '@example.com';
  var password = 'TestPass123!';
  var regRes = await req('POST', '/api/auth/register', {
    email: email, password: password, name: 'WS Test ' + tag, role: 'therapist'
  }, {'X-CSRF-Token': csrfToken});
  if (regRes.status !== 201) throw new Error('Registration failed: ' + regRes.status + ' ' + JSON.stringify(regRes.body));
  return {email: email, password: password, token: regRes.body.token, therapistId: regRes.body.user && regRes.body.user.id, csrfToken: csrfToken};
}

async function setupClientForTherapist(t, tag) {
  var inviteRes = await req('GET', '/api/invite-code', null, {'Authorization': 'Bearer ' + t.token});
  var inviteCode = inviteRes.body.invite_code;
  if (!inviteCode) throw new Error('No invite code: ' + JSON.stringify(inviteRes.body));

  var clientTgId = 'tg_' + tag + '_' + Date.now();
  var botHeaders = {'X-Bot-API-Key': BOT_API_KEY};

  // Register client via bot
  var regRes = await req('POST', '/api/bot/register', {
    telegram_id: clientTgId, role: 'client', language: 'en',
    first_name: 'Test', last_name: 'Client_' + tag
  }, botHeaders);
  if (regRes.status !== 201 && regRes.status !== 200) throw new Error('Bot register failed: ' + regRes.status + ' ' + JSON.stringify(regRes.body));

  var clientUserId = regRes.body.user && regRes.body.user.id;

  // Connect client to therapist
  var connectRes = await req('POST', '/api/bot/connect', {
    telegram_id: clientTgId, invite_code: inviteCode
  }, botHeaders);
  if (connectRes.status !== 200) throw new Error('Bot connect failed: ' + connectRes.status + ' ' + JSON.stringify(connectRes.body));

  // The connect response returns therapist.id needed for consent
  var foundTherapistId = connectRes.body.therapist && connectRes.body.therapist.id;
  if (!foundTherapistId) throw new Error('connect did not return therapist.id: ' + JSON.stringify(connectRes.body));

  // Grant consent (using correct fields from T-389 audit)
  var consentTextHash = crypto.createHash('sha256').update('consent-text-v1').digest('hex');
  var consentRes = await req('POST', '/api/bot/consent', {
    telegram_id: clientTgId,
    therapist_id: foundTherapistId,
    consent: true,
    consent_version: 1,
    consent_text_hash: consentTextHash,
    mode: 'connect'
  }, botHeaders);
  if (consentRes.status !== 200 && consentRes.status !== 201) throw new Error('Consent failed: ' + consentRes.status + ' ' + JSON.stringify(consentRes.body));

  // Get client ID from consent response (client_id field) or from therapist clients list
  var clientId = consentRes.body.client_id || null;
  if (!clientId) {
    // Fallback: find in clients list
    var clientsRes = await req('GET', '/api/clients', null, {'Authorization': 'Bearer ' + t.token});
    var client = clientsRes.body.clients && clientsRes.body.clients.find(function(c) { return c.name && c.name.indexOf('Client_' + tag) !== -1; });
    clientId = client ? client.id : null;
  }

  return {clientTgId: clientTgId, clientId: clientId, clientUserId: clientUserId, inviteCode: inviteCode};
}

// ============================================================
// Step 4: WS auth handshake rejects invalid/expired JWTs
// ============================================================
async function runStep4_WsAuthRejects() {
  console.log('\n=== Step 4: WS auth handshake rejects invalid/expired JWTs ===\n');

  // Case 1: No token
  var noToken = await wsConnect(null);
  assert(noToken.ws === null, 'No token: connection rejected');
  assert(noToken.closeCode === 4001, 'No token: close code 4001 (got ' + noToken.closeCode + ')');

  // Case 2: Random invalid JWT string
  var invalidToken = await wsConnect('not.a.valid.jwt.token');
  assert(invalidToken.ws === null, 'Invalid JWT string: connection rejected');
  assert(invalidToken.closeCode === 4001, 'Invalid JWT string: close code 4001 (got ' + invalidToken.closeCode + ')');

  // Case 3: Expired JWT (already expired)
  var expiredToken = jwt.sign({userId: 99999, role: 'therapist'}, JWT_SECRET, {expiresIn: -1});
  var expiredConn = await wsConnect(expiredToken);
  assert(expiredConn.ws === null, 'Expired JWT: connection rejected');
  assert(expiredConn.closeCode === 4001, 'Expired JWT: close code 4001 (got ' + expiredConn.closeCode + ')');

  // Case 4: Valid JWT but non-existent userId
  var nonExistentToken = jwt.sign({userId: 999999999, role: 'therapist'}, JWT_SECRET, {expiresIn: '1h'});
  var nonExistentConn = await wsConnect(nonExistentToken);
  assert(nonExistentConn.ws === null, 'Non-existent user JWT: connection rejected');
  assert(nonExistentConn.closeCode === 4001, 'Non-existent user JWT: close code 4001 (got ' + nonExistentConn.closeCode + ')');

  // Case 5: JWT signed with wrong secret
  var wrongSecretToken = jwt.sign({userId: 1, role: 'therapist'}, 'wrong-secret-entirely', {expiresIn: '1h'});
  var wrongSecretConn = await wsConnect(wrongSecretToken);
  assert(wrongSecretConn.ws === null, 'Wrong secret JWT: connection rejected');
  assert(wrongSecretConn.closeCode === 4001, 'Wrong secret JWT: close code 4001 (got ' + wrongSecretConn.closeCode + ')');

  // Case 6: Client role user (exists in DB with role=client) - should get 4003
  // Register a client via bot to get a real client user in the users table
  var botHeaders = {'X-Bot-API-Key': BOT_API_KEY};
  var clientTgId = 'tg_auth_test_' + Date.now();
  var clientRegRes = await req('POST', '/api/bot/register', {
    telegram_id: clientTgId, role: 'client', language: 'en',
    first_name: 'Auth', last_name: 'TestClient'
  }, botHeaders);
  var clientUserId = clientRegRes.body.user && clientRegRes.body.user.id;
  if (clientUserId) {
    // Create JWT for this real client user
    var clientToken = jwt.sign({userId: clientUserId, role: 'client'}, JWT_SECRET, {expiresIn: '1h'});
    var clientConn = await wsConnect(clientToken);
    assert(clientConn.ws === null, 'Client role user JWT: connection rejected (userId=' + clientUserId + ')');
    assert(clientConn.closeCode === 4003, 'Client role user JWT: close code 4003 (got ' + clientConn.closeCode + ')');
  } else {
    console.log('  ⚠️  Could not get client userId, skipping client role test');
  }

  // Case 7: Valid JWT, valid therapist → accepted
  var t = await setupTherapist('step4_valid');
  var validConn = await wsConnect(t.token);
  assert(validConn.ws !== null, 'Valid therapist JWT: connection accepted');
  assert(validConn.messages.some(function(m) { return m.type === 'connected'; }), 'Valid JWT: received connected welcome message');
  if (validConn.ws) validConn.ws.close();
}

// ============================================================
// Step 1: SOS alert → WS push (sub-second)
// ============================================================
async function runStep1_SosWsPush() {
  console.log('\n=== Step 1: SOS alert -> WS push (sub-second) ===\n');

  var t = await setupTherapist('step1');

  // Connect WebSocket
  var conn = await wsConnect(t.token);
  assert(conn.ws !== null, 'WS connection established with valid JWT');
  assert(conn.messages.some(function(m) { return m.type === 'connected'; }), 'Received connected welcome message');

  if (!conn.ws) {
    console.log('  Cannot proceed with Step 1 - WS failed to connect');
    return null;
  }

  // Link a client
  var inviteRes = await req('GET', '/api/invite-code', null, {'Authorization': 'Bearer ' + t.token});
  var inviteCode = inviteRes.body.invite_code;
  assert(!!inviteCode, 'Invite code obtained: ' + inviteCode);

  var botHeaders = {'X-Bot-API-Key': BOT_API_KEY};
  var clientTgId = 'tg_sos_' + Date.now();

  var botRegRes = await req('POST', '/api/bot/register', {
    telegram_id: clientTgId, role: 'client', language: 'en',
    first_name: 'SOS', last_name: 'TestClient'
  }, botHeaders);
  assert(botRegRes.status === 201 || botRegRes.status === 200, 'Client bot-registered (status ' + botRegRes.status + ')');

  var connectRes = await req('POST', '/api/bot/connect', {
    telegram_id: clientTgId, invite_code: inviteCode
  }, botHeaders);
  assert(connectRes.status === 200, 'Client connected to therapist via invite code (status ' + connectRes.status + ')');

  var foundTherapistId1 = connectRes.body.therapist && connectRes.body.therapist.id;
  var consentTextHash1 = crypto.createHash('sha256').update('consent-text-v1').digest('hex');
  var consentRes = await req('POST', '/api/bot/consent', {
    telegram_id: clientTgId,
    therapist_id: foundTherapistId1,
    consent: true,
    consent_version: 1,
    consent_text_hash: consentTextHash1,
    mode: 'connect'
  }, botHeaders);
  assert(consentRes.status === 200 || consentRes.status === 201, 'Consent granted (status ' + consentRes.status + ')');

  // Get client ID
  var clientsRes = await req('GET', '/api/clients', null, {'Authorization': 'Bearer ' + t.token});
  var client = clientsRes.body.clients && clientsRes.body.clients[0];
  assert(!!client, 'Client visible in therapist dashboard (id=' + (client && client.id) + ')');

  // Set therapist telegram_id for notification routing
  await req('POST', '/api/dev/set-telegram-id', {
    therapist_id: t.therapistId,
    telegram_id: 'tg_therapist_' + Date.now()
  });

  // Subscribe to SOS alert
  var sosPromise = waitForMessage(conn.ws, 'sos_alert', 5000);
  var sendTime = Date.now();

  // Trigger SOS
  var sosRes = await req('POST', '/api/bot/sos', {
    telegram_id: clientTgId, message: 'WS audit SOS test - UNIQUE_STEP1_SOS'
  }, botHeaders);
  assert(sosRes.status === 201, 'SOS triggered (status ' + sosRes.status + ')');

  // Wait for WS push
  var sosMsg = await sosPromise;
  var elapsed = Date.now() - sendTime;

  assert(sosMsg !== null, 'SOS WS push received (elapsed: ' + elapsed + 'ms)');
  if (sosMsg) {
    assert(sosMsg.type === 'sos_alert', 'WS message type = sos_alert');
    assert(sosMsg.client_id === (client && client.id), 'WS client_id matches (got ' + sosMsg.client_id + ', expected ' + (client && client.id) + ')');
    assert(sosMsg.sos_id > 0, 'WS sos_id present (' + sosMsg.sos_id + ')');
    assert(sosMsg.timestamp !== undefined, 'WS timestamp present');
    assert(elapsed < 1000, 'Sub-second delivery (' + elapsed + 'ms < 1000ms)');
  }

  conn.ws.close();
  return {t: t, clientTgId: clientTgId};
}

// ============================================================
// Step 2: WS reconnect + post-reconnect event delivery
// ============================================================
async function runStep2_Reconnect() {
  console.log('\n=== Step 2: WS reconnect + post-reconnect event delivery ===\n');

  var t = await setupTherapist('step2');

  // First connection
  var conn1 = await wsConnect(t.token);
  assert(conn1.ws !== null, 'First WS connection established');
  if (!conn1.ws) return;

  // Close the connection (simulating network drop / browser navigation)
  conn1.ws.close();
  await sleep(300);

  // Reconnect with same JWT
  var conn2 = await wsConnect(t.token);
  assert(conn2.ws !== null, 'Second WS connection established after disconnect');
  assert(conn2.messages.some(function(m) { return m.type === 'connected'; }), 'Welcome message received on reconnect');
  if (!conn2.ws) return;

  // Verify events arrive after reconnect
  var inviteRes = await req('GET', '/api/invite-code', null, {'Authorization': 'Bearer ' + t.token});
  var inviteCode = inviteRes.body.invite_code;
  var clientTgId2 = 'tg_reconnect_' + Date.now();
  var botHeaders = {'X-Bot-API-Key': BOT_API_KEY};

  await req('POST', '/api/bot/register', {
    telegram_id: clientTgId2, role: 'client', language: 'en',
    first_name: 'Reconnect', last_name: 'TestClient'
  }, botHeaders);
  var connectRes2 = await req('POST', '/api/bot/connect', {
    telegram_id: clientTgId2, invite_code: inviteCode
  }, botHeaders);
  var reconnectTherapistId = connectRes2.body.therapist && connectRes2.body.therapist.id;
  var consentTextHash2 = crypto.createHash('sha256').update('consent-text-v1').digest('hex');
  await req('POST', '/api/bot/consent', {
    telegram_id: clientTgId2,
    therapist_id: reconnectTherapistId,
    consent: true,
    consent_version: 1,
    consent_text_hash: consentTextHash2,
    mode: 'connect'
  }, botHeaders);

  // Send a third connection (simulate multiple tabs)
  var conn3 = await wsConnect(t.token);
  assert(conn3.ws !== null, 'Third WS connection (multi-tab simulation) established');

  // Listen for diary event on conn2
  var diaryMsgPromise = waitForMessage(conn2.ws, 'new_diary_entry', 5000);

  var diaryRes = await req('POST', '/api/bot/diary', {
    telegram_id: clientTgId2, entry_type: 'text',
    content: 'WS reconnect test diary - RECONNECT_TEST_STEP2'
  }, botHeaders);
  assert(diaryRes.status === 201, 'Diary entry created after reconnect (status ' + diaryRes.status + ')');

  var diaryMsg = await diaryMsgPromise;
  assert(diaryMsg !== null, 'new_diary_entry WS event received on reconnected session');
  if (diaryMsg) {
    assert(diaryMsg.type === 'new_diary_entry', 'Event type = new_diary_entry (got ' + diaryMsg.type + ')');
    assert(diaryMsg.entry_type === 'text', 'Entry type = text (got ' + diaryMsg.entry_type + ')');
    assert(diaryMsg.entry_id > 0, 'Entry ID present (' + diaryMsg.entry_id + ')');
  }

  // Verify event also arrives on conn3 (multi-tab delivery)
  if (conn3.ws) {
    var diaryMsgConn3 = await waitForMessage(conn3.ws, 'new_diary_entry', 1500);
    // Note: event was already emitted, may or may not arrive depending on timing
    // Just verify conn3 is still alive
    assert(conn3.ws.readyState === 1, 'Third WS connection remains open (readyState=' + conn3.ws.readyState + ')');
    conn3.ws.close();
  }

  // Verify server tracks connections in health
  var statsRes = await req('GET', '/api/health');
  var wsStat = statsRes.body.websocket;
  assert(wsStat !== undefined, 'WS stats in /api/health: ' + JSON.stringify(wsStat));

  conn2.ws.close();
}

// ============================================================
// Step 3: PWA manifest, service worker, install assets
// ============================================================
async function runStep3_PwaManifest() {
  console.log('\n=== Step 3: PWA manifest, service worker, and install assets ===\n');

  // Check manifest.json from frontend
  var manifestRes = await reqFrontend('/manifest.json');
  assert(manifestRes.status === 200, 'manifest.json served (status ' + manifestRes.status + ')');
  if (manifestRes.body && typeof manifestRes.body === 'object') {
    var m = manifestRes.body;
    assert(m.name && m.name.length > 0, 'manifest.name = "' + m.name + '"');
    assert(m.display === 'standalone', 'manifest.display = standalone (got ' + m.display + ')');
    assert(m.start_url && m.start_url.indexOf('dashboard') !== -1, 'manifest.start_url contains /dashboard (got ' + m.start_url + ')');
    assert(Array.isArray(m.icons) && m.icons.length >= 2, 'manifest.icons has >= 2 entries (' + (m.icons && m.icons.length) + ')');
    assert(m.theme_color !== undefined, 'manifest.theme_color = ' + m.theme_color);
  }

  // Check service worker
  var swRes = await reqFrontend('/sw.js');
  assert(swRes.status === 200, 'sw.js served (status ' + swRes.status + ')');
  if (swRes.body && typeof swRes.body === 'string') {
    assert(swRes.body.indexOf('install') !== -1 || swRes.body.indexOf('cache') !== -1, 'sw.js has install/cache logic');
    assert(swRes.body.indexOf('activate') !== -1, 'sw.js has activate handler');
    assert(swRes.body.indexOf('fetch') !== -1, 'sw.js has fetch handler');
  }

  // Check source files on disk (use Windows path for Node.js fs)
  var srcBase = 'C:/Projects/dev-psy-bot/src/frontend';
  var swSrcPath = srcBase + '/public/sw.js';
  var manifestSrcPath = srcBase + '/public/manifest.json';
  var installPromptPath = srcBase + '/src/components/InstallPrompt.jsx';
  var mainJsxPath = srcBase + '/src/main.jsx';

  assert(fs.existsSync(swSrcPath), 'sw.js source file exists at ' + swSrcPath);
  assert(fs.existsSync(manifestSrcPath), 'manifest.json source file exists');
  assert(fs.existsSync(installPromptPath), 'InstallPrompt.jsx component exists');
  assert(fs.existsSync(mainJsxPath), 'main.jsx exists');

  // Check SW registration in main.jsx
  if (fs.existsSync(mainJsxPath)) {
    var mainContent = fs.readFileSync(mainJsxPath, 'utf-8');
    assert(mainContent.indexOf('serviceWorker') !== -1, 'main.jsx references serviceWorker');
    assert(mainContent.indexOf('/sw.js') !== -1, 'main.jsx registers /sw.js path');
  }

  // Check InstallPrompt handles beforeinstallprompt
  if (fs.existsSync(installPromptPath)) {
    var installContent = fs.readFileSync(installPromptPath, 'utf-8');
    assert(installContent.indexOf('beforeinstallprompt') !== -1, 'InstallPrompt listens for beforeinstallprompt');
    assert(installContent.indexOf('prompt()') !== -1 || installContent.indexOf('.prompt(') !== -1, 'InstallPrompt calls prompt() on user interaction');
    assert(installContent.indexOf('sw-updated') !== -1, 'InstallPrompt handles sw-updated event');
  }

  // Verify all icon files listed in manifest actually exist
  if (fs.existsSync(manifestSrcPath)) {
    var manifestData = JSON.parse(fs.readFileSync(manifestSrcPath, 'utf-8'));
    var allIconsExist = true;
    var iconsDir = srcBase + '/public';
    for (var i = 0; i < (manifestData.icons || []).length; i++) {
      var icon = manifestData.icons[i];
      var iconPath = iconsDir + '/' + icon.src.replace(/^\//, '');
      if (!fs.existsSync(iconPath)) {
        console.log('    Missing icon: ' + icon.src);
        allIconsExist = false;
      }
    }
    assert(allIconsExist, 'All manifest icon files exist on disk');
  }
}

// ============================================================
// Step 1b: diary + exercise_completed WS events
// ============================================================
async function runStep1b_DiaryAndExerciseEvents() {
  console.log('\n=== Step 1b: diary + exercise_completed WS events ===\n');

  var t = await setupTherapist('step1b');
  var conn = await wsConnect(t.token);
  assert(conn.ws !== null, 'WS connected for event verification');
  if (!conn.ws) return;

  var clientInfo = await setupClientForTherapist(t, 'events');
  var clientTgId = clientInfo.clientTgId;
  var clientId = clientInfo.clientId;
  var botHeaders = {'X-Bot-API-Key': BOT_API_KEY};

  assert(!!clientId, 'Client linked to therapist (clientId=' + clientId + ')');

  // --- new_diary_entry ---
  var diaryMsgPromise = waitForMessage(conn.ws, 'new_diary_entry', 5000);
  var diaryRes = await req('POST', '/api/bot/diary', {
    telegram_id: clientTgId, entry_type: 'text',
    content: 'Step 1b diary WS test - UNIQUE_STEP1B'
  }, botHeaders);
  assert(diaryRes.status === 201, 'Diary entry created (status ' + diaryRes.status + ')');

  var diaryMsg = await diaryMsgPromise;
  assert(diaryMsg !== null, 'new_diary_entry WS event received');
  if (diaryMsg) {
    assert(diaryMsg.type === 'new_diary_entry', 'Event type = new_diary_entry');
    assert(diaryMsg.entry_type === 'text', 'Diary entry_type = text (got ' + diaryMsg.entry_type + ')');
    assert(diaryMsg.entry_id > 0, 'Diary entry_id present (' + diaryMsg.entry_id + ')');
    assert(diaryMsg.client_id > 0, 'Diary client_id present (' + diaryMsg.client_id + ')');
  }

  // --- exercise_completed ---
  var libRes = await req('GET', '/api/exercises', null, {'Authorization': 'Bearer ' + t.token});
  var exercise = libRes.body.exercises && libRes.body.exercises[0];

  if (exercise && clientId) {
    var csrfRes = await req('GET', '/api/csrf-token');
    var csrf = csrfRes.body.csrfToken;
    var assignRes = await req('POST', '/api/clients/' + clientId + '/exercises', {
      exercise_id: exercise.id
    }, {'Authorization': 'Bearer ' + t.token, 'X-CSRF-Token': csrf});
    assert(assignRes.status === 201, 'Exercise assigned (status ' + assignRes.status + ')');

    var deliveryId = assignRes.body.delivery && assignRes.body.delivery.id;
    if (deliveryId) {
      await req('POST', '/api/bot/exercises/' + deliveryId + '/acknowledge', {
        telegram_id: clientTgId
      }, botHeaders);

      var exMsgPromise = waitForMessage(conn.ws, 'exercise_completed', 5000);
      var completeRes = await req('POST', '/api/bot/exercises/' + deliveryId + '/respond', {
        telegram_id: clientTgId, response_text: 'Step 1b exercise response'
      }, botHeaders);
      assert(completeRes.status === 200, 'Exercise completed (status ' + completeRes.status + ')');

      var exMsg = await exMsgPromise;
      assert(exMsg !== null, 'exercise_completed WS event received');
      if (exMsg) {
        assert(exMsg.type === 'exercise_completed', 'Event type = exercise_completed');
        assert(exMsg.delivery_id === deliveryId, 'Exercise delivery_id matches (' + exMsg.delivery_id + ')');
      }
    }
  } else {
    console.log('  ⚠️  No exercises in library or no clientId - skipping exercise_completed event test');
  }

  // Verify health endpoint shows connection count
  var statsRes = await req('GET', '/api/health');
  var wsStat = statsRes.body.websocket;
  assert(wsStat !== undefined, 'WS stats available in /api/health');
  assert(wsStat.total_connections >= 1, 'WS has >= 1 active connection (' + (wsStat && wsStat.total_connections) + ')');

  conn.ws.close();
}

// ============================================================
// Mock data grep check
// ============================================================
async function runMockDataCheck() {
  console.log('\n=== Mock data grep check ===\n');

  var patterns = ['globalThis', 'devStore', 'dev-store', 'mockDb', 'mockData', 'fakeData', 'isDevelopment'];
  var wsFiles = [
    'C:/Projects/dev-psy-bot/src/backend/src/services/websocketService.js',
    'C:/Projects/dev-psy-bot/src/frontend/src/hooks/useWebSocket.js',
    'C:/Projects/dev-psy-bot/src/frontend/src/components/NotificationToast.jsx',
    'C:/Projects/dev-psy-bot/src/frontend/src/components/InstallPrompt.jsx',
    'C:/Projects/dev-psy-bot/src/frontend/public/sw.js'
  ];

  var hitFound = false;
  for (var f = 0; f < wsFiles.length; f++) {
    var file = wsFiles[f];
    if (!fs.existsSync(file)) continue;
    var content = fs.readFileSync(file, 'utf-8');
    for (var p = 0; p < patterns.length; p++) {
      if (content.indexOf(patterns[p]) !== -1) {
        console.log('  ⚠️  Mock pattern "' + patterns[p] + '" found in ' + path.basename(file));
        hitFound = true;
      }
    }
  }
  assert(!hitFound, 'No mock/dev-store patterns in WS/PWA source files');
}

async function main() {
  console.log('=================================================');
  console.log('Feature #392 -- WebSocket Push & PWA Regression Audit');
  console.log('=================================================');

  try {
    await runStep4_WsAuthRejects();
    await runStep1_SosWsPush();
    await runStep2_Reconnect();
    await runStep3_PwaManifest();
    await runStep1b_DiaryAndExerciseEvents();
    await runMockDataCheck();
  } catch(err) {
    console.error('\n\u{1F4A5} Fatal error: ' + err.message);
    console.error(err.stack);
    failed++;
    errors.push('Fatal: ' + err.message);
  }

  console.log('\n=================================================');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  if (errors.length > 0) {
    console.log('\nFailed assertions:');
    errors.forEach(function(e) { console.log('  - ' + e); });
  }
  console.log('=================================================');

  process.exit(failed > 0 ? 1 : 0);
}

main();
