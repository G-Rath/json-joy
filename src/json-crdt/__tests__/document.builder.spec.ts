import {PatchBuilder} from '../../json-crdt-patch/PatchBuilder';
import {Model} from '../model';

describe('Document', () => {
  describe('JSON builder', () => {
    test('can create object using JSON builder', () => {
      const doc = new Model();
      const builder = new PatchBuilder(doc.clock);
      const obj = builder.json({});
      builder.root(obj);
      doc.applyPatch(builder.patch);
      expect(doc.toJson()).toEqual({});
    });

    test('can create complex object', () => {
      const doc = new Model();
      doc.clock.sessionId = 1;
      // doc.clock.time = 10000;
      const builder = new PatchBuilder(doc.clock);
      const json = {
        score: 123,
        arr: [],
        obj: {},
        list: [1, 2.2, true, false, null],
        map: {
          'argentina-jamaica': [5, 0],
        },
      };
      const obj = builder.json(json);
      builder.root(obj);
      doc.applyPatch(builder.patch);
      // console.log(json, JSON.stringify(json), JSON.stringify(json).length);
      // console.log(encode(builder.patch), JSON.stringify(encode(builder.patch)), JSON.stringify(encode(builder.patch)).length);
      // console.log(encode2(builder.patch), JSON.stringify(encode2(builder.patch)), JSON.stringify(encode2(builder.patch)).length);
      // console.log(encode3(builder.patch), encode3(builder.patch).byteLength);
      // console.log(doc.toJson());
      expect(doc.toJson()).toEqual(json);
    });
  });
});
