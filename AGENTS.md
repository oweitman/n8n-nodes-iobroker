# Repository Guide for Coding Agents

## Purpose

This package provides community nodes that connect n8n workflows to ioBroker over the
ioBroker admin WebSocket API. Preserve the public n8n node names, credential name, parameter
names, and output shapes unless a task explicitly calls for a breaking change.

## Source of Truth

- Authoritative source code lives in `credentials/` and `nodes/`.
- `dist/` is generated, ignored by Git, and must not be edited by hand.
- `package.json` defines the files published to n8n and the complete build pipeline.
- `README.md` documents the user-facing behavior. Update it when operations, parameters,
  compatibility requirements, or output formats change.
- Before editing, run `git status --short`. The working tree may contain user changes; preserve
  them and do not reformat unrelated files.

## Project Layout

- `credentials/IoBrokerApi.credentials.ts`: the `iobrokerApi` credential with `host` and `port`.
- `nodes/Iobroker/IoBrokerRead.node.ts`: regular node for reading states, objects, files, logs,
  rooms, functions, and devices.
- `nodes/Iobroker/IoBrokerOutput.node.ts`: regular node for writing states and objects and for
  emitting log messages. File output is only scaffolded and not implemented.
- `nodes/Iobroker/IoBrokerTrigger.node.ts`: trigger node for state, object, and log events. File
  triggering is scaffolded but disabled.
- `nodes/Iobroker/iobrokerConnection.ts`: shared wrapper around `AdminConnection`; owns socket
  creation, reads/writes, log parsing, enum expansion, instance discovery, and subscriptions.
- `example/workflow/iobroker test.json`: example n8n workflow for manual testing.
- `gulpfile.js`: copies node and credential icons into the generated package.

## Runtime Architecture

All three nodes load the `iobrokerApi` credential and create an `IobrokerConnection`. The wrapper
constructs an `AdminConnection` from `@iobroker/socket-client-backend` and supplies a custom
`SocketClient` transport using `ws`. HTTP-style connection URLs are converted to WebSocket URLs.

Connection setup deliberately uses `doNotLoadAllObjects` and `doNotLoadACL`. After connecting,
`getHosts()` selects the first compact host whose `<host-id>.alive` state is true; log reads then
use that host ID. Changes to connection setup can therefore affect every node and credential tests.

The source currently has no usable disconnect method: `IobrokerConnection.destroy()` is a no-op
because the backend connection exposes no corresponding method. Be especially careful about
creating connections in credential tests, dynamic option loaders, and long-lived triggers.

## Node Contracts

### Read

- Processes each incoming n8n item and returns one result item with `pairedItem` set.
- State and object results are keyed by the requested OID.
- File reads return text content in JSON or non-string content through n8n binary data.
- Log reads return `{ logs: [...] }`; parsing assumes ioBroker's timestamp, ANSI-colored level,
  instance, process, direction marker, and message format.
- Room/function enum reads may localize names, include icons, and remove empty enums.
- Device reads use the system `device` object view rather than enum membership.

### Output

- Object writes require a JSON object.
- State writes first load the target object, require `type === "state"`, and coerce or validate the
  value according to `common.type` (`number`, `boolean`, `string`, or another type).
- Simple state values are written with `ack: false`.
- Log output exists; file output is not implemented.

### Trigger

- Registers handlers for log, state, or object activity and emits n8n items from callbacks.
- The trigger also emits an initial value after registration.
- Keep subscription and close/unsubscription paths paired when changing trigger behavior.
- Verify carefully whether object triggers use the object subscription API; do not assume the
  displayed operation and underlying subscription already match.

## Build and Validation

Use Node.js 20.15 or newer.

```powershell
npm run format
npm run lint
npm run build
```

`npm run build` removes `dist/`, compiles TypeScript, copies icons, and bundles the socket-related
JavaScript with esbuild. `n8n-workflow`, `@iobroker/types`, and `ws` remain external to the bundle;
`@iobroker/socket-client-backend` is bundled for publication.

There is currently no automated test script. For behavior changes, also start n8n with
`npm start`, load the example or a focused workflow, and test against a reachable ioBroker
instance. Exercise both successful and failed credentials when connection lifecycle code changes.

## Dependency Caveat

The development dependency `@iobroker/socket-client-backend` currently points to
`file:../socket-client/backend`. A clean install requires that sibling checkout at the expected
path, or an intentional change to the dependency source. Do not silently replace this local
dependency or regenerate the lockfile with a different source.

## Coding Conventions

- TypeScript is strict, compiled as CommonJS for ES2019, and emits declarations and source maps.
- Formatting uses two spaces, LF endings, single quotes, semicolons, trailing commas, and a
  100-character print width.
- Run formatting only on files in scope; existing files may contain mixed historical formatting.
- Follow n8n's `NodeApiError`/`NodeOperationError`, `continueOnFail()`, and `pairedItem` conventions.
- Await asynchronous ioBroker calls unless the API is intentionally fire-and-forget.
- Treat ioBroker identifiers, translated names, state types, and nullable subscription payloads as
  external input. Preserve fallback behavior and validate before dereferencing.

## Known Risk Areas

- Authentication is not implemented in the credential or connection layer.
- Failed or repeated connections can leak resources because cleanup support is incomplete.
- Socket error values should not be assumed to be strings before using string methods.
- Log parsing is coupled to one textual/ANSI format; malformed lines are discarded.
- Number conversion must reject `NaN`, and boolean conversion should not silently turn arbitrary
  text into `false` when validation is expected.
- Trigger registration, initial emission, and shutdown are asynchronous lifecycle boundaries; test
  them together to avoid duplicate emissions or stale subscriptions.
- The package has no automated regression suite, so do not describe build/lint success as runtime
  validation against ioBroker.
