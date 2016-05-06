var resources = require('./github').resources,
    nock = require('nock'),
    github = nock('https://api.github.com').log(console.log);

describe('Custom::GitHub::Webhook', function() {
  var resource = resources['Custom::GitHub::Webhook'];

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
            active: true,
            config: {
              url: 'http://requestb.in/17dv0eu1',
              content_type: 'json',
              secret: 'secret'
            }
          }
        }
      }

      resource.Create(event, function(id) {
        console.log(id);
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
        PhysicalResourceId: 1,
        ResourceProperties: {
          Repository: 'ejholmes/github-resource',
          ApiToken: 'abcd',
          Params: {
            name: 'web',
            events: ['deployment'],
            active: true,
            config: {
              url: 'http://requestb.in/17dv0eu1',
              content_type: 'json',
              secret: 'secret'
            }
          }
        }
      }

      resource.Update(event, function(id) {
        console.log(id);
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
        PhysicalResourceId: 1,
        ResourceProperties: {
          Repository: 'ejholmes/github-resource',
          ApiToken: 'abcd',
          Params: {}
        }
      }

      resource.Delete(event, function(id) {
        console.log(id);
        done();
      })
    })
  })
})
