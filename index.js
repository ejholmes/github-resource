var http = require('https'),
    url = require('url');
 
function cfnsend(event, context, err, physicalResourceId) {
  var response = {
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: {},
    PhysicalResourceId: physicalResourceId
  };

  if (err) {
    response.Reason = err;
    response.Status = "FAILED";
  } else {
    response.Status = "SUCCESS";
  }

  var responseBody = JSON.stringify(response);

  console.log("Response body:\n", responseBody);

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

  var request = http.request(options, function(response) {
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
      var jsonBody = JSON.parse(body)

      if (Math.floor(response.statusCode / 100) !== 2) {
        if (jsonBody.message) {
          err = jsonBody;
        } else {
          err = {
            message: "unexpected response: " + response.statusCode
          }
        }
      }

      callback(jsonBody, err, response);
    });
  });
}

/**
 * fixParams ensures that params that should be a bool are actually a boolean.
 */
function fixParams(params) {
  if (params.active === 'true') {
    params.active = true;
  } else if (params.active === 'false') {
    params.active = false;
  }
  return params;
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
      var req = client.request(options, function(body, err, response) {
        var id = String(body.id);

        if (err) {
          var errMessage = err.message;
          if (err.message == 'Validation Failed' && err.errors.length > 0) {
            errMessage = err.errors[0].message;
          }
          return callback(id, errMessage);
        } else {
          return callback(id, null);
        }
      })
      req.write(JSON.stringify(fixParams(event.ResourceProperties.Params)));
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
      var req = client.request(options, function(body, err, response) {
        if (err) {
          return callback(id, err.message);
        } else {
          return callback(id, null);
        }
      })
      req.write(JSON.stringify(fixParams(event.ResourceProperties.Params)));
      return req.end();
    },

    /**
     * Deletes a webhook on the repo.
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
      var req = client.request(options, function(body, err, response) {
        if (response.statusCode == 404) {
          // Ignore error if it's a 404.
          return callback(id, null);
        } else if (err) {
          return callback(id, err.message);
        } else {
          return callback(id, null);
        }
      })
      return req.end();
    }
  }
}

/**
 * Returns a lambda handler that will use the given CloudFormation resources to
 * handle requests.
 */
function handleWithResources(resources) {
  return function(event, context) {
    console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));

    var resource = resources[event.ResourceType];
    if (resource) {
      var fn = resource[event.RequestType];
      fn.call(fn, event, function(id, err) {
        if (err) {
          cfnsend(event, context, err, id);
        } else {
          cfnsend(event, context, null, id);
        }
      });
    } else {
      console.log('no resource handler', event.ResourceType);
    }
  }
}

exports.resources = resources;
exports.handleWithResources = handleWithResources;
exports.handler = handleWithResources(resources);
