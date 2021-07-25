import {formatError} from "../../../common/rpc";
import {RpcApiCaller} from "../../../common/rpc/RpcApiCaller";
import {createConnectionContext} from "../context";
import {EnableReactiveRpcApiParams, UwsHttpResponse} from "../types";
import {readBody} from "../util";
import {UwsHttpBaseContext} from "./types";
import { parsePayload } from "./util";

export interface EnableHttpPostRcpApiParams<Ctx extends UwsHttpBaseContext> extends EnableReactiveRpcApiParams<Ctx> {
  caller: RpcApiCaller<any, Ctx, unknown>;
}

export const enableHttpPostRpcApi = <Ctx extends UwsHttpBaseContext>(params: EnableHttpPostRcpApiParams<Ctx>) => {
  const {uws, route = '/rpc/*', createContext = createConnectionContext as any, caller} = params;

  if (!route.endsWith('/*'))
    throw new Error('"route" must end with "/*".');

  uws.post(route, (res, req) => {
    const url = req.getUrl();
    const name = url.substr(route.length - 1);
    const ctx = createContext(req, res);
    res.onAborted(() => {
      res.aborted = true;
    });
    readBody(res, (buffer) => {
      processHttpRpcRequest(res, ctx, name, buffer, caller);
    });
  });
};

export const enableHttpGetRpcApi = <Ctx extends UwsHttpBaseContext>(params: EnableHttpPostRcpApiParams<Ctx>) => {
  const {uws, route = '/rpc/*', createContext = createConnectionContext as any, caller} = params;

  if (!route.endsWith('/*'))
    throw new Error('"route" must end with "/*".');

  uws.get(route, (res, req) => {
    const url = req.getUrl();
    const name = url.substr(route.length - 1);
    const query = req.getQuery();
    const params = new URLSearchParams(query);
    const body = String(params.get('a') || 'null');
    const ctx = createContext(req, res);
    res.onAborted(() => {
      res.aborted = true;
    });
    processHttpRpcRequest(res, ctx, name, body, caller);
  });
};

const sendError = (res: UwsHttpResponse, error: unknown, pretty: boolean) => {
  if (res.aborted) return;
  res.cork(() => {
    const errorFormatted = formatError(error);
    const body = JSON.stringify(errorFormatted, null, pretty ? 4 : 0);
    res.writeStatus('400 Bad Request').writeHeader('Content-Type', 'application/json').end(body);
  });
};

function processHttpRpcRequest<Ctx extends UwsHttpBaseContext>(res: UwsHttpResponse, ctx: Ctx, name: string, body: Buffer | string, caller: RpcApiCaller<any, Ctx, unknown>) {
  try {
    const json = parsePayload(ctx, body);
    caller.call(name, json, ctx)
      .then((result) => {
        if (res.aborted) return;
        res.cork(() => {
          const method = caller.get(name);
          const formatted = JSON.stringify(result, null, method.pretty ? 4 : 0);
          res.writeStatus('200 OK').writeHeader('Content-Type', 'application/json').end(formatted);
        });
      })
      .catch((error) => {
        sendError(res, error, caller.get(name).pretty);
      });
  } catch {
    const error = new Error('Could not parse payload');
    sendError(res, error, false);
  }
};