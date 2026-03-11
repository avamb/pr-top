async function main() {
  try {
    var r = await fetch('http://localhost:3001/api/health');
    var d = await r.json();
    console.log('OK:', d.status);
  } catch(e) {
    console.log('ERROR:', e.message);
    console.log('CAUSE:', e.cause);
  }
}
main();
