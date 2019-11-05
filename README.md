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
      "files": [
        "dist/bundle.js.map"
      ],
      "upload": "http://yolo.sp.backtrace.io:6097/post?format=sourcemap&token=7ca86617fc63e0ae1a708a55eab89f31f68d2c053d69a90657b3c1f121202895&project=cts&universe=cts&symbolication_id=SYMBOLICATION_ID"
    },
```

### Add GUID generation build scripts (optional)
This step is optional, but recommended for readability.

```json
    "generate-uuids": "npx backtrace-sourcemap generate-uuids package.json src/backtrace_uuid.js",
    "upload": "npx backtrace-sourcemap upload-sourcemaps package.json src/backtrace_uuid.js",
```

### Add the generated attribute to the report

```js
const backtrace_uuid = require('../backtrace_uuid');

// ...

const uuid = await backtrace_uuid.getBacktraceUuid();
backtrace.reportSync(error, { symbolication_id: uuid });
```


[1]: https://backtrace.io
