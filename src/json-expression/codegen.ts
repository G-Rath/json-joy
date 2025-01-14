import * as util from './util';
import {Codegen} from '@jsonjoy.com/util/lib/codegen/Codegen';
import {ExpressionResult, Literal} from './codegen-steps';
import {createEvaluate} from './createEvaluate';
import {JavaScript} from '@jsonjoy.com/util/lib/codegen';
import {Vars} from './Vars';
import type * as types from './types';

export type JsonExpressionFn = (ctx: types.JsonExpressionExecutionContext) => unknown;

export interface JsonExpressionCodegenOptions extends types.JsonExpressionCodegenContext {
  expression: types.Expr;
  operators: types.OperatorMap;
}

export class JsonExpressionCodegen {
  protected codegen: Codegen<JsonExpressionFn>;
  protected evaluate: ReturnType<typeof createEvaluate>;

  public constructor(protected options: JsonExpressionCodegenOptions) {
    this.codegen = new Codegen<JsonExpressionFn>({
      args: ['ctx'],
      prologue: 'var vars = ctx.vars;',
      epilogue: '',
    });
    this.evaluate = createEvaluate({...options});
  }

  private linkedOperandDeps: Set<string> = new Set();
  private linkOperandDeps = (dependency: unknown, name?: string): string => {
    if (name) {
      if (this.linkedOperandDeps.has(name)) return name;
      this.linkedOperandDeps.add(name);
    } else {
      name = this.codegen.getRegister();
    }
    this.codegen.linkDependency(dependency, name);
    return name;
  };

  private operatorConst = (js: JavaScript<unknown>): string => {
    return this.codegen.addConstant(js);
  };

  private subExpression = (expr: types.Expr): ((ctx: types.JsonExpressionExecutionContext) => unknown) => {
    const codegen = new JsonExpressionCodegen({...this.options, expression: expr});
    const fn = codegen.run().compile();
    return fn;
  };

  protected onExpression(expr: types.Expr | unknown): ExpressionResult {
    if (expr instanceof Array) {
      if (expr.length === 1) return new Literal(expr[0]);
    } else return new Literal(expr);

    const def = this.options.operators.get(expr[0]);
    if (def) {
      const [name, , arity, , codegen, impure] = def;
      util.assertArity(name, arity, expr);
      const operands = expr.slice(1).map((operand) => this.onExpression(operand));
      if (!impure) {
        const allLiterals = operands.every((expr) => expr instanceof Literal);
        if (allLiterals) {
          const result = this.evaluate(expr, {vars: new Vars(undefined)});
          return new Literal(result);
        }
      }
      const ctx: types.OperatorCodegenCtx<types.Expression> = {
        expr,
        operands,
        createPattern: this.options.createPattern,
        operand: (operand: types.Expression) => this.onExpression(operand),
        link: this.linkOperandDeps,
        const: this.operatorConst,
        subExpression: this.subExpression,
      };
      return codegen(ctx);
    }
    return new Literal(false);
  }

  public run(): this {
    const expr = this.onExpression(this.options.expression);
    this.codegen.js(`return ${expr};`);
    return this;
  }

  public generate() {
    return this.codegen.generate();
  }

  public compile() {
    const fn = this.codegen.compile();
    return (ctx: types.JsonExpressionExecutionContext) => {
      try {
        return fn(ctx);
      } catch (err) {
        if (err instanceof Error) throw err;
        const error = new Error('Expression evaluation error.');
        (<any>error).value = err;
        throw error;
      }
    };
  }
}
