import {Anchor} from './constants';
import {Point} from './point/Point';
import {Range} from './slice/Range';
import {printTree} from '../../util/print/printTree';
import {ArrNode, StrNode} from '../../json-crdt/nodes';
import {type ITimestampStruct} from '../../json-crdt-patch/clock';
import type {Model} from '../../json-crdt/model';
import type {Printable} from '../../util/print/types';

export class Peritext implements Printable {
  constructor(
    public readonly model: Model,
    public readonly str: StrNode,
    slices: ArrNode,
  ) {}

  public point(id: ITimestampStruct, anchor: Anchor = Anchor.After): Point {
    return new Point(this, id, anchor);
  }

  public pointAt(pos: number, anchor: Anchor = Anchor.Before): Point {
    const str = this.str;
    const id = str.find(pos);
    if (!id) return this.point(str.id, Anchor.After);
    return this.point(id, anchor);
  }

  public pointAtStart(): Point {
    return this.point(this.str.id, Anchor.After);
  }

  public pointAtEnd(): Point {
    return this.point(this.str.id, Anchor.Before);
  }

  public range(start: Point, end: Point): Range {
    return new Range(this, start, end);
  }

  public rangeAt(start: number, length: number = 0): Range {
    const str = this.str;
    if (!length) {
      const startId = !start ? str.id : str.find(start - 1) || str.id;
      const point = this.point(startId, Anchor.After);
      return this.range(point, point);
    }
    const startId = str.find(start) || str.id;
    const endId = str.find(start + length - 1) || startId;
    const startEndpoint = this.point(startId, Anchor.Before);
    const endEndpoint = this.point(endId, Anchor.After);
    return this.range(startEndpoint, endEndpoint);
  }

  // ---------------------------------------------------------------- Printable

  public toString(tab: string = ''): string {
    const nl = () => '';
    return this.constructor.name + printTree(tab, [(tab) => this.str.toString(tab)]);
  }
}
