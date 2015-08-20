Package.describe({
  name: 'ricklupton:publish-dropbox',
  version: '0.0.2',
  summary: 'Subscribe to Dropbox folders and publish changes to files',
  git: 'https://github.com/ricklupton/meteor-publish-dropbox',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.1.0.2');
  api.use([
    'grigio:babel@0.1.6',
  ]);
  api.export('Dropbox', 'server');
  api.export('PublishDropbox', 'server');
  api.addFiles('patchPullChanges.js', 'server');
  api.addFiles('dropbox.es6', 'server');
});

Package.onTest(function(api) {
  api.use([
    'grigio:babel@0.1.6',
    'mike:mocha-package@0.5.8',
    'practicalmeteor:chai',
    'practicalmeteor:sinon',
  ]);
  api.addFiles('patchPullChanges.js', 'server');
  api.addFiles('dropbox.es6', 'server');
  api.addFiles('dropbox-tests.js', 'server');
});

Npm.depends({
  'dropbox': '0.10.3',
});
