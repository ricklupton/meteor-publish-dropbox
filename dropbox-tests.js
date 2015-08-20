describe('Dropbox API functions', function() {
  var Dropbox = Npm.require('dropbox'), client, context;

  beforeEach(function() {
    client = new Dropbox.Client({
      key:    'key',
      secret: 'secret',
      token:  'token',
    });

    sinon.stub(client, 'pullChanges');
    sinon.stub(client, 'pollForChanges');
    sinon.stub(client, 'readFile');

    context = {
      added: function() {},
      changed: function() {},
      removed: function() {},
    };
    sinon.stub(context, 'added');
    sinon.stub(context, 'changed');
    sinon.stub(context, 'removed');

  });

  it('should add initial files', function() {
    client.pullChanges.callsArgWith(1, null, {
      blankSlate:      true,
      cursorTag:       'abc',
      shouldPullAgain: false,
      shouldBackOff:   false,
      changes: [
        { path: 'a/c.xls', stat: { modifiedAt: 1 } },
        { path: 'd.txt',   stat: { modifiedAt: 2 } },
      ],
    });

    var c = 'collectionName';
    PublishDropbox.publish(c, context, client);
    expect(client.pullChanges).to.have.been.calledOnce;

    expect(context.added).to.have.been.calledTwice;
    expect(context.added).to.have.been.calledWith(
      c, 'a/c.xls', { path: 'a/c.xls', stat: {modifiedAt: 1} });
    expect(context.added).to.have.been.calledWith(
      c, 'd.txt', { path: 'd.txt', stat: {modifiedAt: 2} });
  });


  describe('shouldPullAgain', function() {

    it('should not pull again if Dropbox says not to', function() {
      // with shouldPullAgain = false
      client.pullChanges
        .onFirstCall()
        .callsArgWith(1, null, {
          shouldPullAgain: false,
          changes: [],
        });

      PublishDropbox.publish('collectionName', context, client);
      expect(client.pullChanges).to.have.been.calledOnce;
    });

    it('should pull again if Dropbox says to', function() {
      // with shouldPullAgain = true
      client.pullChanges
        .onFirstCall()
        .callsArgWith(1, null, {
          shouldPullAgain: true,
          changes: [],
        });

      client.pullChanges
        .onSecondCall()
        .callsArgWith(1, null, {
          shouldPullAgain: false,
          changes: [],
        });

      PublishDropbox.publish('collectionName', context, client);
      expect(client.pullChanges).to.have.been.calledTwice;
    });
  });


  it('should update changed files', function() {
    // setup callbacks: first poll returns one path
    client.pullChanges
      .onFirstCall()
      .callsArgWith(1, null, {
        cursorTag: 'abc',
        changes: [
          { path: 'a.xls', stat: { modifiedAt: 1 } },
        ]
      });

    // long-poll callback returns a change
    client.pollForChanges
      .callsArgWith(2, null, {
        hasChanges: true
      });

    // second call to pullChanges returns a change
    client.pullChanges
      .onSecondCall()
      .callsArgWith(1, null, {
        cursorTag: 'abc',
        changes: [
          { path: 'a.xls', stat: { modifiedAt: 2 } },
          { path: 'b.xls', stat: { modifiedAt: 2 } },
        ]
      });

    // third call to pullChanges returns another change
    client.pullChanges
      .onThirdCall()
      .callsArgWith(1, null, {
        cursorTag: 'abc',
        changes: [
          { path: 'a.xls', stat: { modifiedAt: 3 } },
        ]
      });

    // do the test
    var c = 'collectionName';
    PublishDropbox.publish(c, context, client);

    expect(context.added).to.have.been.calledTwice;
    expect(context.changed).to.have.been.calledTwice;

    expect(context.added).to.have.been.calledWith(c, 'a.xls');
    expect(context.added).to.have.been.calledWith(c, 'b.xls');
    expect(context.changed).to.have.been.calledWith(
      c, 'a.xls', { path: 'a.xls', stat: {modifiedAt: 2} });
    expect(context.changed).to.have.been.calledWith(
      c, 'a.xls', { path: 'a.xls', stat: {modifiedAt: 3} });
  });


  describe('deleting files', function() {
    it('should remove deleted files', function() {

      // setup callbacks: first poll returns one path
      client.pullChanges
        .onFirstCall()
        .callsArgWith(1, null, {
          cursorTag: 'abc',
          changes: [
            { path: 'a.xls', stat: { modifiedAt: 1 } },
          ]
        });

      // long-poll callback returns a change
      client.pollForChanges
        .onFirstCall()
        .callsArgWith(2, null, {
          hasChanges: true
        });

      // second call to pullChanges returns a removal
      client.pullChanges
        .onSecondCall()
        .callsArgWith(1, null, {
          cursorTag: 'abc',
          changes: [
            { path: 'a.xls', stat: {}, wasRemoved: true },
          ]
        });

      // do the test
      var c = 'collectionName';
      PublishDropbox.publish(c, context, client);

      expect(context.added).to.have.been.calledOnce;
      expect(context.removed).to.have.been.calledOnce;

      expect(context.added).to.have.been.calledWith(c, 'a.xls');
      expect(context.removed).to.have.been.calledWith(c, 'a.xls');
    });

    it('should remove children of deleted folders', function() {

      // setup callbacks: first poll returns initial paths
      client.pullChanges
        .onFirstCall()
        .callsArgWith(1, null, {
          shouldPullAgain: true,
          changes: [
            { path: 'x/a.xls' },
            { path: 'x/b.xls' },
            { path: 'y/c.xls' },
          ]
        });

      // second call to pullChanges removes 'x' folder
      client.pullChanges
        .onSecondCall()
        .callsArgWith(1, null, {
          changes: [
            { path: 'x', wasRemoved: true },
          ]
        });

      // do the test
      var c = 'collectionName';
      PublishDropbox.publish(c, context, client);

      expect(context.added).to.have.been.calledThrice;
      expect(context.removed).to.have.been.calledTwice;

      expect(context.added).to.have.been.calledWith(c, 'x/a.xls');
      expect(context.added).to.have.been.calledWith(c, 'x/b.xls');
      expect(context.added).to.have.been.calledWith(c, 'y/c.xls');
      expect(context.removed).to.have.been.calledWith(c, 'x/a.xls');
      expect(context.removed).to.have.been.calledWith(c, 'x/b.xls');
    });
  });


  describe('options', function() {
    it('should look only for files below given path', function() {
      client.pullChanges.callsArgWith(1, null, {
        blankSlate:      true,
        cursorTag:       'abc',
        changes: [
          { path: 'a/c.xls', stat: { modifiedAt: 1 } },
        ],
      });

      var c = 'collectionName';
      PublishDropbox.publish(c, context, client, { path: '/a' });
      expect(client.pullChanges).to.have.been.calledOnce;
      expect(client.pullChanges.args[0][0].pathPrefix).to.equal('/a');
    });

    it('should get file contents if requested', function() {
      client.pullChanges.callsArgWith(1, null, {
        blankSlate:      true,
        cursorTag:       'abc',
        changes: [
          { path: 'a/c.xls', stat: {} },
        ],
      });

      // mock contents of file = 'abc'
      client.readFile.callsArgWith(1, null, 'abc', {}, {});

      var c = 'collectionName';
      PublishDropbox.publish(c, context, client, { contents: true });
      expect(client.pullChanges).to.have.been.calledOnce;
      expect(client.readFile).to.have.been.calledWith('a/c.xls');

      expect(context.added).to.have.been.calledWith(c, 'a/c.xls');
      expect(context.changed).to.have.been.calledWith(c, 'a/c.xls', {
        contents: 'abc'
      });

    });
  });
});
