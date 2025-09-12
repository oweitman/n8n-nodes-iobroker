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
export function connectIobroker(host: string, port: number): Promise<AdminConnection> {
	return new Promise((resolve, reject) => {
		const iobsocket = new AdminConnection({
			host: host,
			port: port,
			doNotLoadAllObjects: true,
			doNotLoadACL: true,
			onProgress: (progress) => console.log(`Progress: ${progress}`),
			onReady: async (_objects) => {
				resolve(iobsocket);
			},
			onLog: (message) => console.log(`Log: ${message.message}`),
			onError: (error) => {
				console.error(`Error: ${error}`);
			},
			connect: (url: string): any => {
				const socketClient = new SocketClient(); //socket.io
				socketClient.on('reconnect', (error: any) => {
					console.error(`SocketClient error: ${error}`);
				});
				socketClient.on('error', (error: any) => {
					if (error.includes('connection error. too many attempts')) {
						socketClient.destroy();
						reject(error);
					}
				});
				socketClient.connect(url.replace(/^http/, 'ws'), {
					name: 'n8nClient',
					pongTimeout: 10000,
					pingInterval: 5000,
					connectTimeout: 5000,
					authTimeout: 5000,
					connectInterval: 1000,
					connectMaxAttempt: 5,
					WebSocket,
				});
				return socketClient;
			},
		});
	});
}
export function testConnectIobroker(host: string, port: number): Promise<AdminConnection> {
	return new Promise((resolve, reject) => {
		const iobsocket = new AdminConnection({
			host: host,
			port: port,
			doNotLoadAllObjects: true,
			doNotLoadACL: true,
			onProgress: (progress) => console.log(`Progress: ${progress}`),
			onReady: async (_objects) => {
				resolve(iobsocket);
			},
			onLog: (message) => console.log(`Log: ${message.message}`),
			onError: (error) => {
				console.error(`Error: ${error}`);
			},
			connect: (url: string): any => {
				const socketClient = new SocketClient();
				socketClient.on('reconnect', (error: any) => {
					console.error(`SocketClient error: ${error}`);
				});
				socketClient.on('error', (error: any) => {
					if (error.includes('connection error. too many attempts')) {
						socketClient.destroy();
						reject(error);
					}
				});
				socketClient.connect(url.replace(/^http/, 'ws'), {
					name: 'n8nClient',
					pongTimeout: 10000,
					pingInterval: 5000,
					connectTimeout: 5000,
					authTimeout: 5000,
					connectInterval: 1000,
					connectMaxAttempt: 1,
					WebSocket,
				});
				return socketClient;
			},
		});
	});
}
export class IobrokerConnection {
	connection: AdminConnection | null = null;
	connected: boolean = false;
	currentHost = '';
	currentHostname = '';
	public async connect(host: string, port: number): Promise<void> {
		this.connection = await connectIobroker(host, port);
		await this.getHosts();
		this.connected = true;
	}
	public async test(host: string, port: number): Promise<void> {
		this.connection = await testConnectIobroker(host, port);
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
					/^(?<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})  - (?<ansi1>\x1b\[[0-9;]*m)(?<level>info|error|debug|warn)(?<ansi2>\x1b\[[0-9;]*m): (?<instance>\w+\.\d+) \((?<process>\d+)\) (==>|<==|<=>) (?<message>.*$)/gm;
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
				const oneEnum: EnumResponse = {
					id: enumObj._id,
					name:
						(language && enumObj.common
							? this.getText(enumObj.common.name, language)
							: enumObj.common?.name) ||
						enumObj._id.split('.').pop() ||
						'',
					color: enumObj.common.color,
					icon: withIcons ? enumObj.common.icon : undefined,
					items: [],
				};
				result.push(oneEnum);
				if (enumObj?.common?.members) {
					for (const member of enumObj.common.members) {
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
							oneEnum.items.push({
								id: member,
								type: obj.type,
								name:
									(language && obj.common
										? this.getText(obj.common.name, language)
										: obj.common.name) ||
									member.split('.').pop() ||
									'',
								color: obj.common?.color,
								icon: withIcons ? obj.common?.icon : undefined,
								stateType: obj.common?.type,
								min: obj.common?.min,
								max: obj.common?.max,
								unit: obj.common?.unit,
								role: obj.common?.role,
								step: obj.common?.step,
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
	private getText(text: ioBroker.StringOrTranslated, language: ioBroker.Languages): string {
		if (typeof text === 'string') {
			return text;
		}
		return text[language] || text.en || '';
	}
	public destroy(): void {
		//this.connection?.destroy(); // does not exist
	}
}
