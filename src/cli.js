#!/usr/bin/env node

const process = require('process');
const fs = require('fs');
const util = require('util');
const crypto = require('crypto');
const { URL } = require('url');

const f = {
  readFile: util.promisify(fs.readFile),
  writeFile: util.promisify(fs.writeFile),
};

async function loadPackageConfig(file) {
  return JSON.parse(await f.readFile(file));
}

async function generateUuid(file, chunk) {
  const randStr = (len) => crypto.randomBytes(len).toString('hex').toUpperCase();

  return `${randStr(4)}-${randStr(2)}-${randStr(2)}-${randStr(2)}-${randStr(6)}`;
}

async function writeUuidsToJsFile(uuids, file) {
  let fileData =
  "exports.getBacktraceUuid = async function(chunk) {\n" +
  "  const values = { REPLACE_CHUNKS };\n" +
  "  let uuid = values[chunk];\n" +
  "  if (uuid == undefined) uuid = values[Object.keys(values)[0]];\n" +
  "  return uuid;\n" +
  "}\n";

  const replacement = Object.keys(uuids).map(function (k){
    return `'${k}': '${uuids[k]}'`;
  }).join(', ');

  fileData = fileData.replace('REPLACE_CHUNKS', replacement);

  return f.writeFile(file, fileData);
}

async function httpRequest(opts, postData) {
  const http = require(opts.protocol.startsWith('https') ? 'https' : 'http');

  return new Promise(function(resolve, reject) {
    const req = http.request(opts, res => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`Status Code: ${res.statusCode}`));
      }
      const data = [];

      res.on('data', chunk => {
        data.push(chunk);
      });

      res.on('end', () => resolve(Buffer.concat(data).toString()));
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

async function uploadSourceMap(fileName, uuid, url) {
  console.log(`Uploading ${fileName} (${uuid})...`);

  function generateUrl() {
    const symPart = 'symbolication_id=' + uuid;

    if (url.includes('SYMBOLICATION_ID')) {
      url = url.replace('SYMBOLICATION_ID', uuid);
    } else if (url.endsWith('?')) {
      url += symPart;
    } else if (url.includes('?')) {
      url += '&' + symPart;
    } else {
      url += '?' + symPart;
    }
    return new URL(url);
  };
  const parsedUrl = generateUrl();

  const opts = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    protocol: parsedUrl.protocol,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'POST',
  }

  await httpRequest(opts, fs.readFileSync(fileName));
}

async function uploadSourceMaps(uuids, url) {
  for(let file in uuids) {
    await uploadSourceMap(file, uuids[file], url);
  }
}

function fileHash(filename, algorithm = 'md5') {
  return new Promise((resolve, reject) => {
    let shasum = crypto.createHash(algorithm);
    try {
      let s = fs.ReadStream(filename)
      s.on('data', function (data) {
        shasum.update(data)
      })
      s.on('end', function () {
        const hash = shasum.digest('hex')
        return resolve(hash);
      })
    } catch (error) {
      return reject('calc fail');
    }
  });
}

async function handleGenerate(configFile, destFile) {
  if (configFile === undefined || destFile === undefined)
    usage();
  const data = await loadPackageConfig(configFile);
  let uuids = {};
  for(let idx in data.backtrace.sourcemap.files) {
    const file = data.backtrace.sourcemap.files[idx];
    uuids[file] = await generateUuid(file, file);
    fs.writeFileSync('.backtrace_cache', JSON.stringify(uuids));
    console.log(`Writing UUIDs to ${destFile}`);
    await writeUuidsToJsFile(uuids, destFile);
  }
}

async function handleUploadCached(cacheFileName, configFile) {
  if (configFile === undefined)
    usage();
  const data = await loadPackageConfig(configFile);
  let uuids = JSON.parse(fs.readFileSync(cacheFileName));
  console.log(`Uploading Source Maps...`);
  await uploadSourceMaps(uuids, data.backtrace.sourcemap.upload);
}

async function handleUploadGenerate(configFile, dir) {
  const data = await loadPackageConfig(configFile);
  console.error(data.backtrace)
  const url = data.backtrace.sourcemap.upload;
  fs.readdirSync(dir).forEach(async fn =>{
    if (!fn.match(/.*\.map$/))
      return;
    const mapPath = `${dir}/${fn}`
    const jsPath = `${dir}/${fn.replace(/.map$/, '')}`
    const hash = await fileHash(jsPath);
    const uuid = hash.slice( 0,  8) + '-' +
                 hash.slice( 8, 12) + '-' +
                 hash.slice(12, 16) + '-' +
                 hash.slice(16, 20) + '-' +
                 hash.slice(20, 32);
    console.log(`Uploading sourcemap '${mapPath}' with UUID: ${uuid}`);
    await uploadSourceMap(mapPath, uuid, url);
  });
}

async function handleUpload(...params) {
  const cacheFileName = '.backtrace_cache';

  if(fs.existsSync(cacheFileName)) {
    return await handleUploadCached(cacheFileName, ...params);
  } else {
    return await handleUploadGenerate(...params);
  }
}

const handlers = {
  'generate': handleGenerate,
  'upload': handleUpload,
  'upload-cached': handleUploadCached,
  'upload-generate': handleUploadGenerate,
};

function usage() {
  console.error(`usage: ./backtrace-sourcemap ` +
    `[action] [...actionParams]`);
  console.error('');
  console.error('Actions:');
  console.error('generate [config_file] [destination_file]');
  console.error('upload [config_file] [destination_file]');

  process.exit(1);
}

async function main(action, ...params)
{
  try {
    const handler = handlers[action];
    if (handler === undefined)
      usage();

    await handler(...params);
  } catch(e) {
    console.error(`Error: ${e}`);
    throw e;
  }
}

main(...process.argv.slice(2));
