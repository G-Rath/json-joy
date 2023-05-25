import {TypeAlias} from './TypeAlias';
import {TypeBuilder} from '../type/TypeBuilder';
import {RefType} from '../type/classes';
import {printTree} from '../../util/print/printTree';
import type {CustomValidator} from './types';
import type {Type, TypeMap} from '../type';
import type {Printable} from '../../util/print/types';

export class TypeSystem implements Printable {
  public readonly t = new TypeBuilder(this);

  protected readonly aliases: Map<string, TypeAlias<string, any>> = new Map();

  /**
   * @todo Add ability fetch object of given type by its ID, analogous to
   * GraphQL "nodes".
   */
  public readonly alias = <K extends string, T extends Type>(id: K, type: T): TypeAlias<K, T> => {
    if (this.aliases.has(id)) throw new Error(`Alias [id = ${id}] already exists.`);
    const alias = new TypeAlias<K, T>(this, id, type);
    this.aliases.set(id, alias);
    return alias;
  };

  public importTypes<A extends TypeMap>(
    types: A,
  ): {readonly [K in keyof A]: TypeAlias<K extends string ? K : never, A[K]>} {
    const result = {} as any;
    for (const id in types) result[id] = this.alias(id, types[id]);
    return result;
  }

  public readonly unalias = <K extends string>(id: K): TypeAlias<K, Type> => {
    const alias = this.aliases.get(id);
    if (!alias) throw new Error(`Alias [id = ${id}] not found.`);
    return <TypeAlias<K, Type>>alias;
  };

  public readonly hasAlias = (id: string): boolean => this.aliases.has(id);

  public readonly resolve = <K extends string>(id: K): TypeAlias<K, Type> => {
    const alias = this.unalias(id);
    return alias.type instanceof RefType ? this.resolve<K>(alias.type.getRef() as K) : alias;
  };

  protected readonly customValidators: Map<string, CustomValidator> = new Map();

  public readonly addCustomValidator = (validator: CustomValidator): void => {
    if (this.customValidators.has(validator.name))
      throw new Error(`Validator [name = ${validator.name}] already exists.`);
    this.customValidators.set(validator.name, validator);
  };

  public readonly getCustomValidator = (name: string): CustomValidator => {
    const validator = this.customValidators.get(name);
    if (!validator) throw new Error(`Validator [name = ${name}] not found.`);
    return validator;
  };

  public toString(tab: string = '') {
    const nl = () => '';
    return (
      this.constructor.name +
      printTree(tab, [
        (tab) =>
          'aliases' +
          printTree(
            tab,
            [...this.aliases.values()].map((alias) => (tab) => alias.toString(tab)),
          ),
        this.customValidators.size ? nl : null,
        (tab) =>
          'validators' +
          printTree(
            tab,
            [...this.customValidators.keys()].map((validator) => (tab) => `"${validator}"`),
          ),
      ])
    );
  }
}