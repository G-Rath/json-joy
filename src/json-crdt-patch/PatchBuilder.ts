import {
  NewConOp,
  NewObjOp,
  NewValOp,
  NewVecOp,
  NewStrOp,
  NewBinOp,
  NewArrOp,
  InsValOp,
  InsObjOp,
  InsVecOp,
  InsStrOp,
  InsBinOp,
  InsArrOp,
  DelOp,
  NopOp,
} from './operations';
import {IClock, ITimestampStruct, ITimespanStruct, ts, Timestamp} from './clock';
import {isUint8Array} from '../util/buffers/isUint8Array';
import {Patch} from './Patch';
import {ORIGIN} from './constants';
import {Tuple} from './builder/Tuple';
import {Konst} from './builder/Konst';
import {DelayedValueBuilder} from './builder/DelayedValueBuilder';

const maybeConst = (x: unknown): boolean => {
  switch (typeof x) {
    case 'number':
    case 'boolean':
      return true;
    default:
      return x === null;
  }
};

/**
 * Utility class that helps in Patch construction.
 *
 * @category Patch
 */
export class PatchBuilder {
  /** The patch being constructed. */
  public patch: Patch;

  /**
   * Creates a new PatchBuilder instance.
   *
   * @param clock Clock to use for generating timestamps.
   */
  constructor(public readonly clock: IClock) {
    this.patch = new Patch();
  }

  /**
   * Retrieve the sequence number of the next timestamp.
   *
   * @returns The next timestamp sequence number that will be used by the builder.
   */
  public nextTime(): number {
    return this.patch.nextTime() || this.clock.time;
  }

  /**
   * Returns the current {@link Patch} instance and resets the builder.
   *
   * @returns A new {@link Patch} instance containing all operations created
   *          using this builder.
   */
  public flush(): Patch {
    const patch = this.patch;
    this.patch = new Patch();
    return patch;
  }

  // --------------------------------------------------------- Basic operations

  /**
   * Create a new "obj" LWW-Map object.
   *
   * @returns ID of the new operation.
   */
  public obj(): ITimestampStruct {
    this.pad();
    const id = this.clock.tick(1);
    this.patch.ops.push(new NewObjOp(id));
    return id;
  }

  /**
   * Create a new "arr" RGA-Array object.
   *
   * @returns ID of the new operation.
   */
  public arr(): ITimestampStruct {
    this.pad();
    const id = this.clock.tick(1);
    this.patch.ops.push(new NewArrOp(id));
    return id;
  }

  /**
   * Create a new "vec" LWW-Array vector.
   *
   * @returns ID of the new operation.
   */
  public vec(): ITimestampStruct {
    this.pad();
    const id = this.clock.tick(1);
    this.patch.ops.push(new NewVecOp(id));
    return id;
  }

  /**
   * Create a new "str" RGA-String object.
   *
   * @returns ID of the new operation.
   */
  public str(): ITimestampStruct {
    this.pad();
    const id = this.clock.tick(1);
    this.patch.ops.push(new NewStrOp(id));
    return id;
  }

  /**
   * Create a new "bin" RGA-Binary object.
   *
   * @returns ID of the new operation.
   */
  public bin(): ITimestampStruct {
    this.pad();
    const id = this.clock.tick(1);
    this.patch.ops.push(new NewBinOp(id));
    return id;
  }

  /**
   * Create a new immutable constant JSON value. Can be anything, including
   * nested arrays and objects.
   *
   * @param value JSON value
   * @returns ID of the new operation.
   */
  public const(value: unknown): ITimestampStruct {
    this.pad();
    const id = this.clock.tick(1);
    this.patch.ops.push(new NewConOp(id, value));
    return id;
  }

  /**
   * Create a new "val" LWW-Register object. Can be anything, including
   * nested arrays and objects.
   *
   * @param val Reference to another object.
   * @returns ID of the new operation.
   */
  public val(val: ITimestampStruct): ITimestampStruct {
    this.pad();
    const id = this.clock.tick(1);
    this.patch.ops.push(new NewValOp(id, val));
    return id;
  }

  /**
   * Set value of document's root LWW-Register.
   *
   * @returns ID of the new operation.
   */
  public root(val: ITimestampStruct): ITimestampStruct {
    this.pad();
    const id = this.clock.tick(1);
    this.patch.ops.push(new InsValOp(id, ORIGIN, val));
    return id;
  }

  /**
   * Set fields of an "obj" object.
   *
   * @returns ID of the new operation.
   * @todo Rename to `insObj`.
   */
  public setKeys(obj: ITimestampStruct, data: [key: string, value: ITimestampStruct][]): ITimestampStruct {
    this.pad();
    if (!data.length) throw new Error('EMPTY_TUPLES');
    const id = this.clock.tick(1);
    const op = new InsObjOp(id, obj, data);
    const span = op.span();
    if (span > 1) this.clock.tick(span - 1);
    this.patch.ops.push(op);
    return id;
  }

  /**
   * Set elements of a "vec" object.
   *
   * @returns ID of the new operation.
   */
  public insVec(obj: ITimestampStruct, data: [index: number, value: ITimestampStruct][]): ITimestampStruct {
    this.pad();
    if (!data.length) throw new Error('EMPTY_TUPLES');
    const id = this.clock.tick(1);
    const op = new InsVecOp(id, obj, data);
    const span = op.span();
    if (span > 1) this.clock.tick(span - 1);
    this.patch.ops.push(op);
    return id;
  }

  /**
   * Set value of a "val" object.
   *
   * @returns ID of the new operation.
   */
  public setVal(obj: ITimestampStruct, val: ITimestampStruct): ITimestampStruct {
    this.pad();
    const id = this.clock.tick(1);
    const op = new InsValOp(id, obj, val);
    this.patch.ops.push(op);
    return id;
  }

  /**
   * Insert a substring into a "str" object.
   *
   * @returns ID of the new operation.
   */
  public insStr(obj: ITimestampStruct, ref: ITimestampStruct, data: string): ITimestampStruct {
    this.pad();
    if (!data.length) throw new Error('EMPTY_STRING');
    const id = this.clock.tick(1);
    const op = new InsStrOp(id, obj, ref, data);
    const span = op.span();
    if (span > 1) this.clock.tick(span - 1);
    this.patch.ops.push(op);
    return id;
  }

  /**
   * Insert binary data into a "bin" object.
   *
   * @returns ID of the new operation.
   */
  public insBin(obj: ITimestampStruct, ref: ITimestampStruct, data: Uint8Array): ITimestampStruct {
    this.pad();
    if (!data.length) throw new Error('EMPTY_BINARY');
    const id = this.clock.tick(1);
    const op = new InsBinOp(id, obj, ref, data);
    const span = op.span();
    if (span > 1) this.clock.tick(span - 1);
    this.patch.ops.push(op);
    return id;
  }

  /**
   * Insert elements into an "arr" object.
   *
   * @returns ID of the new operation.
   */
  public insArr(arr: ITimestampStruct, ref: ITimestampStruct, data: ITimestampStruct[]): ITimestampStruct {
    this.pad();
    const id = this.clock.tick(1);
    const op = new InsArrOp(id, arr, ref, data);
    const span = op.span();
    if (span > 1) this.clock.tick(span - 1);
    this.patch.ops.push(op);
    return id;
  }

  /**
   * Delete a span of operations.
   *
   * @param obj Object in which to delete something.
   * @param what List of time spans to delete.
   * @returns ID of the new operation.
   */
  public del(obj: ITimestampStruct, what: ITimespanStruct[]): ITimestampStruct {
    this.pad();
    const id = this.clock.tick(1);
    this.patch.ops.push(new DelOp(id, obj, what));
    return id;
  }

  /**
   * Operation that does nothing just skips IDs in the patch.
   *
   * @param span Length of the operation.
   * @returns ID of the new operation.
   *
   */
  public nop(span: number) {
    this.pad();
    const id = this.clock.tick(span);
    this.patch.ops.push(new NopOp(id, span));
    return id;
  }

  // --------------------------------------- JSON value construction operations

  /**
   * Run the necessary builder commands to create an arbitrary JSON object.
   */
  public jsonObj(obj: object): ITimestampStruct {
    const id = this.obj();
    const keys = Object.keys(obj);
    if (keys.length) {
      const tuples: [key: string, value: ITimestampStruct][] = [];
      for (const k of keys) {
        const value = (obj as any)[k];
        const valueId = value instanceof Timestamp ? value : maybeConst(value) ? this.const(value) : this.json(value);
        tuples.push([k, valueId]);
      }
      this.setKeys(id, tuples);
    }
    return id;
  }

  /**
   * Run the necessary builder commands to create an arbitrary JSON array.
   */
  public jsonArr(arr: unknown[]): ITimestampStruct {
    const id = this.arr();
    if (arr.length) {
      const values: ITimestampStruct[] = [];
      for (const el of arr) values.push(this.json(el));
      this.insArr(id, id, values);
    }
    return id;
  }

  /**
   * Run builder commands to create a JSON string.
   */
  public jsonStr(str: string): ITimestampStruct {
    const id = this.str();
    if (str) this.insStr(id, id, str);
    return id;
  }

  /**
   * Run builder commands to create a binary data type.
   */
  public jsonBin(bin: Uint8Array): ITimestampStruct {
    const id = this.bin();
    if (bin.length) this.insBin(id, id, bin);
    return id;
  }

  /**
   * Run builder commands to create a JSON value.
   */
  public jsonVal(value: unknown): ITimestampStruct {
    const id = this.const(value);
    return this.val(id);
  }

  /**
   * Run builder commands to create a tuple.
   */
  public jsonVec(vector: unknown[]): ITimestampStruct {
    const id = this.vec();
    const length = vector.length;
    if (length) {
      const writes: [index: number, value: ITimestampStruct][] = [];
      for (let i = 0; i < length; i++) writes.push([i, this.constOrJson(vector[i])]);
      this.insVec(id, writes);
    }
    return id;
  }

  /**
   * Run the necessary builder commands to create any arbitrary JSON value.
   */
  public json(json: unknown): ITimestampStruct {
    if (json instanceof Timestamp) return json;
    if (json === undefined) return this.const(json);
    if (json instanceof Array) return this.jsonArr(json);
    if (isUint8Array(json)) return this.jsonBin(json);
    if (json instanceof Tuple) return this.jsonVec(json.slots);
    if (json instanceof Konst) return this.const(json.val);
    if (json instanceof DelayedValueBuilder) return json.build(this);
    switch (typeof json) {
      case 'object':
        return json === null ? this.jsonVal(json) : this.jsonObj(json!);
      case 'string':
        return this.jsonStr(json);
      case 'number':
      case 'boolean':
        return this.jsonVal(json);
    }
    throw new Error('INVALID_JSON');
  }

  /**
   * Given a JSON `value` creates the necessary builder commands to create
   * JSON CRDT Patch operations to construct the value. If the `value` is a
   * timestamp, it is returned as-is. If the `value` is a JSON primitive is
   * a number, boolean, or `null`, it is converted to a "con" data type. Otherwise,
   * the `value` is converted using the {@link PatchBuilder.json} method.
   *
   * @param value A JSON value for which to create JSON CRDT Patch construction operations.
   * @returns ID of the root constructed CRDT object.
   */
  public constOrJson(value: unknown): ITimestampStruct {
    if (value instanceof Timestamp) return value;
    return maybeConst(value) ? this.const(value) : this.json(value);
  }

  /**
   * Creates a "con" data type unless the value is already a timestamp, in which
   * case it is returned as-is.
   *
   * @param value Value to convert to a "con" data type.
   * @returns ID of the new "con" object.
   */
  public maybeConst(value: unknown | Timestamp): Timestamp {
    return value instanceof Timestamp ? value : this.const(value);
  }

  // ------------------------------------------------------------------ Private

  /**
   * Add padding "noop" operation if clock's time has jumped. This method checks
   * if clock has advanced past the ID of the last operation of the patch and,
   * if so, adds a "noop" operation to the patch to pad the gap.
   */
  public pad() {
    const nextTime = this.patch.nextTime();
    if (!nextTime) return;
    const drift = this.clock.time - nextTime;
    if (drift > 0) {
      const id = ts(this.clock.sid, nextTime);
      const padding = new NopOp(id, drift);
      this.patch.ops.push(padding);
    }
  }
}
