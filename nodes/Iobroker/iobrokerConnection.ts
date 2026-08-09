import WebSocket from 'ws';
import { AdminConnection, SocketClient } from '@iobroker/socket-client-backend';

export type EnumItem = {
  id: string;
  name: ioBroker.StringOrTranslated;
  color?: string;
  icon?: string;
  type: ioBroker.ObjectType;
  stateType?: ioBroker.CommonType;
  role?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
};
export type EnumResponse = {
  id: string;
  name: ioBroker.StringOrTranslated;
  color?: string;
  icon?: string;
  items: EnumItem[];
};
export type IobLogSubscriptionHandler = (message: ioBroker.LogMessage) => void;
export type IobLogSubscription = {
  nodeId: string;
  instance?: string;
  level?: ioBroker.LogLevel;
  logHandler?: IobLogSubscriptionHandler;
};
export type IobStateSubscriptionHandler = (id: string, obj?: ioBroker.State | null) => void;
export type IobStateSubscription = {
  nodeId: string;
  oid: string;
  stateHandler: IobStateSubscriptionHandler;
};
export type IobObjectSubscriptionHandler = (id: string, obj?: ioBroker.Object | null) => void;
export type IobObjectSubscription = {
  nodeId: string;
  oid: string;
  objectHandler: IobObjectSubscriptionHandler;
};
export type IobFileSubscriptionHandler = (
  id: string,
  fileName: string,
  size?: number | null,
  file?: { file: string | Buffer; mimeType?: string },
) => void;
export type IobFileSubscription = {
  nodeId: string;
  oid: string;
  fileName?: string;
  withContent?: boolean;
  fileHandler?: IobFileSubscriptionHandler;
};

type IobrokerProtocol = 'http' | 'https';

export function prepareIobrokerNodeEnvironment(
  host: string,
  port: number,
  protocol: IobrokerProtocol,
): void {
  const runtime = globalThis as unknown as { location?: Partial<Location> };
  runtime.location ||= {};
  Object.assign(runtime.location, {
    href: `${protocol}://${host}:${port}/`,
    protocol: `${protocol}:`,
    host: `${host}:${port}`,
    hostname: host,
    port: String(port),
    pathname: '/',
    search: '',
    hash: '',
    reload: runtime.location.reload || (() => undefined),
  });
}

export function getFatalSocketError(error: unknown): Error | undefined {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalizedMessage = message.toLowerCase();
  if (
    normalizedMessage.includes('connection error. too many attempts') ||
    normalizedMessage.includes('authenticate timeout') ||
    normalizedMessage.includes('user not authorized') ||
    normalizedMessage.includes('invalid token')
  ) {
    return new Error(message || 'ioBroker connection failed.');
  }
  return undefined;
}

export function getConnectionTimeoutError(
  host: string,
  port: number,
  timeoutMs: number,
  authenticated: boolean,
): Error {
  const authenticationHint = authenticated
    ? ' Check the username and password.'
    : ' If ioBroker Admin authentication is enabled, enter a username and password.';
  return new Error(
    `ioBroker connection to ${host}:${port} timed out after ${timeoutMs / 1000} seconds.${authenticationHint}`,
  );
}

export async function getIobrokerAccessToken(
  host: string,
  port: number,
  username: string,
  password: string,
  protocol: IobrokerProtocol = 'http',
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!username || !password) {
    throw new Error('Both username and password are required for ioBroker authentication.');
  }

  const body = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
    stayloggedin: 'false',
    client_id: 'ioBroker',
  });
  const response = await fetchImpl(`${protocol}://${host}:${port}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = (await response.json().catch(() => undefined)) as
    { access_token?: string; error?: string; error_description?: string } | undefined;

  if (!response.ok || !data?.access_token) {
    const reason = data?.error_description || data?.error || `HTTP ${response.status}`;
    throw new Error(`ioBroker authentication failed: ${reason}`);
  }

  return data.access_token;
}

export function connectIobroker(
  host: string,
  port: number,
  token?: string,
  protocol: IobrokerProtocol = 'http',
): Promise<AdminConnection> {
  return openIobrokerConnection(host, port, token, protocol, 3, 15000);
}

function openIobrokerConnection(
  host: string,
  port: number,
  token: string | undefined,
  protocol: IobrokerProtocol,
  connectMaxAttempt: number,
  timeoutMs: number,
): Promise<AdminConnection> {
  return new Promise((resolve, reject) => {
    prepareIobrokerNodeEnvironment(host, port, protocol);
    let socketClient: SocketClient | undefined;
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error, connection?: AdminConnection): void => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (error) {
        socketClient?.destroy();
        reject(error);
      } else if (connection) {
        resolve(connection);
      }
    };
    timeout = setTimeout(() => {
      finish(getConnectionTimeoutError(host, port, timeoutMs, Boolean(token)));
    }, timeoutMs);
    const iobsocket = new AdminConnection({
      host: host,
      port: port,
      protocol,
      token,
      doNotLoadAllObjects: true,
      doNotLoadACL: true,
      onProgress: (progress) => console.log(`Progress: ${progress}`),
      onReady: async (_objects) => {
        finish(undefined, iobsocket);
      },
      //onLog: (message) => console.log(`Log: ${message.message}`),
      onError: (error) => {
        console.error(`Error: ${error}`);
        const fatalError = getFatalSocketError(error);
        if (fatalError) finish(fatalError);
      },
      connect: (url: string, options: { token?: string }): any => {
        socketClient = new SocketClient(); //socket.io
        socketClient.on('reconnect', (error: any) => {
          console.error(`SocketClient error: ${error}`);
        });
        socketClient.on('error', (error: any) => {
          const fatalError = getFatalSocketError(error);
          if (fatalError) finish(fatalError);
        });
        socketClient.connect(url.replace(/^http/, 'ws'), {
          name: 'n8nClient',
          pongTimeout: 10000,
          pingInterval: 5000,
          connectTimeout: 5000,
          authTimeout: 5000,
          connectInterval: 1000,
          connectMaxAttempt,
          token: options?.token,
          WebSocket,
        });
        return socketClient;
      },
    });
  });
}

export function testConnectIobroker(
  host: string,
  port: number,
  token?: string,
  protocol: IobrokerProtocol = 'http',
): Promise<AdminConnection> {
  return openIobrokerConnection(host, port, token, protocol, 1, 7500);
}
export class IobrokerConnection {
  connection: AdminConnection | null = null;
  connected: boolean = false;
  currentHost = '';
  currentHostname = '';
  public async connect(
    host: string,
    port: number,
    username = '',
    password = '',
    protocol: IobrokerProtocol = 'http',
  ): Promise<void> {
    const token =
      username || password
        ? await getIobrokerAccessToken(host, port, username, password, protocol)
        : undefined;
    this.connection = await connectIobroker(host, port, token, protocol);
    await this.getHosts();
    this.connected = true;
  }
  public async test(
    host: string,
    port: number,
    username = '',
    password = '',
    protocol: IobrokerProtocol = 'http',
  ): Promise<void> {
    const token =
      username || password
        ? await getIobrokerAccessToken(host, port, username, password, protocol)
        : undefined;
    this.connection = await testConnectIobroker(host, port, token, protocol);
  }

  async getHosts(): Promise<any> {
    const hosts = await this.connection?.getCompactHosts();
    if (hosts !== undefined) {
      for (const host of hosts) {
        let hoststate = await this.connection?.getState(`${host._id}.alive`);
        if (hoststate !== undefined && hoststate !== null) {
          if (hoststate.val === true) {
            this.currentHost = host._id;
            this.currentHostname = host.common.name;
            break;
          }
        }
      }
    }
  }
  public async getObject(oid: string): Promise<any> {
    return this.connection?.getObject(oid);
  }
  public async setObject(oid: string, obj: ioBroker.Object): Promise<any> {
    return this.connection?.setObject(oid, obj);
  }
  public async getState(oid: string): Promise<any> {
    return this.connection?.getState(oid);
  }
  public async setState(
    oid: string,
    val: ioBroker.State | ioBroker.StateValue | ioBroker.SettableState,
  ): Promise<any> {
    return this.connection?.setState(oid, val);
  }
  // 'vis-2.0', '/main/vis-views.json'
  public async readFile(oid: string, filename: string): Promise<any> {
    return this.connection?.readFile(oid, filename);
  }
  public async getLogs(
    level: ioBroker.LogLevel | '',
    instance: string,
    logsCount: number,
  ): Promise<any> {
    let log = await this.connection?.getLogs(this.currentHost, logsCount || 200);
    let logObj: (
      | {
          line: string;
          timestamp: string | undefined;
          level: string | undefined;
          instance: string | undefined;
          process: string | undefined;
          message: string | undefined;
        }
      | undefined
    )[] = [];
    if (Array.isArray(log)) {
      logObj = (log ?? []).map((line) => {
        const regex =
          /^(?<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+-\s+(?:\x1b\[[0-9;]*m)*(?<level>info|error|debug|warn)(?:\x1b\[[0-9;]*m)*:\s+(?<instance>[\w-]+\.\d+)\s+\((?<process>\d+)\)\s*(?:(?:==>|<==|<=>)\s*)?(?<message>.*)$/;
        const match = regex.exec(String(line));
        return !match
          ? undefined
          : {
              line: String(line),
              timestamp: match?.groups?.timestamp,
              level: match?.groups?.level,
              instance: match?.groups?.instance,
              process: match?.groups?.process,
              message: match?.groups?.message,
            };
      });
    }
    if (level) {
      logObj = logObj.filter((obj) => obj?.level === level);
    }
    if (instance) {
      logObj = logObj.filter((obj) => obj?.instance === instance);
    }
    return logObj.filter((obj) => obj);
  }
  public async log(text: string, level: ioBroker.LogLevel): Promise<any> {
    return this.connection?.log(text, level);
  }
  public async getRooms(language?: ioBroker.Languages, withIcons?: boolean): Promise<any[]> {
    const enums = await this.readEnum('rooms', language, withIcons);
    return enums;
  }
  public async readEnum(
    type: string,
    language?: ioBroker.Languages,
    withIcons?: boolean,
  ): Promise<EnumResponse[]> {
    let enums = undefined;
    if (type == 'devices') {
      enums = await this.connection?.getObjectViewSystem('device', '', '\u9999');
    } else {
      enums = await this.connection?.getObjectViewSystem(
        'enum',
        `enum.${type}.`,
        `enum.${type}.\u9999`,
      );
    }
    const result: EnumResponse[] = [];
    const objects: any = {};
    if (enums) {
      let enumsArray = Object.values(enums);
      for (let e = 0; e < enumsArray.length; e++) {
        const enumObj = enumsArray[e];
        if (!enumObj?._id) {
          continue;
        }
        const common = enumObj.common;
        const oneEnum: EnumResponse = {
          id: enumObj._id,
          name: this.getText(common?.name, language) || enumObj._id.split('.').pop() || '',
          color: common?.color,
          icon: withIcons ? common?.icon : undefined,
          items: [],
        };
        result.push(oneEnum);
        if (common?.members) {
          for (const member of common.members) {
            let obj = objects[member];
            if (obj === undefined) {
              try {
                objects[member] = await this.connection?.getObject(member);
              } catch {
                objects[member] = false; // Mark as failed
              }
              obj = objects[member];
            }
            if (obj) {
              const itemCommon = obj.common;
              oneEnum.items.push({
                id: member,
                type: obj.type,
                name: this.getText(itemCommon?.name, language) || member.split('.').pop() || '',
                color: itemCommon?.color,
                icon: withIcons ? itemCommon?.icon : undefined,
                stateType: itemCommon?.type,
                min: itemCommon?.min,
                max: itemCommon?.max,
                unit: itemCommon?.unit,
                role: itemCommon?.role,
                step: itemCommon?.step,
              });
            }
          }
        }
      }
    }

    return result;
  }
  public async registerLogHandler(callback: any): Promise<any> {
    this.connection?.registerLogHandler(callback);
  }
  public async unregisterLogHandler(callback: any): Promise<any> {
    this.connection?.unregisterLogHandler(callback);
  }
  public async registerStateHandler(oid: string, callback: any): Promise<any> {
    this.connection?.subscribeStateAsync(oid, callback);
  }
  public async unregisterStateHandler(oid: string): Promise<any> {
    this.connection?.unsubscribeState(oid);
  }
  public async registerObjectHandler(oid: string, callback: any): Promise<any> {
    this.connection?.subscribeObject(oid, callback);
  }
  public async unregisterObjectHandler(oid: string): Promise<any> {
    this.connection?.unsubscribeObject(oid);
  }
  public async registerFileHandler(
    id: string,
    filePattern: string | string[],
    callback: any,
  ): Promise<any> {
    this.connection?.subscribeFiles(id, filePattern, callback);
  }
  public async unregisterFileHandler(
    id: string,
    filePattern: string | string[],
    callback?: any,
  ): Promise<any> {
    this.connection?.unsubscribeFiles(id, filePattern, callback);
  }
  public async getInstances(): Promise<any> {
    const result = await this.connection?.getObjectViewSystem(
      'instance',
      'system.adapter.',
      'system.adapter.\u9999',
    );
    let instances: { value: string; name: string }[] = [];
    instances.push({
      name: 'Any',
      value: '',
    });
    if (result) {
      let resultArray = Object.values(result);
      resultArray.map((row) => {
        const namespace = row._id.replace('system.adapter.', '');
        let name = this.getText(row.common.titleLang || row.common.title || '', 'en') || namespace;
        const [adapterName, instance] = namespace.split('.');
        if (name === adapterName) {
          name = namespace;
        } else if (!name.includes(instance)) {
          name = `${name} [${namespace}]`;
        }
        instances.push({
          value: row._id.replace('system.adapter.', ''),
          name,
        });
      });
    }
    return instances;
  }
  private getText(
    text: ioBroker.StringOrTranslated | null | undefined,
    language?: ioBroker.Languages,
  ): string {
    if (typeof text === 'string') {
      return text;
    }
    if (!text) {
      return '';
    }
    return (language ? text[language] : undefined) || text.en || '';
  }
  public destroy(): void {
    //this.connection?.destroy(); // does not exist
  }
}
