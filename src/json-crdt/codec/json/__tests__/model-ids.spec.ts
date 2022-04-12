import {Model} from '../../../';
import {Encoder} from '../Encoder';
import {Decoder} from '../Decoder';
import {LogicalVectorClock} from '../../../../json-crdt-patch/clock';

const encoder = new Encoder();
const decoder = new Decoder();

test('encoding/decoding a model results in the same node IDs', () => {
  const model1 = Model.withLogicalClock(new LogicalVectorClock(5, 0));
  model1.api.root('').commit();
  expect(model1.toView()).toStrictEqual('');
  model1.api.str([]).ins(0, 'a').commit();
  const encoded1 = encoder.encode(model1);
  const model2 = decoder.decode(encoded1);
  expect(model1.toView()).toStrictEqual('a');
  expect(model2.toView()).toStrictEqual('a');
});

test('forking and encoding/decoding results in the same node IDs', () => {
  const model1 = Model.withLogicalClock(new LogicalVectorClock(3, 0));
  model1.api.root('abc').commit();
  expect(model1.toView()).toStrictEqual('abc');
  const model2 = model1.fork(4);
  const encoded2 = encoder.encode(model2);
  const model3 = decoder.decode(encoded2);
  expect(model1.toView()).toBe('abc');
  expect(model3.toView()).toBe('abc');
  expect(model1.root.id.compare(model3.root.id)).toBe(0);
  expect(model1.api.str([]).node.id.compare(model3.api.str([]).node.id)).toBe(0);
  expect(model1.toString()).toBe(model3.toString());
});
