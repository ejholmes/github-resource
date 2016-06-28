var http = require('https');
 
function cfnsend(event, context, responseStatus, responseData, physicalResourceId) {
    var responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
        PhysicalResourceId: physicalResourceId || context.logStreamName,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: responseData
    });
 
    console.log("Response body:\n", responseBody);
 
    var https = require("https");
    var url = require("url");
 
    var parsedUrl = url.parse(event.ResponseURL);
    var options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: "PUT",
        headers: {
            "content-type": "",
            "content-length": responseBody.length
        }
    };
 
    var request = https.request(options, function(response) {
        console.log("Status code: " + response.statusCode);
        console.log("Status message: " + response.statusMessage);
        context.done();
    });
 
    request.on("error", function(error) {
        console.log("send(..) failed executing https.request(..): " + error);
        context.done();
    });
 
    request.write(responseBody);
    request.end();
}

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
  options.headers['User-Agent'] = 'ejholmes/github-resource'
  options.headers['Authorization'] = 'token ' + this.token;

  return http.request(options, function(response) {
    var body = '';

    response.on('data', function(chunk) {
      body += chunk;
    });

    response.on('end', function() {
      var err;
      if (Math.floor(response.statusCode / 100) !== 2) {
        err = "unexpected response";
      }
      callback(JSON.parse(body), err);
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
  'Custom::GitHubWebhook': {
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
      var req = client.request(options, function(body, err) {
        return callback(body.id, err);
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
      var req = client.request(options, function(body, err) {
        return callback(body.id, err);
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
      var req = client.request(options, function(body, err) {
        return callback(body.id, err);
      })
      return req.end();
    }
  }
}

exports.resources = resources;
exports.handler = function(event, context) {
  console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));

  var resource = resources[event.ResourceType];
  if (resource) {
    var fn = resource[event.RequestType];
    fn.call(fn, event, function(id, err) {
      if (err) {
        cfnsend(event, context, "FAILED", {Error: err});
      } else {
        cfnsend(event, context, "SUCCESS", {}, id);
      }
    });
  } else {
    console.log('no resource handler', event.ResourceType);
  }
};
