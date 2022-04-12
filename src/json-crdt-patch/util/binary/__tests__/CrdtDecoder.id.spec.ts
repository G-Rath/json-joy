import {CrdtEncoder} from '../CrdtEncoder';
import {CrdtDecoder} from '../CrdtDecoder';

const encoder = new CrdtEncoder();
const decoder = new CrdtDecoder();
const encode = (a: number, b: number): Uint8Array => {
  encoder.reset();
  encoder.id(a, b);
  return encoder.flush();
};
const decode = (uint8: Uint8Array): [number, number] => {
  decoder.reset(uint8);
  return decoder.id();
};

const ints: [number, number][] = [
  [0, 0],
  [1, 1],
  [1, 2 ** 2 + 1],
  [1, 2 ** 4 + 1],
  [1, 2 ** 5 + 1],
  [1, 2 ** 8 + 1],
  [1, 2 ** 11 + 1],
  [1, 2 ** 13 + 1],
  [2, 2 ** 13 + 1],
  [3, 2 ** 13 + 1],
  [2 ** 3 + 1, 2 ** 13 + 1],
  [2 ** 4 + 1, 2 ** 13 + 1],
  [2 ** 5 + 1, 2 ** 13 + 1],
  [2 ** 8 + 1, 2 ** 13 + 1],
  [2 ** 9 + 1, 2 ** 13 + 1],
  [2 ** 10 + 1, 2 ** 13 + 1],
  [2 ** 10 + 1, 0],
  [2 ** 10 + 1, 1],
];

test('decodes integers correctly', () => {
  for (let i = 0; i < ints.length; i++) {
    const [a, b] = ints[i];
    const [c, d] = decode(encode(a, b));
    expect(a).toBe(c);
    expect(b).toBe(d);
  }
});