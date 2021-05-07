import type {CompactMatchesOp} from '../codec/compact/types';
import {AbstractPredicateOp} from './AbstractPredicateOp';
import {OperationMatches} from '../types';
import {find, Path, formatJsonPointer} from '../../json-pointer';
import {OPCODE} from '../constants';
import {AbstractOp} from './AbstractOp';

/**
 * @category JSON Predicate
 */
export class OpMatches extends AbstractPredicateOp<'matches'> {
  // tslint:disable-next-line variable-name
  constructor(path: Path, public readonly value: string, public readonly ignore_case: boolean) {
    super(path);
  }

  public op() {
    return 'matches' as 'matches';
  }

  public test(doc: unknown): boolean {
    const {val} = find(doc, this.path);
    if (typeof val !== 'string') return false;
    const reg = new RegExp(this.value, this.ignore_case ? 'i' : undefined);
    const test = reg.test(val);
    return test;
  }

  public toJson(parent?: AbstractOp): OperationMatches {
    const op: OperationMatches = {
      op: 'matches',
      path: formatJsonPointer(parent ? this.path.slice(parent.path.length) : this.path),
      value: this.value,
    };
    if (this.ignore_case) (op as any).ignore_case = this.ignore_case;
    return op;
  }

  public toCompact(parent?: AbstractOp): CompactMatchesOp {
    const packed: CompactMatchesOp = [OPCODE.matches, this.path, this.value];
    if (this.ignore_case) packed.push(1);
    return packed;
  }
}
