# The Server for [Auto Update](https://github.com/cloudup/auto-update)

[](https://i.cloudup.com/l2EgVGwFvB.jpg)

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

#### Parameter Reference Sheet

##### CPU Architectures

* `x86` - Intel x86
* `x86-64` - AMD 64
* `armv6` - ARMv6
* `armv7` - ARMv7

##### Operating System Versions

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
      "path": "MyApp-1.5.0-300-windows.zip"
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
