const assert = require('node:assert/strict');
const test = require('node:test');

const { IobrokerConnection } = require('../dist/nodes/Iobroker/iobrokerConnection.js');

test('device reads tolerate missing common data and translated names', async () => {
  const iobroker = new IobrokerConnection();
  iobroker.connection = {
    getObjectViewSystem: async () => ({
      'system.adapter.complete.0': {
        _id: 'system.adapter.complete.0',
        type: 'device',
        common: { name: { en: 'Complete device' } },
      },
      'system.adapter.unnamed.0': {
        _id: 'system.adapter.unnamed.0',
        type: 'device',
        common: {},
      },
      'system.adapter.without-common.0': {
        _id: 'system.adapter.without-common.0',
        type: 'device',
      },
    }),
  };

  const devices = await iobroker.readEnum('devices', 'de');

  assert.deepEqual(
    devices.map(({ id, name }) => ({ id, name })),
    [
      { id: 'system.adapter.complete.0', name: 'Complete device' },
      { id: 'system.adapter.unnamed.0', name: '0' },
      { id: 'system.adapter.without-common.0', name: '0' },
    ],
  );
});
