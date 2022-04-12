import {Model} from '..';
import {Encoder as EncoderBinary} from '../codec/binary/Encoder';
import {Decoder as DecoderBinary} from '../codec/binary/Decoder';
import {Encoder as EncoderCompact} from '../codec/compact/Encoder';
import {Decoder as DecoderCompact} from '../codec/compact/Decoder';
import {LogicalEncoder as EncoderCompactBinary} from '../codec/compact-binary/LogicalEncoder';
import {LogicalDecoder as DecoderCompactBinary} from '../codec/compact-binary/LogicalDecoder';
import {Encoder as EncoderJson} from '../codec/json/Encoder';
import {Decoder as DecoderJson} from '../codec/json/Decoder';
import {encode as encodePatchBinary} from '../../json-crdt-patch/codec/binary/encode';
import {decode as decodePatchBinary} from '../../json-crdt-patch/codec/binary/decode';
import {encode as encodePatchCompact} from '../../json-crdt-patch/codec/compact/encode';
import {decode as decodePatchCompact} from '../../json-crdt-patch/codec/compact/decode';
import {encode as encodePatchCompactBinary} from '../../json-crdt-patch/codec/compact-binary/encode';
import {decode as decodePatchCompactBinary} from '../../json-crdt-patch/codec/compact-binary/decode';
import {encode as encodePatchJson} from '../../json-crdt-patch/codec/json/encode';
import {decode as decodePatchJson} from '../../json-crdt-patch/codec/json/decode';

const modelCodecs = [
  ['json', new EncoderJson(), new DecoderJson()],
  ['compact', new EncoderCompact(), new DecoderCompact()],
  ['compact-binary', new EncoderCompactBinary(), new DecoderCompactBinary()],
  ['binary', new EncoderBinary(), new DecoderBinary()],
];

const patchCodecs = [
  ['json', encodePatchJson, decodePatchJson],
  ['compact', encodePatchCompact, decodePatchCompact],
  ['compact-binary', encodePatchCompactBinary, decodePatchCompactBinary],
  ['binary', encodePatchBinary, decodePatchBinary],
];

for (const [modelCodecName, encoder, decoder] of modelCodecs) {
  for (const [patchCodecName, encodePatch, decodePatch] of patchCodecs) {
    test(`User 2 edits part which User 1 already deleted, model:${modelCodecName}, patch: ${patchCodecName}`, () => {
      // User 1 creates a JSON block.
      const model1 = Model.withLogicalClock();
      model1.api
        .root({
          '@type': 'todo',
          items: {
            '1': {
              '@type': 'todo-item',
              id: '1',
              name: 'Empty trash',
            },
            '2': {
              '@type': 'todo-item',
              id: '2',
              name: 'Write unit tests',
            },
          },
        })
        .commit();

      expect(model1.toView()).toStrictEqual({
        '@type': 'todo',
        items: {
          '1': {
            '@type': 'todo-item',
            id: '1',
            name: 'Empty trash',
          },
          '2': {
            '@type': 'todo-item',
            id: '2',
            name: 'Write unit tests',
          },
        },
      });

      // User 1 saves the block on the server.
      const encoded1 = (encoder as any).encode((decoder as any).decode((encoder as any).encode(model1)).fork());

      // User 2 loads the block from the server.
      const model2 = (decoder as any).decode((encoder as any).encode((decoder as any).decode(encoded1))).fork();
      expect(model2.toView()).toStrictEqual(model1.toView());

      // User 2 starts their own editing session.
      const model3 = model2.fork();
      const encoded3 = (encoder as any).encode(model3);
      const model4 = (decoder as any).decode(encoded3);
      expect(model4.toView()).toStrictEqual(model1.toView());

      // User 2 edits second todo item.
      model3.api.str(['items', '2', 'name']).del(6, 5).commit();
      expect(model3.toView()).toStrictEqual({
        '@type': 'todo',
        items: {
          '1': {
            '@type': 'todo-item',
            id: '1',
            name: 'Empty trash',
          },
          '2': {
            '@type': 'todo-item',
            id: '2',
            name: 'Write tests',
          },
        },
      });

      // User 2 sends their changes to the server.
      const patches1 = model3.api.flush();
      const batch = patches1.map(encodePatch as any);

      // Server receives User 2's changes.
      const patches2 = batch.map(decodePatch as any);
      expect(patches1).toStrictEqual(patches2);
      const model5 = (decoder as any).decode(encoded1);
      patches2.forEach((patch: any) => {
        model5.applyPatch(patch as any);
      });
      expect(model5.toView()).toStrictEqual({
        '@type': 'todo',
        items: {
          '1': {
            '@type': 'todo-item',
            id: '1',
            name: 'Empty trash',
          },
          '2': {
            '@type': 'todo-item',
            id: '2',
            name: 'Write tests',
          },
        },
      });

      // Server stores latest state using json encoder.
      const encoded5 = (encoder as any).encode(model5);

      // User 1 in parallel removes second todo item.
      model1.api.obj(['items']).del(['2']);
      model1.api
        .obj(['items'])
        .set({
          '3': {
            '@type': 'todo-item',
            id: '3',
            name: 'Plyometrics for the win!',
          },
        })
        .commit();
      expect(model1.toView()).toStrictEqual({
        '@type': 'todo',
        items: {
          '1': {
            '@type': 'todo-item',
            id: '1',
            name: 'Empty trash',
          },
          '3': {
            '@type': 'todo-item',
            id: '3',
            name: 'Plyometrics for the win!',
          },
        },
      });

      // User 1 receives User 2's changes.
      const patches3 = patches1.map(encodePatch as any).map(decodePatch as any);
      patches3.forEach((patch: any) => model1.applyPatch(patch as any));
      expect(model1.toView()).toStrictEqual({
        '@type': 'todo',
        items: {
          '1': {
            '@type': 'todo-item',
            id: '1',
            name: 'Empty trash',
          },
          '3': {
            '@type': 'todo-item',
            id: '3',
            name: 'Plyometrics for the win!',
          },
        },
      });

      // User 1 sends their changes to the server.
      const patches4 = model1.api.flush();
      const batch2 = patches4.map(encodePatch as any);
      const patches5 = batch2.map(decodePatch as any);
      const model6 = (decoder as any).decode(encoded5);
      expect(model6.toView()).toStrictEqual({
        '@type': 'todo',
        items: {
          '1': {
            '@type': 'todo-item',
            id: '1',
            name: 'Empty trash',
          },
          '2': {
            '@type': 'todo-item',
            id: '2',
            name: 'Write tests',
          },
        },
      });
      patches5.forEach((patch) => model6.applyPatch(patch as any));
      expect(model6.toView()).toStrictEqual({
        '@type': 'todo',
        items: {
          '1': {
            '@type': 'todo-item',
            id: '1',
            name: 'Empty trash',
          },
          '3': {
            '@type': 'todo-item',
            id: '3',
            name: 'Plyometrics for the win!',
          },
        },
      });

      // Server sends User 1's changes to User 2.
      const batch3 = patches4.map(encodePatch as any);
      const patches6 = batch3.map(decodePatch as any);
      expect(model3.toView()).toStrictEqual({
        '@type': 'todo',
        items: {
          '1': {
            '@type': 'todo-item',
            id: '1',
            name: 'Empty trash',
          },
          '2': {
            '@type': 'todo-item',
            id: '2',
            name: 'Write tests',
          },
        },
      });
      patches6.forEach((patch) => model3.applyPatch(patch as any));
      expect(model3.toView()).toStrictEqual({
        '@type': 'todo',
        items: {
          '1': {
            '@type': 'todo-item',
            id: '1',
            name: 'Empty trash',
          },
          '3': {
            '@type': 'todo-item',
            id: '3',
            name: 'Plyometrics for the win!',
          },
        },
      });
    });
  }
}