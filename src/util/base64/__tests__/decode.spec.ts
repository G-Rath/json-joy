import {toBase64} from '../encode';
import {fromBase64, createFromBase64} from '../decode';

const fromBase64_2 = createFromBase64();

const generateBlob = (): Uint8Array => {
  const length = Math.floor(Math.random() * 100);
  const uint8 = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    uint8[i] = Math.floor(Math.random() * 256);
  }
  return uint8;
};

test('works', () => {
  for (let i = 0; i < 100; i++) {
    const blob = generateBlob();
    const encoded = toBase64(blob);
    const decoded1 = fromBase64_2(encoded);
    const decoded2 = fromBase64(encoded);
    expect(decoded1).toEqual(blob);
    expect(decoded2).toEqual(blob);
  }
});
