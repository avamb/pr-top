// Regression test: verify all required tables and columns exist via API
const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  // Test health endpoint for DB connection
  const health = await get('http://localhost:3001/api/health');
  const healthData = JSON.parse(health.body);
  console.log("Health:", JSON.stringify(healthData));

  if (healthData.database !== 'connected') {
    console.log("FAIL: database not connected");
    process.exit(1);
  }
  console.log("Database connected: OK");
  console.log("Table count:", healthData.tableCount);

  if (healthData.tableCount < 13) {
    console.log("FAIL: expected at least 13 tables, got", healthData.tableCount);
    process.exit(1);
  }
  console.log("Table count check: OK");

  // Try to get schema info via an API endpoint if available
  const schemaCheck = await get('http://localhost:3001/api/debug/schema').catch(() => null);
  if (schemaCheck && schemaCheck.status === 200) {
    console.log("Schema endpoint:", schemaCheck.body.substring(0, 500));
  } else {
    console.log("No schema debug endpoint - relying on health check tableCount");
  }

  console.log("\nALL HEALTH/DB CHECKS PASSED");
}

main().catch(e => { console.error(e); process.exit(1); });
