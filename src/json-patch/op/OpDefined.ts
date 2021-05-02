import {AbstractPredicateOp} from './AbstractPredicateOp';
import {OperationDefined} from '../types';
import {find, Path, formatJsonPointer} from '../../json-pointer';
import {OPCODE} from './constants';

/**
 * @category JSON Predicate
 */
export type PackedDefinedOp = [OPCODE.defined, string | Path];

/**
 * @category JSON Predicate
 */
export class OpDefined extends AbstractPredicateOp<'defined'> {
  constructor(path: Path) {
    super('defined', path);
  }

  public test(doc: unknown) {
    const {val} = find(doc, this.path);
    const test = val !== undefined;
    return test;
  }

  public toJson(): OperationDefined {
    const op: OperationDefined = {
      op: this.op,
      path: formatJsonPointer(this.path),
    };
    return op;
  }

  public toPacked(): PackedDefinedOp {
    const packed: PackedDefinedOp = [OPCODE.defined, this.path];
    return packed;
  }
}