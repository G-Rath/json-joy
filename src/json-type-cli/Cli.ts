import {parseArgs} from 'node:util';
import {TypeSystem} from '../json-type/system/TypeSystem';
import {RoutesBase, TypeRouter} from '../json-type/system/TypeRouter';
import {TypeRouterCaller} from '../reactive-rpc/common/rpc/caller/TypeRouterCaller';
import {bufferToUint8Array} from '../util/buffers/bufferToUint8Array';
import {applyPatch} from '../json-patch';
import {formatError, ingestParams} from './util';
import {find, validateJsonPointer, toPath} from '../json-pointer';
import type {CliCodecs} from './CliCodecs';
import type {Value} from '../reactive-rpc/common/messages/Value';
import type {TypeBuilder} from '../json-type/type/TypeBuilder';
import type {ReadStream} from 'tty';
import type {CliCodec, CliContext, RunOptions} from './types';
import {defineBuiltinRoutes} from './methods';

export interface CliOptions<Router extends TypeRouter<any>> {
  codecs: CliCodecs;
  router?: Router;
  version?: string;
  cmd?: string;
}

export class Cli<Router extends TypeRouter<RoutesBase>> {
  public router: Router;
  public readonly types: TypeSystem;
  public readonly t: TypeBuilder;
  public readonly caller: TypeRouterCaller<Router>;
  public readonly codecs: CliCodecs;

  public constructor(protected readonly options: CliOptions<Router>) {
    let router = options.router ?? (TypeRouter.create() as any);
    router = defineBuiltinRoutes(router);
    this.router = router;
    this.caller = new TypeRouterCaller({router, wrapInternalError: (err) => err});
    this.types = router.system;
    this.t = this.types.t;
    this.codecs = options.codecs;
  }

  public run(options?: RunOptions): void {
    this.runAsync(options);
  }

  public async runAsync(options: Partial<RunOptions> = {}): Promise<void> {
    const argv: string[] = options.argv ?? process.argv.slice(2);
    const stdin = options.stdin ?? process.stdin;
    const stdout = options.stdout ?? process.stdout;
    const stderr = options.stderr ?? process.stderr;
    const exit = options.exit ?? process.exit;
    const opts: RunOptions = {argv, stdin, stdout, stderr, exit};
    try {
      const args = parseArgs({
        args: argv,
        strict: false,
        allowPositionals: true,
      });
      const methodName = args.positionals[0];
      if (args.values.v || args.values.version) {
        this.printVersion(opts);
        return;
      }
      if (args.values.h || args.values.help) {
        this.printHelp(opts);
        return;
      }
      let request = JSON.parse(args.positionals[1] || '{}');
      const {
        format = '',
        stdin: inPath_ = '',
        in: inPath = inPath_,
        stdout: outPath_ = '',
        out: outPath = outPath_,
        ...params
      } = args.values;
      if (inPath) validateJsonPointer(inPath);
      if (outPath) validateJsonPointer(outPath);
      const codecs = this.codecs.getCodecs(format);
      const [requestCodec, responseCodec] = codecs;
      request = await this.ingestStdinInput(stdin, requestCodec, request, String(inPath));
      ingestParams(params, request);
      const ctx: CliContext<Router> = {
        cli: this,
        run: opts,
        codecs,
      };
      try {
        const value = await this.caller.call(methodName, request as any, ctx);
        let response = (value as Value).data;
        if (outPath) response = find(response, toPath(String(outPath))).val;
        const buf = responseCodec.encode(response);
        stdout.write(buf);
      } catch (err) {
        const error = formatError(err);
        const buf = responseCodec.encode(error);
        stderr.write(buf);
        exit(1);
      }
    } catch (err) {
      const error = formatError(err);
      const buf = JSON.stringify(error);
      stderr.write(buf);
      exit(1);
    }
  }

  private async ingestStdinInput(stdin: ReadStream, codec: CliCodec, request: unknown, path: string): Promise<unknown> {
    const input = await this.getStdinValue(stdin, codec);
    if (input === undefined) return request;
    if (path) {
      const res = applyPatch(request, [{op: 'add', path, value: input}], {mutate: true});
      return res.doc;
    }
    if (typeof request === 'object') {
      if (typeof input === 'object') return {...request, ...input};
      return {...request, input};
    }
    return input;
  }

  public cmd(): string {
    return this.options.cmd ?? '<cmd>';
  }

  private printVersion(options: RunOptions): void {
    const version = this.options.version ?? '0.0.0-unknown';
    const stdout = options.stdout ?? process.stdout;
    stdout.write(version + '\n');
  }

  private printHelp(options: RunOptions): void {
    const methods: string[] = Object.keys(this.router.routes).sort();
    const methodLines = methods.map((m) => {
      const route = this.router.routes[m];
      const schema = route.getSchema();
      let line = `* "${m}"`;
      if (schema.title) line += ` - ${schema.title}`;
      return line;
    });
    const cmd = this.cmd();
    const text = `

  JSON Type CLI uses request/response paradigm to execute CLI commands. Each
  command is identified by the <method> name. It receives a JSON object as the
  request payload and returns a JSON object as a response.

  Usage:

    ${cmd} <method> --key=value
    ${cmd} <method> '<json>'
    echo '<json>' | ${cmd} <method>

  Examples:

    ${cmd} util.echo --value=123
    ${cmd} util.echo --value='{"foo":123}'
    echo '{"foo":123}' | ${cmd} util.echo

  Method help:

    ${cmd} .types --format=tree --out=/<method>
    ${cmd} .types --format=tree --out=/<method>/description
    ${cmd} .types --format=tree --out=/<method>/req
    ${cmd} .types --format=tree --out=/<method>/res

  Methods:

    ${methodLines.join('\n    ')}

`;
    const stdout = options.stdout ?? process.stdout;
    stdout.write(text);
  }

  private async getStdin(stdin: ReadStream): Promise<Buffer> {
    if (stdin.isTTY) return Buffer.alloc(0);
    const result = [];
    let length = 0;
    for await (const chunk of stdin) {
      result.push(chunk);
      length += chunk.length;
    }
    return Buffer.concat(result, length);
  }

  private async getStdinValue(stdin: ReadStream, codec: CliCodec): Promise<unknown> {
    if (stdin.isTTY) return Object.create(null);
    const input = await this.getStdin(stdin);
    if (codec.id === 'json') {
      const str = input.toString().trim();
      if (!str) return Object.create(null);
    }
    const uint8 = bufferToUint8Array(input);
    return codec.decode(uint8);
  }
}
