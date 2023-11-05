import {Model} from '../Model';
import type {ConNode, ObjectLww, StringRga} from '../../types';

test('can add TypeScript types to Model view', () => {
  const model = Model.withLogicalClock() as Model<
    ObjectLww<{
      foo: StringRga;
      bar: ConNode<number>;
    }>
  >;
  model.api.root({
    foo: 'asdf',
    bar: 1234,
  });
  const str: string = model.view().foo;
  const num: number = model.view().bar;
  expect(str).toBe('asdf');
  expect(num).toBe(1234);
});
