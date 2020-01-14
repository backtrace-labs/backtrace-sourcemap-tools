# backtrace-sourcemap-tools

[Backtrace][1] helper for adding Source Maps support to error reporting.

## Usage

### Add dev dependency

```json
  "devDependencies": {
    "backtrace-sourcemap-tools": "git@github.com:backtrace-labs/backtrace-sourcemap-tools.git"
  }
```

### Add Backtrace options
The upload URL is necessary as well as the list of map files to be uploaded.

Note: the token here is the symbol upload token, not the error reporting token.

Note: `SYMBOLICATION_ID` will be replaced by the uploader script with the
correct value.

```json
  "backtrace": {
    "sourcemap": {
      "upload": "https://<universe>.sp.backtrace.io:6098/post?format=sourcemap&token=<token>&project=<project>&universe=<universe>"
    },
```

### Set up sourcemaps upload

There are two ways of doing this.

#### Upload all artifact .map files

Use `backtrace-sourcemap` with action `upload` and parameters `package.json` and
the build folder (in the example: `./dist`):

```json
    "build": "my current build command && npm run upload",
    "upload": "./node_modules/.bin/backtrace-sourcemap upload package.json dist",
```

#### Set up automatic UUID generation in backtrace-node

```js
var client = bt.initialize({
  endpoint: '...',
  token: '...'
});
client.setSymbolication(); // this line enables automatic UUID generation
```

#### Upload specific files

##### Add files to be uploaded to the .backtrace.sourcemap node in `package.json`.

```json
  "backtrace": {
    "sourcemap": {
      "files": [
        "dist/bundle.js.map"
      ],
    },
```

##### Add GUID generation build scripts (optional)
This step is optional, but recommended for readability.

```json
    "generate-uuids": "npx backtrace-sourcemap generate-uuids package.json src/backtrace_uuid.js",
    "upload": "npx backtrace-sourcemap upload-sourcemaps package.json src/backtrace_uuid.js",
```

##### Add the generated attribute to the report

```js
const backtrace_uuid = require('../backtrace_uuid');

// ...

const uuid = await backtrace_uuid.getBacktraceUuid();
backtrace.reportSync(error, { symbolication_id: uuid });
```


[1]: https://backtrace.io
