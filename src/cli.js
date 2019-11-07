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

function usage() {
  console.error(`usage: ./backtrace-sourcemap ` +
    `[generate-uuids|upload-sourcemaps] <config_file> <destination_file>`);
  process.exit(1);
}

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

async function uploadSourceMap(map, uuid, url) {
  console.log(`Uploading ${map} (${uuid})...`);

  const parsedUrl = new URL(url.replace('SYMBOLICATION_ID', uuid));

  const opts = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    protocol: parsedUrl.protocol,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'POST',
  }

  await httpRequest(opts, fs.readFileSync(map));
}

async function uploadSourceMaps(uuids, url) {
  for(let file in uuids) {
    await uploadSourceMap(file, uuids[file], url);
  }
}

async function main(action, configFile, destFile)
{
  try {
    if (action === undefined)
      usage();

    const data = await loadPackageConfig(configFile);

    if (action == 'generate-uuids') {
      if (configFile === undefined || destFile === undefined || action === undefined)
        usage();
      let uuids = {};
      for(let idx in data.backtrace.sourcemap.files) {
        const file = data.backtrace.sourcemap.files[idx];
        uuids[file] = await generateUuid(file, file);
        fs.writeFileSync('.backtrace_cache', JSON.stringify(uuids));
        console.log(`Writing UUIDs to ${destFile}`);
        await writeUuidsToJsFile(uuids, destFile);
      }
    } else if (action == 'upload-sourcemaps') {
      if (configFile === undefined || destFile === undefined || action === undefined)
        usage();
      let uuids = JSON.parse(fs.readFileSync('.backtrace_cache'));
      console.log(`Uploading Source Maps...`);
      await uploadSourceMaps(uuids, data.backtrace.sourcemap.upload);
    } else if (action == 'upload') {
      if (configFile === undefined || action === undefined)
        usage();
      const gen = require('../index');
      let uuids = {};
      for(let idx in data.backtrace.sourcemap.files) {
        const obj = data.backtrace.sourcemap.files[idx];
        console.log('obj: ' + obj);
        uuids[obj.map] = await gen.generateUuid({ file: obj.source });
        console.log(`Derived UUID for ${obj.source}: ${uuids[obj.map]}`);
      }
      console.log(`Uploading Source Maps...`);
      await uploadSourceMaps(uuids, data.backtrace.sourcemap.upload);
    } else {
      usage();
    }
  } catch(e) {
    console.error(`Error: ${e}`);
    throw e;
  }
}

main(...process.argv.slice(2));
