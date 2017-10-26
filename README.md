# The Server for [Auto Update](https://github.com/cloudup/auto-update)

![](https://i.cloudup.com/l2EgVGwFvB.jpg)

This repository contains the server used to deliver updates to apps using [cloudup/auto-update](https://github.com/cloudup/auto-update). It's written in JavaScript, using node.js, and exposes a very simple HTTP API.

## API Overview

### The `/update` Route

Arguably the most important route on the API. It delivers the latest update that matches all the provided HTTP GET parameters. (In the HTTP response body) Returns 404 otherwise.

Here are the parameters supported:

* `app`: Name of the application being updated. **Required.**
* `appversion`: Version of the application currently installed on the machine.
* `channel`: Update channel the user is currently subscribed to.
* `architecture`: The target CPU architecture of the application.
* `os`: The name of the operating system. **Required.**
* `osversion`: The version of the operating system.
* `percentile`: A number from 0 to 99, that specifies on what percentile of installs the current installation is (Used for staged rollouts).
* `format`: Desired update format (e.g. `zip`, `gz`, `msi`)

The optional parameters are automatically filled in with sensible defaults. (Check the source of the `defaults()` function on [index.js](https://github.com/cloudup/auto-update-server/blob/master/index.js) for more information.)

The latest version is determined using [semver](http://semver.org/).

#### Examples

##### Get the latest version of the app `MyApp` for Mac OS X.

Parameters:

* `app=MyApp`
* `os=osx` 

Resulting route:

    /update?app=MyApp&os=osx

##### Get the last 64-bit version of the app `MyApp` that is compatible with Windows Vista.

Parameters:

* `app=MyApp`
* `os=windows` 
* `osversion=6.0` 
* `architecture=x86-64`

Resulting route:

    /update?app=MyApp&os=windows&osversion=6.0&architecture=x86-64

##### Get the latest beta version of the app `MyApp` for OS X that one can directly update to from version 5.1.0 of the app.

Parameters:

* `app=MyApp`
* `appversion=5.1.0`
* `os=osx` 
* `channel=beta`

Resulting route:

    /update?app=MyApp&appversion=5.1.0&os=osx&channel=beta

### The `/update.json` route

Just like the `/update` route, but returns information about the update in JSON format in the HTTP response body, instead of the update itself.

### The `/upload` route

Upload update data via HTTP POST. Requires authentication.

The update should be contained in a file named `update`. This file must be a valid `tar.gz` file, containing files to be extracted directly on the `updates/` directory.

After uploads, the contents of the `updates/` directory is reloaded.

#### Example

##### Upload update data contained in the `update.tar.gz` file.

```bash
curl -u "$username:$password" -F update=@update.tar.gz http://localhost:3000/upload
```

### The `/reload` route

Reloads all updates contained in the `updates/` directory. Requires authentication.

### The `/static` route

Exposes the updates stored on the server in the `updates/` directory, as static web content.

### The `/` route

Always returns 200. Can be used to monitor the server status via an availability tool.

## Update Data

Updates are stored in the `updates/` directory. The auto-update-server instance will automatically scan this directory as soon as it starts, searching for updates to serve.

Updates are specified via `.json` files, with the following overall format:

```json
{
  "app": "MyApp",
  "version": "1.5.0-300",
  "channels": ["release"],
  "entries": [
    {
      "os": "osx",
      "architectures": ["x86-64"],
      "osversion": " >= 10.6 ",
      "appversion": "*",
      "path": "MyApp-1.5.0-300-osx.tar.gz",
      "format": "gz"
    },
    {
      "os": "windows",
      "architectures": ["x86"],
      "osversion": " >= 5.1 ",
      "appversion": "*",
      "path": "MyApp-1.5.0-300-windows.zip",
      "format": "zip"
    }
  ]
}
```

The JSON above specifies that **MyApp** version **1.5.0** build **300**, is available on the **release** channel. Two files are available for this update: 

* One for users running **OS X**, **Snow Leopard (10.6)** or newer, in **gz** format, stored as **MyApp-1.5.0-300-osx.tar.gz**;
* Other for users running **Windows**, **XP (5.1)** or newer, in **zip** format, stored in **MyApp-1.5.0-300-windows.zip**.

For this update to be served successfully, you'll need the following files in the `updates/` directory:

```
  updates/
    MyApp-1.5.0-300.json
    MyApp-1.5.0-300-osx.tar.gz
    MyApp-1.5.0-300-windows.zip
```

The auto-update-server will also scan in subdirectories, so for organization purposes you might want to abide to the following structure, once you have multiple releases:

```
  updates/
    MyApp-1.5.0-300/
      MyApp-1.5.0-300.json
      MyApp-1.5.0-300-osx.tar.gz
      MyApp-1.5.0-300-windows.zip
    MyApp-1.6.0-450/
      MyApp-1.6.0-450.json
      MyApp-1.6.0-450-osx.tar.gz
      MyApp-1.6.0-450-windows.zip
```

File and directory names are not required to follow any particular structure, so the following is also valid as long as the `.gz` and `.zip` files are correctly specified in the .json file:

```
  updates/
    1.5/
      update.json
      osx.tar.gz
      windows.zip
    1.6/
      update.json
      osx.tar.gz
      windows.zip
```

### Channels

Users can subscribe to different update channels. You can have as many update channels as you want, and an update can belong to multiple update channels. The default update channel is `'release'`.

Here's a possible update channel setup:

* `'release'` channel — Where all production users are.
* `'beta'` channel — Used for QA and testing purposes. You can have enthusiast users, or employees of your company on this channel to test the app before it's released to the general public.
* `'dev'` — Used for continuous integration / dog feeding. You can set up a github hook so that on every push your app is built and uploaded to the update server, and delivered to the machines of all devs within a very short interval.

You can also make your update channels match individual branches on Github. This allows for feature channels.

### Percentage Update Releases

Auto-update-server supports releasing updates for a limited percentage of your user base. This allows for a gradual, controlled release process that can be stopped at any time in case of an urgent issue with the update. (e.g. crash or data corruption)

This is similar to the [staged rollouts](https://support.google.com/googleplay/android-developer/answer/3131213?hl=en) feature of Google Play on Android.

To specify a percentage for your release, use the `"percentage"` option in each entry in your `.json` file:

```json
{
  "app": "MyApp",
  "version": "1.5.0-300",
  "channels": ["release"],
  "entries": [
    {
      "os": "osx",
      "architectures": ["x86-64"],
      "osversion": " >= 10.6 ",
      "appversion": "*",
      "path": "MyApp-1.5.0-300-osx.tar.gz",
      "percentage": 25,
      "format": "gz"
    },
    {
      "os": "windows",
      "architectures": ["x86"],
      "osversion": " >= 5.1 ",
      "appversion": "*",
      "path": "MyApp-1.5.0-300-windows.zip",
      "percentage": 25,
      "format": "zip"
    }
  ]
}
```

The following is a possible/suggested release procedure, using percentage updates:

* Continuously test the app on `'dev'` channel as you work on it, to find bugs early on.
* When the time comes to make a release, upload a version of the app in `'beta'` channel, and have your beta testers do QA tests on it. Repeat this as you find and fix bugs.
* When you're confident that the version in `'beta'` is good to go, add it to `'release'` channel, with a limited percentage. (e.g. 1%, 5% or 10%, depending on your user base size)
* Wait until the initial batch of users has updated. In the unlikely scenario that there's an issue with the release, it will only affect a small percentage of your users, not your entire userbase.
* If no issues are reported, slowly increase the percentage until all your users have updated.

## Contributors

* [@TooTallNate](https://github.com/TooTallNate)
* [@coreh](https://github.com/coreh)
* [@guille](https://github.com/guille)

## License

The MIT License (MIT)

Copyright (c) 2014 Automattic, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## Reference Sheet

### CPU Architectures

* `x86` - Intel x86
* `x86-64` - AMD 64
* `armv6` - ARMv6
* `armv7` - ARMv7

### Operating System Versions

Windows:

* `5.1` - Windows XP
* `5.2` - Windows XP (64-bit)
* `6.0` - Windows Vista
* `6.1` - Windows 7
* `6.2` - Windows 8
* `6.3` - Windows 8.1

OS X:

* `10.5` Leopard
* `10.6` Snow Leopard
* `10.7` Lion
* `10.8` Mountain Lion
* `10.9` Mavericks
