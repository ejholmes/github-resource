var resources = require('./index').resources,
    handleWithResources = require('./index').handleWithResources,
    nock = require('nock'),
    expect = require('chai').expect,
    github = nock('https://api.github.com').log(console.log),
    s3 = nock('https://s3.amazonaws.com').log(console.log);

describe('handler', function() {
  var handle = handleWithResources({
    'Custom::SuccessResource': {
      Create: function(event, callback) {
        return callback(String(1), null)
      },
      Delete: function(event, callback) {
        return callback(String(2), null)
      }
    },
    'Custom::FailResource': {
      Create: function(event, callback) {
        return callback(null, 'could not create resource')
      }
    }
  })

  describe('Create', function() {
    it('creates the resource, then uploads the response body', function(done) {
      var context = { done: done },
          event = {
            ResourceType: 'Custom::SuccessResource',
            RequestType: 'Create',
            ResponseURL: 'https://s3.amazonaws.com/signedurl',
            LogicalResourceId: 'GitHubWebhook',
            RequestId: 'b67bf81b-16ff-4664-a6fc-f6d28830ba60',
            StackId: 'arn:aws:cloudformation:us-east-1:066251891493:stack/cf-test/d85e5ab0-3d02-11e6-a362-500c20ff1436'
          };

      s3
        .put('/signedurl', {"StackId":"arn:aws:cloudformation:us-east-1:066251891493:stack/cf-test/d85e5ab0-3d02-11e6-a362-500c20ff1436","RequestId":"b67bf81b-16ff-4664-a6fc-f6d28830ba60","LogicalResourceId":"GitHubWebhook","Data":{},"Status":"SUCCESS","PhysicalResourceId":"1"})
        .reply(200);

      handle(event, context);
    });

    it('handles failures', function(done) {
      var context = { done: done },
          event = {
            ResourceType: 'Custom::FailResource',
            RequestType: 'Create',
            ResponseURL: 'https://s3.amazonaws.com/signedurl',
            LogicalResourceId: 'GitHubWebhook',
            RequestId: 'b67bf81b-16ff-4664-a6fc-f6d28830ba60',
            StackId: 'arn:aws:cloudformation:us-east-1:066251891493:stack/cf-test/d85e5ab0-3d02-11e6-a362-500c20ff1436'
          };

      s3
        .put('/signedurl', {"StackId":"arn:aws:cloudformation:us-east-1:066251891493:stack/cf-test/d85e5ab0-3d02-11e6-a362-500c20ff1436","RequestId":"b67bf81b-16ff-4664-a6fc-f6d28830ba60","LogicalResourceId":"GitHubWebhook","Data":{},"Reason":"could not create resource","Status":"FAILED"})
        .reply(200);

      handle(event, context);
    });
  })
})

describe('Custom::GitHubWebhook', function() {
  var resource = resources['Custom::GitHubWebhook'];

  describe('Create', function() {
    it('Creates the webhook', function(done) {
      var params = {
        name: 'web',
        events: ['deployment'],
        active: true,
        config: {
          url: 'http://requestb.in/17dv0eu1',
          content_type: 'json',
          secret: 'secret'
        }
      }

      github
        .post('/repos/ejholmes/github-resource/hooks', params)
        .reply(200, {id: 1});

      var event = {
        ResourceProperties: {
          Repository: 'ejholmes/github-resource',
          ApiToken: 'abcd',
          Params: {
            name: 'web',
            events: ['deployment'],
            active: 'true',
            config: {
              url: 'http://requestb.in/17dv0eu1',
              content_type: 'json',
              secret: 'secret'
            }
          }
        }
      }

      resource.Create(event, function(id) {
        expect(id).to.eq('1')
        done();
      })
    })

    it('Returns an error if there is an auth error', function(done) {
      var params = {
        name: 'web',
        events: ['deployment'],
        active: true,
        config: {
          url: 'http://requestb.in/17dv0eu1',
          content_type: 'json',
          secret: 'secret'
        }
      }

      github
        .post('/repos/ejholmes/github-resource/hooks', params)
        .reply(403, {id: 1});

      var event = {
        ResourceProperties: {
          Repository: 'ejholmes/github-resource',
          ApiToken: 'abcd',
          Params: {
            name: 'web',
            events: ['deployment'],
            active: 'true',
            config: {
              url: 'http://requestb.in/17dv0eu1',
              content_type: 'json',
              secret: 'secret'
            }
          }
        }
      }

      resource.Create(event, function(id, err) {
        expect(id).to.eq('1');
        expect(err).to.not.be.null
        done();
      })
    })
  })

  describe('Update', function() {
    it('Updates the webhook', function(done) {
      var params = {
        name: 'web',
        events: ['deployment'],
        active: true,
        config: {
          url: 'http://requestb.in/17dv0eu1',
          content_type: 'json',
          secret: 'secret'
        }
      }

      github
        .patch('/repos/ejholmes/github-resource/hooks/1', params)
        .reply(200, {id: 1});

      var event = {
        PhysicalResourceId: '1',
        ResourceProperties: {
          Repository: 'ejholmes/github-resource',
          ApiToken: 'abcd',
          Params: {
            name: 'web',
            events: ['deployment'],
            active: 'true',
            config: {
              url: 'http://requestb.in/17dv0eu1',
              content_type: 'json',
              secret: 'secret'
            }
          }
        }
      }

      resource.Update(event, function(id) {
        expect(id).to.eq('1');
        done();
      })
    })
  })

  describe('Delete', function() {
    it('Deletes the webhook', function(done) {
      github
        .delete('/repos/ejholmes/github-resource/hooks/1')
        .reply(200, {id: 1});

      var event = {
        PhysicalResourceId: '1',
        ResourceProperties: {
          Repository: 'ejholmes/github-resource',
          ApiToken: 'abcd',
          Params: {}
        }
      }

      resource.Delete(event, function(id) {
        expect(id).to.eq('1');
        done();
      })
    })
  })
})
