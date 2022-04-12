/**
 * A structural snapshot of JSON CRDT model.
 */
export interface JsonCrdtSnapshot {
  /**
   * Vector clock which contains the latest values of all known logical clocks.
   * The first clock is the local clock of this document.
   */
  clock: JsonCrdtServerTimestamp | JsonCrdtLogicalTimestamp[];

  /**
   * Root node of the document data model.
   */
  root: RootJsonCrdtNode;
}

export type JsonCrdtTimestamp = JsonCrdtServerTimestamp | JsonCrdtLogicalTimestamp;

/**
 * A serialized logical clock timestamp.
 */
export type JsonCrdtLogicalTimestamp = [sessionId: number, time: number];

/**
 * A serialized server clock timestamp.
 */
export type JsonCrdtServerTimestamp = number;

/**
 * The root node of the document, implemented as LWW. Only one root node per
 * document is allowed.
 */
export interface RootJsonCrdtNode {
  type: 'root';
  id: JsonCrdtTimestamp;
  node: JsonCrdtNode | null;
}

/**
 * LWW JSON object node.
 */
export interface ObjectJsonCrdtNode {
  type: 'obj';
  id: JsonCrdtTimestamp;
  chunks: Record<string, ObjectJsonCrdtChunk>;
}

export interface ObjectJsonCrdtChunk {
  id: JsonCrdtTimestamp;
  node: JsonCrdtNode;
}

/**
 * RGA JSON array node.
 */
export interface ArrayJsonCrdtNode {
  type: 'arr';
  id: JsonCrdtTimestamp;
  chunks: (ArrayJsonCrdtChunk | JsonCrdtRgaTombstone)[];
}

export interface ArrayJsonCrdtChunk {
  id: JsonCrdtTimestamp;
  nodes: JsonCrdtNode[];
}

/**
 * RGA JSON string node.
 */
export interface StringJsonCrdtNode {
  type: 'str';
  id: JsonCrdtTimestamp;
  chunks: (StringJsonCrdtChunk | JsonCrdtRgaTombstone)[];
}

export interface StringJsonCrdtChunk {
  id: JsonCrdtTimestamp;
  value: string;
}

/**
 * RGA binary node.
 */
export interface BinaryJsonCrdtNode {
  type: 'bin';
  id: JsonCrdtTimestamp;
  chunks: (BinaryJsonCrdtChunk | JsonCrdtRgaTombstone)[];
}

export interface BinaryJsonCrdtChunk {
  id: JsonCrdtTimestamp;
  value: string;
}

/**
 * A tombstone used in RGA nodes.
 */
export interface JsonCrdtRgaTombstone {
  id: JsonCrdtTimestamp;
  span: number;
}

/**
 * LWW register for any JSON value.
 */
export interface ValueJsonCrdtNode {
  type: 'val';
  id: JsonCrdtTimestamp;
  writeId: JsonCrdtTimestamp;
  value: unknown;
}

/**
 * A constant immutable JSON value.
 */
export interface ConstantJsonCrdtNode {
  type: 'const';
  value: unknown;
}

export type JsonCrdtNode =
  | ObjectJsonCrdtNode
  | ArrayJsonCrdtNode
  | StringJsonCrdtNode
  | BinaryJsonCrdtNode
  | ValueJsonCrdtNode
  | ConstantJsonCrdtNode;
