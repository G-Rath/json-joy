/* tslint:disable */

import {spawnSync} from 'child_process';
import {
  testSuites,
  TestCaseNil,
  TestCaseBool,
  TestCaseString,
  TestCaseNumber,
  TestCaseArray,
  TestCaseMap,
} from './test/msgpack-test-suite';

const bin = String(process.argv[2]);

if (!bin) {
  console.error('First argument should be path to json-pack binary.');
  process.exit(1);
}

console.log('');
console.log(`Running json-pack tests.`);
console.log('');

let cntCorrect = 0;
let cntFailed = 0;

for (const name in testSuites) {
  const testSuite = testSuites[name];
  for (const testCase of testSuite) {
    let json: string = '';
    if (typeof (testCase as TestCaseNil).nil !== 'undefined') {
      const value = (testCase as TestCaseNil).nil;
      json = JSON.stringify(value);
    } else if (typeof (testCase as TestCaseBool).bool !== 'undefined') {
      const value = (testCase as TestCaseBool).bool;
      json = JSON.stringify(value);
    } else if (typeof (testCase as TestCaseString).string !== 'undefined') {
      const value = (testCase as TestCaseString).string;
      json = JSON.stringify(value);
    } else if (typeof (testCase as TestCaseNumber).number !== 'undefined') {
      const value = (testCase as TestCaseNumber).number;
      json = JSON.stringify(value);
    } else if (typeof (testCase as TestCaseArray).array !== 'undefined') {
      const value = (testCase as TestCaseArray).array;
      json = JSON.stringify(value);
    } else if (typeof (testCase as TestCaseMap).map !== 'undefined') {
      const value = (testCase as TestCaseMap).map;
      json = JSON.stringify(value);
    }
    if (!json) continue;
    const {stdout, stderr} = spawnSync(bin, [], {input: json});
    let isCorrect = false;
    const result = new Uint8Array(stdout.byteLength);
    for (let i = 0; i < result.byteLength; i++) result[i] = stdout[i];
    EXPECTED: for (const exp of testCase.msgpack) {
      const expected = new Uint8Array(exp.split('-').map((a) => parseInt(a, 16)));
      if (expected.byteLength !== result.byteLength) continue;
      for (let i = 0; i < expected.byteLength; i++) if (expected[i] !== result[i]) continue EXPECTED;
      isCorrect = true;
      break EXPECTED;
    }
    if (isCorrect) {
      cntCorrect++;
      console.log('✅ ' + name + ' ' + json);
    } else {
      cntFailed++;
      console.error('🛑 ' + name + ' ' + json);
    }
  }
}

console.log('');
console.log(`Successful = ${cntCorrect}, Failed = ${cntFailed}, Total = ${cntCorrect + cntFailed}`);
console.log('');

if (cntFailed > 0) process.exit(1);
