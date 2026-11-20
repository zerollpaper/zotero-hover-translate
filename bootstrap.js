var htScope;
async function startup({ rootURI }, reason) {
  await Zotero.uiReadyPromise;
  htScope = { Zotero, Services, Components, IOUtils, PathUtils, URL };
  Services.scriptloader.loadSubScript(rootURI + 'core.js', htScope, 'UTF-8');
  Services.scriptloader.loadSubScript(rootURI + 'cache.js', htScope, 'UTF-8');
  Services.scriptloader.loadSubScript(rootURI + 'fulltext.js', htScope, 'UTF-8');
  Services.scriptloader.loadSubScript(rootURI + 'addon.js', htScope, 'UTF-8');
  Zotero.HoverTranslate = htScope.HoverTranslate;
  await Zotero.PreferencePanes.register({
    pluginID: 'hover-translate@local', id: 'hover-translate-prefs',
    label: 'Hover Translate', image: rootURI + 'icon.svg', src: rootURI + 'prefs.xhtml', scripts: [rootURI + 'prefs.js'], stylesheets: [rootURI + 'prefs.css']
  });
  htScope.HoverTranslate.start();
}
function onMainWindowLoad({ window }) {
  htScope?.HoverTranslate?.mainWindowLoaded(window);
}
function onMainWindowUnload({ window }) {
  htScope?.HoverTranslate?.mainWindowUnloaded(window);
}
async function shutdown() {
  await htScope?.HoverTranslate?.stop();
  delete Zotero.HoverTranslate;
  htScope = null;
}
function install() {}
function uninstall() {}
