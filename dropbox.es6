Dropbox = Npm.require('dropbox');

PublishDropbox = {};

PublishDropbox.publish = function(collection, context, client, opts) {

  // Keep track of which we have already seen
  var addedPaths = new Set(),
      running = true;

  opts = opts || {};
  var options = {};
  if (opts.path) {
    options.pathPrefix = opts.path;
  }

  // Track current state of Dropbox
  options.cursorTag = null;

  context.onStop(function() {
    running = false;
  });

  var handleChanges = Meteor.bindEnvironment(function(error, changes) {
    if (!running) {
      return;
    }

    if (error) {
      return context.error(error.status, error.response);
    }

    options.cursorTag = changes.cursorTag;

    changes.changes.forEach(function(change) {

      if (change.wasRemoved) {

        if (addedPaths.delete(change.path)) {
          callContext('removed', change);
        }

        // Look for subdirectories
        for (let c of addedPaths) {
          if (c.substr(0, change.path.length + 1) === change.path + '/') {
            addedPaths.delete(c);
            callContext('removed', {path: c});
          }
        }

      } else {
        if (addedPaths.has(change.path)) {
          callContext('changed', change);
        } else {
          addedPaths.add(change.path);
          callContext('added', change);
        }
        if (opts.contents && change.stat.isFile) {
          fetchContents(change.path);
        }
      }
    });

    if (changes.shouldPullAgain) {
      client.pullChanges(options, handleChanges);
    } else {
      // poll for future changes
      client.pollForChanges(options.cursorTag, {}, pollCallback);
    }
  });

  var pollCallback = Meteor.bindEnvironment(function(error, result) {
    if (!running) {
      return;
    }

    if (error) {
      return context.error(error.status, error.response);
    }

    if (result.hasChanges) {
      client.pullChanges(options, handleChanges);
    } else {
      Meteor.setTimeout(function() {
        client.pollForChanges(options.cursorTag, {}, pollCallback);
      }, result.retryAfter * 1000);
    }
  });

  // Start by pulling all changes
  client.pullChanges(options, handleChanges);

  function callContext(action, change) {
    if (action === 'removed') {
      context.removed(collection, change.path);
    } else {
      context[action](collection, change.path, {
        path: change.path,
        stat: change.stat,
      });
    }
  }

  function fetchContents(path) {
    client.readFile(path, function(error, contents) {
      if (error) {
        return context.error(error.status, error.response);
      }

      context.changed(collection, path, { contents: contents });
    });
  }
};
