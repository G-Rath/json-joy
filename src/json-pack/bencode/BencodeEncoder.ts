import {utf8Size} from '../../util/strings/utf8';
import {sort} from '../../util/sort/insertion';
import type {IWriter, IWriterGrowable} from '../../util/buffers';
import type {BinaryJsonEncoder} from '../types';

export class BencodeEncoder implements BinaryJsonEncoder {
  constructor(public readonly writer: IWriter & IWriterGrowable) {}

  public encode(value: unknown): Uint8Array {
    const writer = this.writer;
    writer.reset();
    this.writeAny(value);
    return writer.flush();
  }

  /**
   * Called when the encoder encounters a value that it does not know how to encode.
   *
   * @param value Some JavaScript value.
   */
  public writeUnknown(value: unknown): void {
    this.writeNull();
  }

  public writeAny(value: unknown): void {
    switch (typeof value) {
      case 'boolean':
        return this.writeBoolean(value);
      case 'number':
        return this.writeNumber(value as number);
      case 'string':
        return this.writeStr(value);
      case 'object': {
        if (value === null) return this.writeNull();
        const constructor = value.constructor;
        switch (constructor) {
          case Object:
            return this.writeObj(value as Record<string, unknown>);
          case Array:
            return this.writeArr(value as unknown[]);
          case Uint8Array:
            return this.writeBin(value as Uint8Array);
          default:
            return this.writeUnknown(value);
        }
      }
      case 'bigint': {
        return this.writeBigint(value);
      }
      case 'undefined': {
        return this.writeUndef();
      }
      default:
        return this.writeUnknown(value);
    }
  }

  public writeNull(): void {
    throw new Error('NULL_NOT_SUPPORTED');
  }

  public writeUndef(): void {
    throw new Error('UNDEF_NOT_SUPPORTED');
  }

  public writeBoolean(bool: boolean): void {
    throw new Error('BOOL_NOT_SUPPORTED');
  }

  public writeNumber(num: number): void {
    const writer = this.writer;
    writer.u8(0x69); // 'i'
    writer.ascii(Math.round(num) + '');
    writer.u8(0x65); // 'e'
  }

  public writeInteger(int: number): void {
    const writer = this.writer;
    writer.u8(0x69); // 'i'
    writer.ascii(int + '');
    writer.u8(0x65); // 'e'
  }

  public writeUInteger(uint: number): void {
    this.writeInteger(uint);
  }

  public writeFloat(float: number): void {
    this.writeNumber(float);
  }

  public writeBigint(int: bigint): void {
    const writer = this.writer;
    writer.u8(0x69); // 'i'
    writer.ascii(int + '');
    writer.u8(0x65); // 'e'
  }

  public writeBin(buf: Uint8Array): void {
    const writer = this.writer;
    const length = buf.length;
    writer.ascii(length + '');
    writer.u8(0x3a); // ':'
    writer.buf(buf, length);
  }

  public writeStr(str: string): void {
    const writer = this.writer;
    const length = utf8Size(str);
    writer.ascii(length + '');
    writer.u8(0x3a); // ':'
    writer.ensureCapacity(length);
    writer.utf8(str);
  }

  public writeAsciiStr(str: string): void {
    const writer = this.writer;
    writer.ascii(str.length + '');
    writer.u8(0x3a); // ':'
    writer.ascii(str);
  }

  public writeArr(arr: unknown[]): void {
    const writer = this.writer;
    writer.u8(0x6c); // 'l'
    const length = arr.length;
    for (let i = 0; i < length; i++) this.writeAny(arr[i]);
    writer.u8(0x65); // 'e'
  }

  public writeObj(obj: Record<string, unknown>): void {
    const writer = this.writer;
    writer.u8(0x64); // 'd'
    const keys = sort(Object.keys(obj));
    const length = keys.length;
    for (let i = 0; i < length; i++) {
      const key = keys[i];
      this.writeStr(key);
      this.writeAny(obj[key]);
    }
    writer.u8(0x65); // 'e'
  }
}
