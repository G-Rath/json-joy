/* tslint:disable */

import {spawnSync} from 'child_process';
import {testCases} from './json-pointer-testCases';
const equal = require('fast-deep-equal');

const bin = String(process.argv[2]);

if (!bin) {
  console.error('First argument should be argument to json-patch binary.');
  process.exit(1);
}

console.log('');
console.log(`Running JSON Pointer tests.`);
console.log('');

let cntCorrect = 0;
let cntFailed = 0;

for (const {name, doc, pointer, result, error} of testCases) {
  const {stdout, stderr} = spawnSync(bin, [pointer], {input: JSON.stringify(doc)});
  let isCorrect = false;
  if (error === undefined) {
    isCorrect = equal(result, JSON.parse(stdout.toString()));
  } else {
    const errorMessage = stderr.toString().trim();
    isCorrect = errorMessage === error;
  }
  if (isCorrect) {
    cntCorrect++;
    console.log('✅ ' + name);
  } else {
    cntFailed++;
    console.error('🛑 ' + name);
  }
}

console.log('');
console.log(`Successful = ${cntCorrect}, Failed = ${cntFailed}, Total = ${testCases.length}`);
console.log('');

if (cntFailed > 0) process.exit(1);
