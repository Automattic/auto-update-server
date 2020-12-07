/**
 * Module dependencies
 */

var basicAuth = require('express-basic-auth');
var bodyParser = require('body-parser');
var co = require('co');
var fs = require('fs');
var ms = require('ms');
var sleep = require('co-wait');
var http = require('http');
var dive_ = require('dive');
var path = require('path');
var https = require('https');
var semver = require('semver');
var express = require('express');
var thunkify = require('thunkify');
var exec = require('child_process').exec;
var serveIndex = require('serve-index');

/**
 * Config
 */

var config = require('./config');

var app = express();
var updates = [];

/**
 * Completes a version with missing info. e.g. '1.3' => '1.3.0'
 */

function completeVer(ver) {
  if (ver.match(/^[0-9]+$/)) {
    return ver + '.0.0';
  } else if (ver.match(/^[0-9]+\.[0-9]+$/)) {
    return ver + '.0';
  } else {
    return ver;
  }
}

/**
 * Removes the Byte Order Mark
 */

function removeBOM(str) {
  if (str.charCodeAt(0) === 0xFEFF) {
    return str.slice(1);
  }
  return str;
}

/**
 * Thunkified dive() module.
 */

function dive (dir, iterator) {
  return function(fn){
    dive_(dir, {}, function(err, filepath){
      if (err) return fn(err);
      iterator(filepath);
    }, fn);
  };
}

/**
 * Reads and loads update data from the `updates` directory
 */

function* loadUpdates() {
  console.log('Loading updates...');

  var newUpdates = [];

  // add a new "file" entry to the `newUpdates` array
  function add(data, filepath, stats){
    newUpdates.push({
      app: data.app,
      version: completeVer(data.version),
      channels: data.channels,
      compatible: {
        os: data.os,
        osversion: data.osversion,
        architectures: data.architectures,
        appversion: data.appversion
      },
      percentage: parseFloat(data.percentage) || 100,
      path: path.resolve(path.dirname(filepath), data.path),
      format: data.format || path.extname(data.path).slice(1),
      jsonpath: filepath,
      date: stats.ctime
    });
  }

  // iterate through each file in the "updates" dir
  yield dive(config.directory, function(filepath) {
    if (filepath.match(/\.json$/)) {
      console.log('Reading `' + filepath + '`...');
      var data;
      var stats;
      try {
        // TODO: turn the readFileSync() into a yield call...
        data = JSON.parse(removeBOM(fs.readFileSync(filepath, 'utf8')));
        stats = fs.statSync(filepath);
      } catch (e) {
        console.error(e.stack);
        return;
      }
      if (data.entries) {
        data.entries.forEach(function(entry) {
          entry.app = data.app;
          entry.version = data.version;
          entry.channels = data.channels;
          add(entry, filepath, stats);
        });
      } else {
        add(data, filepath, stats);
      }
    }
  });

  console.log(newUpdates.length + ' update' + (newUpdates.length == 1 ? '' : 's') + ' loaded successfully.');
  updates = newUpdates;
}

/**
 * Cleans up updates in disposable channels after ~24 hours
 */

function* cleanup() {
  if (!config.disposableChannels || config.disposableChannels.length == 0) {
    return;
  }
  console.log('Cleaning up updates in channels: %j', config.disposableChannels);
  var cleaned = 0;

  function isDisposable(channel) {
    return config.disposableChannels.indexOf(channel) != -1;
  }

  updates.forEach(function(update) {
    if (update.date < new Date(new Date() - 1000 * 60 * 60 * 24)) {
      if (update.channels.every(isDisposable)) {
        try {
          cleaned++;
          console.log('Removing file `' + update.path + '`.');
          fs.unlinkSync(update.path);
          console.log('Removing file `' + update.jsonpath + '`.');
          fs.unlinkSync(update.jsonpath);
        } catch (e) {
          console.error(e.stack);
        }
      }
    }
  });

  if (cleaned > 0) {
    console.log('cleaned %d entries - reloading updates', cleaned);
    yield loadUpdates();
  }
  console.log('Cleanup completed. ' + cleaned + ' updates cleaned.');
}

/**
 * Match the latest update for the given info
 */

function matchUpdate(info) {
  var match;
  // TODO: use component/find here...
  updates.forEach(function(update) {
    if (update.app == info.app &&
        semver.gt(update.version, completeVer(info.appversion)) &&
        update.channels.indexOf(info.channel) != -1 &&
        update.compatible.architectures.indexOf(info.architecture) != -1 &&
        update.compatible.os == info.os &&
        semver.satisfies(completeVer(info.osversion), update.compatible.osversion) &&
        semver.satisfies(completeVer(info.appversion), update.compatible.appversion) &&
        update.percentage >= parseFloat(info.percentile) &&
        update.format == info.format) {
      if (match) {
        if (semver.gt(update.version, match.version)) {
          match = update;
        }
      } else {
        match = update;
      }
    }
  });
  return match;
}

/**
 * Middleware
 */

app.use(bodyParser());

var auth = basicAuth(config.username, config.password);

/**
 * Normalizes a `req.params` or `req.query` object with the proper default values.
 *
 * @api private
 */

function defaults(info) {
  if (!info) info = {};
  if (!info.percentile) info.percentile = 100;
  if (!info.channel) info.channel = 'release';
  if (!info.appversion) info.appversion = '0.0.0';
  if (!info.osversion) {
    if (info.os == 'windows') {
      info.osversion = '5.1';
    } else if (info.os == 'osx') {
      info.osversion = '10.6';
    }
  }
  if (!info.architecture) {
    if (info.os == 'windows') {
      info.architecture = 'x86';
    } else if (info.os == 'osx') {
      info.architecture = 'x86-64';
    }
  }
  if (!info.format) {
    if (info.os == 'windows') {
      info.format = 'zip';
    } else if (info.os == 'osx') {
      info.format = 'gz';
    }
  }
  return info;
}

/**
 * @deprecated
 */

app.get('/update/:architecture/:os/:osversion/:app/:appversion/:channel', function(req, res, next) {
  var info = defaults(req.params);
  var update = matchUpdate(info);
  res.setHeader("Connection", "close");
  if (update) {
    res.download(update.path, path.basename(update.path));
  } else {
    res.send(404, "No updates.");
  }
});

/**
 * Check and download update.
 *
 * @api public
 */

app.get('/update', function(req, res, next) {
  var info = defaults(req.query);
  var update = matchUpdate(info);
  res.setHeader("Connection", "close");
  if (update) {
    res.download(update.path, path.basename(update.path));
  } else {
    res.status(404).send("No updates.");
  }
});

/**
 * Returns a JSON document describing the "latest" version.
 */

app.get('/update.json', function(req, res, next) {
  var info = defaults(req.query);
  var update = matchUpdate(info);
  res.setHeader("Connection", "close");
  if (!update) {
    update = {
      error: 'No updates.'
    };
    res.status(404);
  }
  res.send(update);
});

/**
 * Upload new updates
 */

app.post('/upload', auth, function(req, res, next) {
  var tarpath = req.files.update.path;
  console.log('New update received. Extracting contents...');
  exec('tar -xf ' + tarpath + ' -C "' + config.directory + '"', {}, function(err, stdout, stderr) {
    if (err) {
      console.log('Extraction failed.');
      return next(err);
    }
    console.log('Extraction completed.');
    res.send(201, 'Created');
    co(loadUpdates)();
  });
});

/**
 * Reload
 */

app.post('/reload', auth, function(req, res, next) {
  res.send(202);
  co(loadUpdates)();
});

/**
 * Used for monitoring
 */

app.get('/', function(req, res, next) {
  res.sendStatus(200);
});

/**
 * Static route to get updates
 */

app.use('/static', serveIndex(config.directory, { icons: true }));
app.use('/static', express.static(config.directory));

/**
 * Loads the .json update data in a never ending generator loop.
 * This is kinda like setInterval() :D
 */

function* loadUpdatesLoop() {
  while (true) {
    yield loadUpdates();
    yield cleanup();
    yield sleep(ms('1 day'));
  }
}

/**
 * Initialize
 */

co(function*(){
  // set process' title
  process.title = 'auto-update-server';

  // load the .json and apps in the "updates" directory
  co(loadUpdatesLoop)();

  // create HTTP server instance
  var server = http.createServer(app);

  // bind HTTP server to port
  var listen = thunkify(server.listen.bind(server));
  yield listen(parseInt(process.env.PORT, 10) || 3000);
  console.log('auto-update-server HTTP server listening on port %d', server.address().port);
})();
