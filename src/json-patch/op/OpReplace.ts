import type {CompactReplaceOp} from '../codec/compact/types';
import {AbstractOp} from './AbstractOp';
import {OperationReplace} from '../types';
import {find, isObjectReference, isArrayReference, Path, formatJsonPointer} from '../../json-pointer';
import {OPCODE} from '../constants';

/**
 * @category JSON Patch
 */
export class OpReplace extends AbstractOp<'replace'> {
  constructor(path: Path, public readonly value: unknown, public readonly oldValue: unknown) {
    super(path);
  }

  public op() {
    return 'replace' as 'replace';
  }

  public apply(doc: unknown) {
    const ref = find(doc, this.path);
    if (ref.val === undefined) throw new Error('NOT_FOUND');
    if (isObjectReference(ref)) ref.obj[ref.key] = this.value;
    else if (isArrayReference(ref)) ref.obj[ref.key] = this.value;
    else doc = this.value;
    return {doc, old: ref.val};
  }

  public toJson(parent?: AbstractOp): OperationReplace {
    const json: OperationReplace = {
      op: 'replace',
      path: formatJsonPointer(this.path),
      value: this.value,
    };
    if (this.oldValue !== undefined) (json as any).oldValue = this.oldValue;
    return json;
  }

  public toCompact(parent?: AbstractOp): CompactReplaceOp {
    return this.oldValue == undefined
      ? [OPCODE.replace, this.path, this.value]
      : [OPCODE.replace, this.path, this.value, this.oldValue];
  }
}
