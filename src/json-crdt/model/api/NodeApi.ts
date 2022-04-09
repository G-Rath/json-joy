import {Finder} from './Finder';
import {JsonNode} from '../../types';
import {ModelApi} from './ModelApi';
import {Path} from '../../../json-pointer';

export class NodeApi<Node extends JsonNode, View = unknown> {
  constructor(protected readonly api: ModelApi, protected readonly node: Node) {}

  public find(): Finder;
  public find(path: Path): JsonNode;
  public find(path?: Path): Finder | JsonNode {
    const finder = new Finder(this.node, this.api);
    return path ? finder.find(path) : finder;
  }

  public commit(): void {
    this.api.commit();
  }

  public toView(): View {
    return this.node.toJson() as unknown as View;
  }
}
