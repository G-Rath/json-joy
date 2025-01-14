import * as operations from '../../json-crdt-patch/operations';
import * as clock from '../../json-crdt-patch/clock';
import {ConNode} from '../nodes/const/ConNode';
import {encoder, decoder} from '../codec/structural/binary/shared';
import {JsonCrdtPatchOperation, Patch} from '../../json-crdt-patch/Patch';
import {ModelApi} from './api/ModelApi';
import {ORIGIN, SESSION, SYSTEM_SESSION_TIME} from '../../json-crdt-patch/constants';
import {randomSessionId} from './util';
import {RootNode, ValNode, VecNode, ObjNode, StrNode, BinNode, ArrNode} from '../nodes';
import {SchemaToJsonNode} from '../schema/types';
import {printTree} from '../../util/print/printTree';
import {Extensions} from '../extensions/Extensions';
import {AvlMap} from 'sonic-forest/lib/avl/AvlMap';
import type {JsonNode, JsonNodeView} from '../nodes/types';
import type {Printable} from '../../util/print/types';
import type {NodeBuilder} from '../../json-crdt-patch';
import type {NodeApi} from './api/nodes';

export const UNDEFINED = new ConNode(ORIGIN, undefined);

/**
 * In instance of Model class represents the underlying data structure,
 * i.e. model, of the JSON CRDT document.
 */
export class Model<N extends JsonNode = JsonNode<any>> implements Printable {
  /**
   * Create a CRDT model which uses logical clock. Logical clock assigns a
   * logical timestamp to every node and operation. Logical timestamp consists
   * of a session ID and sequence number 2-tuple. Logical clocks allow to
   * sync peer-to-peer.
   *
   * @param clockOrSessionId Logical clock to use.
   * @returns CRDT model.
   */
  public static withLogicalClock(clockOrSessionId?: clock.ClockVector | number): Model {
    const clockVector =
      typeof clockOrSessionId === 'number'
        ? new clock.ClockVector(clockOrSessionId, 1)
        : clockOrSessionId || new clock.ClockVector(randomSessionId(), 1);
    return new Model(clockVector);
  }

  /**
   * Create a CRDT model which uses server clock. In this model a central server
   * timestamps each operation with a sequence number. Each timestamp consists
   * simply of a sequence number, which was assigned by a server. In this model
   * all operations are approved, persisted and re-distributed to all clients by
   * a central server.
   *
   * @param time Latest known server sequence number.
   * @returns CRDT model.
   */
  public static withServerClock(time: number = 0): Model {
    const clockVector = new clock.ServerClockVector(SESSION.SERVER, time);
    return new Model(clockVector);
  }

  /**
   * Un-serializes a model from "binary" structural encoding.
   * @param data Binary blob of a model encoded using "binary" structural
   *        encoding.
   * @returns An instance of a model.
   */
  public static fromBinary(data: Uint8Array): Model {
    return decoder.decode(data);
  }

  /**
   * Instantiates a model from a collection of patches. The patches are applied
   * to the model in the order they are provided. The session ID of the model is
   * set to the session ID of the first patch.
   *
   * @param patches A collection of initial patches to apply to the model.
   * @returns A model with the patches applied.
   */
  public static fromPatches(patches: Patch[]): Model {
    const length = patches.length;
    if (!length) throw new Error('NO_PATCHES');
    const first = patches[0];
    const sid = first.getId()!.sid;
    if (!sid) throw new Error('NO_SID');
    const model = Model.withLogicalClock(sid);
    model.applyBatch(patches);
    return model;
  }

  /**
   * Root of the JSON document is implemented as Last Write Wins Register,
   * so that the JSON document does not necessarily need to be an object. The
   * JSON document can be any JSON value.
   */
  public root: RootNode<N> = new RootNode<N>(this, ORIGIN);

  /**
   * Clock that keeps track of logical timestamps of the current editing session
   * and logical clocks of all known peers.
   */
  public clock: clock.IClockVector;

  /**
   * Index of all known node objects (objects, array, strings, values)
   * in this document.
   *
   * @ignore
   */
  public index = new AvlMap<clock.ITimestampStruct, JsonNode>(clock.compare);

  /**
   * Extensions to the JSON CRDT protocol. Extensions are used to implement
   * custom data types on top of the JSON CRDT protocol.
   *
   * @ignore
   */
  public ext: Extensions = new Extensions();

  public constructor(clockVector: clock.IClockVector) {
    this.clock = clockVector;
    if (!clockVector.time) clockVector.time = 1;
  }

  /** @ignore */
  private _api?: ModelApi<N>;

  /**
   * API for applying local changes to the current document.
   */
  public get api(): ModelApi<N> {
    if (!this._api) this._api = new ModelApi<N>(this);
    return this._api;
  }

  /**
   * Experimental node retrieval API using proxy objects.
   */
  public get find() {
    return this.api.r.proxy();
  }

  /**
   * Experimental node retrieval API using proxy objects. Returns a strictly
   * typed proxy wrapper around the value of the root node.
   */
  public get s() {
    return this.api.r.proxy().val;
  }

  /**
   * Tracks number of times the `applyPatch` was called.
   *
   * @ignore
   */
  public tick: number = 0;

  /**
   * Applies a batch of patches to the document.
   *
   * @param patches A batch, i.e. an array of patches.
   */
  public applyBatch(patches: Patch[]) {
    const length = patches.length;
    for (let i = 0; i < length; i++) this.applyPatch(patches[i]);
  }

  /**
   * Callback called before every `applyPatch` call.
   */
  public onbeforepatch?: (patch: Patch) => void = undefined;

  /**
   * Callback called after every `applyPatch` call.
   */
  public onpatch?: (patch: Patch) => void = undefined;

  /**
   * Applies a single patch to the document. All mutations to the model must go
   * through this method.
   */
  public applyPatch(patch: Patch) {
    this.onbeforepatch?.(patch);
    const ops = patch.ops;
    const {length} = ops;
    for (let i = 0; i < length; i++) this.applyOperation(ops[i]);
    this.tick++;
    this.onpatch?.(patch);
  }

  /**
   * Applies a single operation to the model. All mutations to the model must go
   * through this method.
   *
   * For advanced use only, better use `applyPatch` instead. You MUST increment
   * the `tick` property and call the necessary event emitters manually.
   *
   * @param op Any JSON CRDT Patch operation
   * @ignore
   * @internal
   */
  public applyOperation(op: JsonCrdtPatchOperation): void {
    this.clock.observe(op.id, op.span());
    const index = this.index;
    if (op instanceof operations.InsStrOp) {
      const node = index.get(op.obj);
      if (node instanceof StrNode) node.ins(op.ref, op.id, op.data);
    } else if (op instanceof operations.NewObjOp) {
      const id = op.id;
      if (!index.get(id)) index.set(id, new ObjNode(this, id));
    } else if (op instanceof operations.NewArrOp) {
      const id = op.id;
      if (!index.get(id)) index.set(id, new ArrNode(this, id));
    } else if (op instanceof operations.NewStrOp) {
      const id = op.id;
      if (!index.get(id)) index.set(id, new StrNode(id));
    } else if (op instanceof operations.NewValOp) {
      const id = op.id;
      if (!index.get(id)) index.set(id, new ValNode(this, id, ORIGIN));
    } else if (op instanceof operations.NewConOp) {
      const id = op.id;
      if (!index.get(id)) index.set(id, new ConNode(id, op.val));
    } else if (op instanceof operations.InsObjOp) {
      const node = index.get(op.obj);
      const tuples = op.data;
      const length = tuples.length;
      if (node instanceof ObjNode) {
        for (let i = 0; i < length; i++) {
          const tuple = tuples[i];
          const valueNode = index.get(tuple[1]);
          if (!valueNode) continue;
          if (node.id.time >= tuple[1].time) continue;
          const old = node.put(tuple[0] + '', valueNode.id);
          if (old) this.deleteNodeTree(old);
        }
      }
    } else if (op instanceof operations.InsVecOp) {
      const node = index.get(op.obj);
      const tuples = op.data;
      const length = tuples.length;
      if (node instanceof VecNode) {
        for (let i = 0; i < length; i++) {
          const tuple = tuples[i];
          const valueNode = index.get(tuple[1]);
          if (!valueNode) continue;
          if (node.id.time >= tuple[1].time) continue;
          const old = node.put(Number(tuple[0]), valueNode.id);
          if (old) this.deleteNodeTree(old);
        }
      }
    } else if (op instanceof operations.InsValOp) {
      const obj = op.obj;
      const node = obj.sid === SESSION.SYSTEM && obj.time === SYSTEM_SESSION_TIME.ORIGIN ? this.root : index.get(obj);
      if (node instanceof ValNode) {
        const newValue = index.get(op.val);
        if (newValue) {
          const old = node.set(op.val);
          if (old) this.deleteNodeTree(old);
        }
      }
    } else if (op instanceof operations.InsArrOp) {
      const node = index.get(op.obj);
      if (node instanceof ArrNode) {
        const nodes: clock.ITimestampStruct[] = [];
        const data = op.data;
        const length = data.length;
        for (let i = 0; i < length; i++) {
          const stamp = data[i];
          const valueNode = index.get(stamp);
          if (!valueNode) continue;
          if (node.id.time >= stamp.time) continue;
          nodes.push(stamp);
        }
        if (nodes.length) node.ins(op.ref, op.id, nodes);
      }
    } else if (op instanceof operations.DelOp) {
      const node = index.get(op.obj);
      if (node instanceof ArrNode) {
        const length = op.what.length;
        for (let i = 0; i < length; i++) {
          const span = op.what[i];
          for (let j = 0; j < span.span; j++) {
            const id = node.getById(new clock.Timestamp(span.sid, span.time + j));
            if (id) this.deleteNodeTree(id);
          }
        }
        node.delete(op.what);
      } else if (node instanceof StrNode) node.delete(op.what);
      else if (node instanceof BinNode) node.delete(op.what);
    } else if (op instanceof operations.NewBinOp) {
      const id = op.id;
      if (!index.get(id)) index.set(id, new BinNode(id));
    } else if (op instanceof operations.InsBinOp) {
      const node = index.get(op.obj);
      if (node instanceof BinNode) node.ins(op.ref, op.id, op.data);
    } else if (op instanceof operations.NewVecOp) {
      const id = op.id;
      if (!index.get(id)) index.set(id, new VecNode(this, id));
    }
  }

  /**
   * Recursively deletes a tree of nodes. Used when root node is overwritten or
   * when object contents of container node (object or array) is removed.
   *
   * @ignore
   */
  protected deleteNodeTree(value: clock.ITimestampStruct) {
    const isSystemNode = value.sid === SESSION.SYSTEM;
    if (isSystemNode) return;
    const node = this.index.get(value);
    if (!node) return;
    const api = node.api;
    if (api) (api as NodeApi).events.handleDelete();
    node.children((child) => this.deleteNodeTree(child.id));
    this.index.del(value);
  }

  /**
   * Creates a copy of this model with a new session ID. If the session ID is
   * not provided, a random session ID is generated.
   *
   * @param sessionId Session ID to use for the new model.
   * @returns A copy of this model with a new session ID.
   */
  public fork(sessionId: number = randomSessionId()): Model<N> {
    const copy = Model.fromBinary(this.toBinary()) as unknown as Model<N>;
    if (copy.clock.sid !== sessionId && copy.clock instanceof clock.ClockVector)
      copy.clock = copy.clock.fork(sessionId);
    copy.ext = this.ext;
    return copy;
  }

  /**
   * Creates a copy of this model with the same session ID.
   *
   * @returns A copy of this model with the same session ID.
   */
  public clone(): Model<N> {
    return this.fork(this.clock.sid);
  }

  /**
   * Callback called before model isi reset using the `.reset()` method.
   */
  public onbeforereset?: () => void = undefined;

  /**
   * Callback called after model has been reset using the `.reset()` method.
   */
  public onreset?: () => void = undefined;

  /**
   * Resets the model to equivalent state of another model.
   */
  public reset(to: Model<N>): void {
    this.onbeforereset?.();
    const index = this.index;
    this.index = new AvlMap<clock.ITimestampStruct, JsonNode>(clock.compare);
    const blob = to.toBinary();
    decoder.decode(blob, <any>this);
    this.clock = to.clock.clone();
    this.ext = to.ext.clone();
    this._api?.flush();
    index.forEach(({v: node}) => {
      const api = node.api as NodeApi | undefined;
      if (!api) return;
      const newNode = this.index.get(node.id);
      if (!newNode) {
        api.events.handleDelete();
        return;
      }
      api.node = newNode;
      newNode.api = api;
    });
    this.tick++;
    this.onreset?.();
  }

  /**
   * Returns the view of the model.
   *
   * @returns JSON/CBOR of the model.
   */
  public view(): Readonly<JsonNodeView<N>> {
    return this.root.view();
  }

  /**
   * Serialize this model using "binary" structural encoding.
   *
   * @returns This model encoded in octets.
   */
  public toBinary(): Uint8Array {
    return encoder.encode(this);
  }

  /**
   * Strictly types the model and sets the default value of the model, if
   * the document is empty.
   *
   * @param schema The schema to set for this model.
   * @returns Strictly typed model.
   */
  public setSchema<S extends NodeBuilder>(schema: S): Model<SchemaToJsonNode<S>> {
    if (this.clock.time < 2) this.api.root(schema);
    return <any>this;
  }

  // ---------------------------------------------------------------- Printable

  public toString(tab: string = ''): string {
    const nl = () => '';
    const hasExtensions = this.ext.size() > 0;
    return (
      'model' +
      printTree(tab, [
        (tab) => this.root.toString(tab),
        nl,
        (tab) => {
          const nodes: JsonNode[] = [];
          this.index.forEach((item) => nodes.push(item.v));
          return (
            `index (${nodes.length} nodes)` +
            (nodes.length
              ? printTree(
                  tab,
                  nodes.map((node) => (tab) => `${node.name()} ${clock.toDisplayString(node.id)}`),
                )
              : '')
          );
        },
        nl,
        (tab) =>
          `view${printTree(tab, [(tab) => String(JSON.stringify(this.view(), null, 2)).replace(/\n/g, '\n' + tab)])}`,
        nl,
        (tab) => this.clock.toString(tab),
        hasExtensions ? nl : null,
        hasExtensions ? (tab) => this.ext.toString(tab) : null,
      ])
    );
  }
}
