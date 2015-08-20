/*
 * Patch Dropbox.Client.pullChanges to take a path_prefix
 */

var Dropbox = Npm.require('dropbox');

Dropbox.Client.prototype.pullChanges = function(cursor, callback) {
  var params = {}, xhr;

  if ((!callback) && (typeof cursor === 'function')) {
    callback = cursor;
    cursor = null;
  }

  if (cursor) {
    if (cursor.cursorTag !== undefined || cursor.pathPrefix) {
      // options hash
      if (cursor.cursorTag) {
        params.cursor = cursor.cursorTag;
      }
      if (cursor.pathPrefix) {
        params.path_prefix = cursor.pathPrefix;
      }
    } else {
      params.cursor = cursor;
    }
  }

  xhr = new Dropbox.Util.Xhr('POST', this._urls.delta);
  xhr.setParams(params).signWithOauth(this._oauth);
  return this._dispatchXhr(xhr, function(error, deltaInfo) {
    return callback(error, Dropbox.Http.PulledChanges.parse(deltaInfo));
  });
};
