const {test} = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../manifest.json');
test('Zotero 10 installation requires ID, update URL and max version', () => {
  const app = manifest.applications.zotero;
  for (const key of ['id', 'strict_max_version']) assert.ok(app[key], key);
  assert.match(app.id, /^[a-z0-9._-]*@[a-z0-9._-]+$/i);
  assert.equal(app.update_url, 'https://hover-translate.invalid/updates.json', 'Zotero requires update_url; reserved .invalid prevents upstream auto-updates');
  assert.equal(app.strict_min_version, '10.0');
  assert.equal(app.strict_max_version, '10.*');
  assert.equal(manifest.version, require('../package.json').version);
});
