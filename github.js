var response = require('cfn-response'),
    http = require('https');

var GITHUB_API = 'api.github.com';

function GitHubClient(token) {
  this.token = token;
}

/**
 * request makes a GitHub API request and yields the body to callback.
 */
GitHubClient.prototype.request = function(options, callback) {
  options.host = GITHUB_API;
  if (!options.headers) {
    options.headers = {}
  }
  options.headers['Content-Type'] = 'application/json'

  return http.request(options, function(response) {
    var body = '';

    response.on('data', function(chunk) {
      body += chunk;
    });

    response.on('end', function() {
      callback(JSON.parse(body));
    });
  });
}

/**
 * CloudFormation resources that this function exposes.
 */
var resources = {
  /**
   * This resource allows you to manage webhooks on a GitHub repository.
   */
  'Custom::GitHub::Webhook': {
    /**
     * Creates a new webhook on the repo.
     */
    Create: function(event, callback) {
      var repo     = event.ResourceProperties.Repository,
          apiToken = event.ResourceProperties.ApiToken;

      var client = new GitHubClient(apiToken);
      var options = {
        method: 'POST',
        path: '/repos/' + repo + '/hooks'
      }
      var req = client.request(options, function(body) {
        return callback(body.id);
      })
      req.write(JSON.stringify(event.ResourceProperties.Params));
      return req.end();
    },

    /**
     * Updates an existing webhook on the repo.
     */
    Update: function(event, callback) {
      var repo     = event.ResourceProperties.Repository,
          apiToken = event.ResourceProperties.ApiToken,
          id       = event.PhysicalResourceId;

      var client = new GitHubClient(apiToken);
      var options = {
        method: 'PATCH',
        path: '/repos/' + repo + '/hooks/' + id
      }
      var req = client.request(options, function(body) {
        return callback(body.id);
      })
      req.write(JSON.stringify(event.ResourceProperties.Params));
      return req.end();
    },

    /**
     * Delets a webhook on the repo.
     */
    Delete: function(event, callback) {
      var repo     = event.ResourceProperties.Repository,
          apiToken = event.ResourceProperties.ApiToken,
          id       = event.PhysicalResourceId;

      var client = new GitHubClient(apiToken);
      var options = {
        method: 'DELETE',
        path: '/repos/' + repo + '/hooks/' + id
      }
      var req = client.request(options, function(body) {
        return callback(body.id);
      })
      return req.end();
    }
  }
}

exports.resources = resources;
exports.handler = function(event, context) {
  console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));

  resources[event.ResourceType].call(event, function(id) {
    response.send(event, context, response.SUCCESS, {}, id);
  });
};
