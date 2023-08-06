import {Model} from '../../../Model';

test('handles ObjectLww inside ValueLww, which was set on ArrayRga', () => {
  const doc = Model.withLogicalClock();
  doc.api.root([123]);
  doc.api.val('/0').set({
    foo: 'bar',
  });
  doc.api.str('/0/foo').ins(3, '!');
  expect(doc.view()).toStrictEqual([{foo: 'bar!'}]);
});
