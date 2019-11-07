const crypto = require('crypto');
const fs = require('fs');
const process = require('process');

let cache = {};

async function hashFile(fileName) {
  return new Promise((resolve, reject) => {
    let hash = crypto.createHash('md5');
    let stream = fs.createReadStream(fileName);
    stream.on('error', err => {console.log(`ERROR: ${err}`); reject(err); });
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function hashData(data) {
  const hash = crypto.createHash('md5').update(data).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-` +
    `${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

async function generateUuid(fileName) {
  const hash = await hashFile(fileName);
  cache[fileName] = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-` +
    `${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  return cache[fileName];
}

async function getCurrentScriptUuid() {
  console.log(`getCurrentScriptUuid(): ${typeof window}`);
  if (typeof window === undefined) {
    return await hashData(document.currentScript);
  } else {
    return await generateUuid(process.mainModule.filename);
  }
}

async function overload(obj) {
  try{
    if (obj === undefined) {
      return getCurrentScriptUuid();
    } else if (obj.hasOwnProperty('file')) {
      return await generateUuid(obj.file);
    } else {
      return undefined;
    }
  } catch(e) {
    console.log(`ERROR: ${e}`);
    throw e;
  }
}

module.exports.generateUuid = overload;
