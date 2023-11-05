import {ORIGIN, SESSION} from '../../../json-crdt-patch/constants';
import {ValNode} from '../val/ValNode';
import {Model, UNDEFINED} from '../../model/Model';
import type {ITimestampStruct} from '../../../json-crdt-patch/clock';
import type {JsonNode} from '../types';

/**
 * The root of a JSON CRDT document. {@link RootNode} is a {@link ValNode} with
 * a special `0.0` ID, which is always the same. It is used to represent the
 * root of a document.
 *
 * @category CRDT Node
 */
export class RootNode<Value extends JsonNode = JsonNode> extends ValNode<Value> {
  /**
   * @param val Latest value of the document root.
   */
  constructor(doc: Model<any>, val: ITimestampStruct) {
    super(doc, ORIGIN, val);
  }

  public node(): Value {
    return this.val.sid === SESSION.SYSTEM ? <any>UNDEFINED : super.node();
  }
}