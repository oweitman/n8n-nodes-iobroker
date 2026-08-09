# n8n-nodes-iobroker

Community nodes for **n8n** to integrate **ioBroker** into your workflows:

- event triggers (states/objects/logs),
- reading (states, objects, files, logs, enums), and
- writing (states/objects/logs).

**Attention:**

If you create wrong credentials the acual used iobroker connection code have some glitches and potential memory leaks due of missiong functions (see issues <https://github.com/ioBroker/socket-client/issues>). After you get the right configuration, restart n8n to get rid of this memory leaks.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

**Contents:**

- [Installation](#installation)
- [Supported nodes & operations](#supported-nodes--operations)
- [Credentials](#credentials)
- [Compatibility](#compatibility)
- [Quick start & examples](#quick-start--examples)
- [Resources](#resources)
- [Version history](#version-history)
- [License](#license)

---

## Installation

Follow the official guide for community nodes:
➡️ **[Install n8n community nodes](https://docs.n8n.io/integrations/community-nodes/installation/)**

Then, in n8n go to **Settings → Community Nodes** and add this package.

---

## Supported nodes & operations

This package provides three nodes:

### 1) **ioBroker Trigger** (`ioBrokerTrigger`)

Reacts to ioBroker events and starts your workflow.

- **Type = `state`**: trigger on state changes (by OID)
- **Type = `object`**: trigger on object changes
- **Type = `log`**: trigger on new log entries (optionally filtered by level/instance)
- _(Type `file` is currently disabled)_

### 2) **ioBroker Read** (`ioBrokerRead`)

Reads data from ioBroker.

- **Type = `state`**: read state (`getState`)
- **Type = `object`**: read object (`getObject`)
- **Type = `file`**: read file(s) of an object (`readFile`)
- **Type = `log`**: fetch log messages (`getLogs`)
- **Type = `rooms` / `functions` / `devices`**: read enums in a chosen language; optionally include icons

### 3) **ioBroker Output** (`ioBrokerOutput`)

Writes data to ioBroker.

- **Type = `state`**: set state (with type validation for number/boolean/string/other)
- **Type = `object`**: set object (expects JSON payload)
- **Type = `log`**: write message to ioBroker logs

---

## Credentials

- **protocol** – `http` or `https`
- **host** – hostname or IP of your ioBroker system
- **port** – Admin API/WebSocket port (normally **8081**; may differ by setup)
- **username/password** – optional credentials when authentication is enabled in the ioBroker
  Admin instance

Use **Test connection** in the n8n credential editor to verify the settings. On success you’ll see
**“Connection successful!”** The test stops after 7.5 seconds; regular node connections stop after
15 seconds instead of waiting indefinitely. A timeout without configured credentials points out
that the ioBroker Admin instance may require a username and password.

When username and password are configured, the node requests an OAuth access token from the Admin
instance and uses it for the WebSocket connection. Both fields must be provided together.

---

## Compatibility

- **n8n:** v2.x (tested with 2.33.7)
- **ioBroker:** current stable releases
- **Node.js:** 20.15 or newer

> If your setup differs (reverse proxy, custom ports/adapters), ensure `host`/`port` are reachable by **`IobrokerConnection.connect(host, port)`**.

---

## Quick start & examples

### A) “When a state changes, then …”

1. **ioBroker Trigger**
   - Type: `state`
   - Object ID (OID): `javascript.0.myState`

2. Add any follow-up node (HTTP Request, Email, Slack, …)

**Example output (`state`):**

```json
[
  {
    "val": "777",
    "ack": false,
    "ts": 1756682030035,
    "q": 0,
    "from": "system.adapter.admin.0",
    "user": "system.user.admin",
    "lc": 1756682030035
  }
]
```

### B) Read and filter logs

1. **ioBroker Read**
   - Type: `log`
   - Number of Logs: `50`
   - Log Level: `warn`
   - Instance: `javascript.0`

2. **IF** node: check `{{$json.logs[0].level}} === "warn"`

**Example output (`log`):**

```json
{
  "logs": [
    {
      "line": "2025-01-01 00:00:00.000  - \u001b[32minfo\u001b[39m: admin.0 (157) ==> Connected system.user.admin from ::ffff:192.168.1.232",
      "timestamp": "2025-01-01 00:00:00.000",
      "level": "info",
      "instance": "admin.0",
      "process": "157",
      "message": "Connected system.user.admin from ::ffff:192.168.123.123"
    }
  ]
}
```

### C) Read rooms/functions/devices

**ioBroker Read:**

- Type: `rooms` (or `functions` / `devices`)
- Language: `de`
- With Icons: `true` (rooms/functions only)
- Ignore Empty Items: `true` (rooms/functions only)

**Output (simplified):**

```json
[
  {
    "enums": [
      {
        "id": "enum.rooms.living_room",
        "name": "Livingroom",
        "color": "",
        "items": []
      },
      {
        "id": "enum.rooms.kitchen",
        "name": "Kitchen",
        "color": "",
        "items": [
          {
            "id": "0_userdata.0.test",
            "type": "state",
            "name": "test",
            "stateType": "object",
            "role": "state"
          },
          {
            "id": "alias.0.Devicetest",
            "type": "channel",
            "name": "Devicetest",
            "role": "light"
          }
        ]
      },
      {
        "id": "enum.rooms.kitchen.gym",
        "name": "Gym",
        "color": "",
        "items": []
      }
    ]
  }
]
```

### D) Safe state write (with type checks)

**ioBroker Output:**

- Type: `state`
- OID: `javascript.0.myStateNumber`
- Value: `{"val": 12.5, "ack": false}`
  _(or plain `12.5` — auto-converted if the object has `common.type === "number"`)_

---

## Resources

- n8n: **[Community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)**
- ioBroker: **[Project & docs](https://www.iobroker.net/)** (site/forum)

---

## Version history

- **0.6.0**
  - Added authenticated ioBroker connections using OAuth access tokens
  - Added bounded connection attempts, credential tests, and actionable timeout errors
  - Improved device reads and support for common ioBroker log formats
  - Updated the package for n8n v2

- **0.1.0**
  - Initial public release
  - Nodes: **ioBroker Trigger**, **ioBroker Read**, **ioBroker Output**
  - Trigger: logs/states/objects; Read: states/objects/files/logs/rooms/functions/devices; Output: states/objects/logs
  - `file` trigger/write scaffolded (not enabled yet)
  - This is an alpha release only for testing purpose

---

## License

**MIT** – see `LICENSE`.
