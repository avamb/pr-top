// Playwright script to upload a malformed JSON file via the Import button
var playwright = require('./src/frontend/node_modules/playwright-core');
var path = require('path');

async function test() {
  var browser = await playwright.chromium.launch({ headless: true });
  var context = await browser.newContext();
  var page = await context.newPage();

  // Login
  await page.goto('http://localhost:3000/login');
  await page.fill('input[placeholder="you@example.com"]', 'import_ui_test@test.com');
  await page.fill('input[placeholder="Your password"]', 'TestPass123!');
  await page.click('button:has-text("Sign In")');
  await page.waitForURL('**/dashboard');
  console.log('Logged in, navigating to client...');

  // Go to client page
  await page.goto('http://localhost:3000/clients/287');
  await page.waitForSelector('text=Notes');

  // Click Notes tab
  await page.click('button:has-text("Notes")');
  await page.waitForSelector('text=Import JSON');
  console.log('On notes tab');

  // Upload malformed file
  var fileInput = await page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(path.join(__dirname, 'test_malformed.json'));
  console.log('Uploaded malformed file');

  // Wait for error message
  await page.waitForTimeout(2000);
  var errorEl = await page.locator('.bg-red-50').first();
  var errorText = await errorEl.textContent().catch(function() { return 'NOT FOUND'; });
  console.log('Error message:', errorText);

  var hasError = errorText.includes('Malformed') || errorText.includes('error');
  console.log('Test - Malformed file shows error:', hasError ? 'PASS' : 'FAIL');

  // Verify no notes were imported
  var noNotes = await page.locator('text=No notes yet').isVisible().catch(function() { return false; });
  console.log('Test - No partial data:', noNotes ? 'PASS' : 'FAIL');

  // Now upload valid file
  await fileInput.setInputFiles(path.join(__dirname, 'test_valid_import.json'));
  console.log('Uploaded valid file');
  await page.waitForTimeout(2000);

  var successEl = await page.locator('.bg-green-50').first();
  var successText = await successEl.textContent().catch(function() { return 'NOT FOUND'; });
  console.log('Success message:', successText);
  var hasSuccess = successText.includes('Imported') || successText.includes('success');
  console.log('Test - Valid import succeeds:', hasSuccess ? 'PASS' : 'FAIL');

  // Check the note appears
  var noteVisible = await page.locator('text=IMPORT_VALID_NOTE_203').isVisible().catch(function() { return false; });
  console.log('Test - Imported note visible:', noteVisible ? 'PASS' : 'FAIL');

  await browser.close();
  console.log('\nDone');
}

test().catch(function(e) { console.error('Error:', e.message); process.exit(1); });
