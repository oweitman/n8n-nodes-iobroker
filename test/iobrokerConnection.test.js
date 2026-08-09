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

test('log reads accept ioBroker log variants and apply optional filters', async () => {
  const iobroker = new IobrokerConnection();
  iobroker.currentHost = 'system.host.test';
  iobroker.connection = {
    getLogs: async () => [
      '2026-01-03 13:06:57.287  - \u001b[32minfo\u001b[39m: admin.1 (157) ==> Connected',
      '2026-01-03 13:06:58.287 - warn: javascript.0 (158) Script warning',
      '2026-01-03 13:06:59.287 - error: my-adapter.2 (159) <== Failed request',
      'not an ioBroker log line',
    ],
  };

  const allLogs = await iobroker.getLogs('', '', 200);
  assert.equal(allLogs.length, 3);
  assert.deepEqual(
    allLogs.map(({ level, instance, message }) => ({ level, instance, message })),
    [
      { level: 'info', instance: 'admin.1', message: 'Connected' },
      { level: 'warn', instance: 'javascript.0', message: 'Script warning' },
      { level: 'error', instance: 'my-adapter.2', message: 'Failed request' },
    ],
  );

  const instanceLogs = await iobroker.getLogs('', 'javascript.0', 200);
  assert.equal(instanceLogs.length, 1);
  assert.equal(instanceLogs[0].message, 'Script warning');

  const errorLogs = await iobroker.getLogs('error', '', 200);
  assert.equal(errorLogs.length, 1);
  assert.equal(errorLogs[0].instance, 'my-adapter.2');
});
