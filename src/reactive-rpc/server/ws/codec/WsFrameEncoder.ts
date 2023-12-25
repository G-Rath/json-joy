import {Writer} from "../../../../util/buffers/Writer";
import {WsFrameOpcode} from "./constants";
import type {IWriter, IWriterGrowable} from "../../../../util/buffers";

export class WsFrameEncoder<W extends IWriter & IWriterGrowable = IWriter & IWriterGrowable> {
  constructor(public readonly writer: W = new Writer() as any) {}

  public encodePing(data: Uint8Array | null): Uint8Array {
    this.writePing(data);
    return this.writer.flush();
  }

  public writePing(data: Uint8Array | null): void {
    let length = 0;
    if (data && (length = data.length)) {
      this.writeHeader(1, WsFrameOpcode.PING, length, 0);
      this.writer.buf(data, length);
    } else {
      this.writeHeader(1, WsFrameOpcode.PING, 0, 0);
    }
  }

  public writeHeader(fin: 0 | 1, opcode: WsFrameOpcode, length: number, mask: number): void {
    const octet1 = (fin << 7) | opcode;
    const octet2 = (mask ? 0b10000000 : 0) | (length < 126 ? length : length < 0x10000 ? 126 : 127);
    const writer = this.writer;
    writer.u16((octet1 << 8) | octet2);
    if (length >= 126) {
      if (length < 0x10000) writer.u16(length);
      else {
        writer.u32(0);
        writer.u32(length);
      }
    }
    if (mask) writer.u32(0);
  }
}
