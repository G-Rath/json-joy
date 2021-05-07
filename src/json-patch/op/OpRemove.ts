import type {CompactRemoveOp} from '../codec/compact/types';
import {AbstractOp} from './AbstractOp';
import {OperationRemove} from '../types';
import {find, isObjectReference, isArrayReference, Path, formatJsonPointer} from '../../json-pointer';
import {OPCODE} from '../constants';
import {IMessagePackEncoder} from '../../json-pack/Encoder/types';

/**
 * @category JSON Patch
 */
export class OpRemove extends AbstractOp<'remove'> {
  constructor(path: Path, public readonly oldValue: unknown) {
    super(path);
  }

  public op() {
    return 'remove' as 'remove';
  }

  public apply(doc: unknown) {
    const ref = find(doc, this.path);
    if (ref.val === undefined) throw new Error('NOT_FOUND');
    if (isObjectReference(ref)) delete ref.obj[ref.key];
    else if (isArrayReference(ref)) {
      if (ref.val !== undefined) ref.obj.splice(ref.key, 1);
    } else doc = null;
    return {doc, old: ref.val};
  }

  public toJson(parent?: AbstractOp): OperationRemove {
    const json: OperationRemove = {
      op: 'remove',
      path: formatJsonPointer(this.path),
    };
    if (this.oldValue !== undefined) (json as any).oldValue = this.oldValue;
    return json;
  }

  public toCompact(parent?: AbstractOp): CompactRemoveOp {
    return this.oldValue === undefined
      ? [OPCODE.remove, this.path] as CompactRemoveOp
      : [OPCODE.remove, this.path, this.oldValue] as CompactRemoveOp;
  }

  public encode(encoder: IMessagePackEncoder, parent?: AbstractOp) {
    const hasOldValue = this.oldValue === undefined
    encoder.encodeArrayHeader(hasOldValue ? 3 : 2);
    encoder.u8(OPCODE.remove);
    encoder.encodeArray(this.path as unknown[]);
    if (hasOldValue) encoder.encodeAny(this.oldValue);
  }
}
