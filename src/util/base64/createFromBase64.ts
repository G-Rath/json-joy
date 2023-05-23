import {alphabet} from './constants';

const E = '=';

export const createFromBase64 = (chars: string = alphabet) => {
  if (chars.length !== 64) throw new Error('chars must be 64 characters long');
  let max = 0;
  for (let i = 0; i < chars.length; i++) max = Math.max(max, chars.charCodeAt(i));
  const table: number[] = [];
  for (let i = 0; i <= max; i += 1) table[i] = -1;
  for (let i = 0; i < chars.length; i++) table[chars.charCodeAt(i)] = i;

  return (encoded: string): Uint8Array => {
    if (!encoded) return new Uint8Array(0);
    const length = encoded.length;
    if (length % 4 !== 0) throw new Error('Base64 string length must be a multiple of 4');
    const mainLength = encoded[length - 1] !== E ? length : length - 4;
    let bufferLength = (length >> 2) * 3;
    let padding = 0;
    if (encoded[length - 2] === E) {
      padding = 2;
      bufferLength -= 2;
    } else if (encoded[length - 1] === E) {
      padding = 1;
      bufferLength -= 1;
    }
    const buf = new Uint8Array(bufferLength);
    let j = 0;
    let i = 0;
    for (; i < mainLength; i += 4) {
      const sextet0 = table[encoded.charCodeAt(i)];
      const sextet1 = table[encoded.charCodeAt(i + 1)];
      const sextet2 = table[encoded.charCodeAt(i + 2)];
      const sextet3 = table[encoded.charCodeAt(i + 3)];
      if (sextet0 < 0 || sextet1 < 0 || sextet2 < 0 || sextet3 < 0) throw new Error('INVALID_BASE64_STRING');
      buf[j] = (sextet0 << 2) | (sextet1 >> 4);
      buf[j + 1] = (sextet1 << 4) | (sextet2 >> 2);
      buf[j + 2] = (sextet2 << 6) | sextet3;
      j += 3;
    }
    if (padding === 2) {
      const sextet0 = table[encoded.charCodeAt(mainLength)];
      const sextet1 = table[encoded.charCodeAt(mainLength + 1)];
      if (sextet0 < 0 || sextet1 < 0) throw new Error('INVALID_BASE64_STRING');
      buf[j] = (sextet0 << 2) | (sextet1 >> 4);
    } else if (padding === 1) {
      const sextet0 = table[encoded.charCodeAt(mainLength)];
      const sextet1 = table[encoded.charCodeAt(mainLength + 1)];
      const sextet2 = table[encoded.charCodeAt(mainLength + 2)];
      if (sextet0 < 0 || sextet1 < 0 || sextet2 < 0) throw new Error('INVALID_BASE64_STRING');
      buf[j] = (sextet0 << 2) | (sextet1 >> 4);
      buf[j + 1] = (sextet1 << 4) | (sextet2 >> 2);
    }
    return buf;
  };
};
