import {json_string} from 'ts-brand-json';
import {LogicalTimestamp, VectorClock} from '../../clock';
import {RelativeTimestamp} from './RelativeTimestamp';

export class ClockEncoder {
  /** Clock session ID to session index. */
  private readonly table: Map<number, number>;
  private index: number;

  public constructor(public readonly clock: VectorClock) {
    this.index = 1;
    this.table = new Map();
    this.table.set(clock.sessionId, this.index++);
  }

  public append(ts: LogicalTimestamp): RelativeTimestamp {
    const {sessionId, time} = ts;
    if (sessionId === 0) return new RelativeTimestamp(0, ts.time);
    const clock = this.clock.clocks.get(sessionId);
    if (!clock) throw new Error(`Clock not found (${sessionId}, ${time}).`);
    if (!this.table.has(sessionId)) this.table.set(sessionId, this.index++);
    const sessionIndex = this.table.get(sessionId)!;
    const timeDiff = clock.time - time;
    const relativeTimestamp = new RelativeTimestamp(sessionIndex, timeDiff);
    return relativeTimestamp;
  }

  public toJson(): number[] {
    const out: number[] = [];
    for (const sessionId of this.table.keys()) {
      const clock = this.clock.clocks.get(sessionId);
      if (!clock) continue;
      out.push(clock.sessionId, clock.time);
    }
    return out;
  }

  /**
   * Every two subsequent numbers represent a single clock. The first clock is
   * the local user's clock.
   * @returns A string of JSON encoded array of numbers representing all the clocks.
   */
  public compact(): json_string<number[]> {
    let isFirst = true;
    let str: string = '[';
    for (const sessionId of this.table.keys()) {
      const clock = this.clock.clocks.get(sessionId);
      if (!clock) continue;
      str += (isFirst ? '' : ',') + clock.compact();
      isFirst = false;
    }
    return (str + ']') as json_string<number[]>;
  }
}
