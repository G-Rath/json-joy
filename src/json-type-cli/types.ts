import type {RoutesBase, TypeRouter} from '../json-type/system/TypeRouter';
import type {Cli} from './Cli';

export interface CliCodec<Id extends string = string> {
  id: Id;
  description: string;
  encode: (value: unknown) => Uint8Array;
  decode: (bytes: Uint8Array) => unknown;
}

export interface CliContext<Router extends TypeRouter<RoutesBase> = TypeRouter<RoutesBase>> {
  cli: Cli<Router>;
}

export interface CliParam {
  param: string;
  short?: string;
  title: string;
  example?: string;
  examples?: string[];
  createInstance: (cli: Cli, pointer: string, value: unknown) => CliParamInstance;
}

export interface CliParamInstance {
  onParam?: () => Promise<void>;
  onStdin?: () => Promise<void>;
  onRequest?: () => Promise<void>;
  onBeforeCall?: (method: string, ctx: CliContext) => Promise<void>;
  onResponse?: () => Promise<void>;
}