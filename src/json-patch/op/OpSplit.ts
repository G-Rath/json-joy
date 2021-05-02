import {AbstractOp} from './AbstractOp';
import {OperationSplit, SlateNode, SlateTextNode, SlateElementNode} from '../types';
import {find, isObjectReference, isArrayReference, Path, formatJsonPointer} from '../../json-pointer';
import {isTextNode, isElementNode} from '../util';
import {OPCODE} from './constants';

/**
 * @category JSON Patch Extended
 */
export type PackedSplitOp = [OPCODE.split, string | Path, {i: number; p?: object}];

type Composable = string | number | SlateNode;

/**
 * @category JSON Patch Extended
 */
export class OpSplit extends AbstractOp<'split'> {
  constructor(path: Path, public readonly pos: number, public readonly props: object | null) {
    super('split', path);
  }

  public apply(doc: unknown) {
    const ref = find(doc, this.path);
    if (ref.val === undefined) throw new Error('NOT_FOUND');
    const tuple = this.split(ref.val);
    if (isObjectReference(ref)) ref.obj[ref.key] = tuple;
    else if (isArrayReference(ref)) {
      ref.obj[ref.key] = tuple[0];
      ref.obj.splice(ref.key + 1, 0, tuple[1]);
    } else doc = tuple;
    return {doc, old: ref.val};
  }

  private split<T>(node: T): [T | Composable, T | Composable] {
    if (typeof node === 'string') {
      const {pos, props} = this;
      const before = node.slice(0, pos);
      const after = node.slice(pos);
      if (!props) return [before, after];
      const textNodes: [SlateTextNode, SlateTextNode] = [
        {
          ...props,
          text: before,
        },
        {
          ...props,
          text: after,
        },
      ];
      return textNodes;
    } else if (isTextNode(node)) {
      const {pos, props} = this;
      const before = node.text.slice(0, pos);
      const after = node.text.slice(pos);
      const textNodes: [SlateTextNode, SlateTextNode] = [
        {
          ...node,
          ...props,
          text: before,
        },
        {
          ...node,
          ...props,
          text: after,
        },
      ];
      return textNodes;
    } else if (isElementNode(node)) {
      const {pos, props} = this;
      const before = node.children.slice(0, pos);
      const after = node.children.slice(pos);
      const elementNodes: [SlateElementNode, SlateElementNode] = [
        {
          ...node,
          ...props,
          children: before,
        },
        {
          ...node,
          ...props,
          children: after,
        },
      ];
      return elementNodes;
    } else if (typeof node === 'number') {
      const {pos} = this;
      return [pos, node - pos];
    } else return [node, node];
  }

  public toJson(): OperationSplit {
    const op: OperationSplit = {
      op: this.op,
      path: formatJsonPointer(this.path),
      pos: this.pos,
    };
    if (this.props) op.props = this.props;
    return op;
  }

  public toPacked(): PackedSplitOp {
    const packed: PackedSplitOp = [OPCODE.split, this.path, {i: this.pos}];
    if (this.props) packed[2].p = this.props;
    return packed;
  }
}