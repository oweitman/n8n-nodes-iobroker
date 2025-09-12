import {
	type INodeType,
	type INodeTypeDescription,
	type ITriggerFunctions,
	type ITriggerResponse,
	type IDataObject,
	// type IBinaryData,
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
	NodeConnectionType,
	ICredentialTestFunctions,
	ICredentialsDecrypted,
	INodeCredentialTestResult,
} from 'n8n-workflow';
import {} from '@iobroker/types';
import {
	IobrokerConnection,
	type IobLogSubscriptionHandler,
	type IobStateSubscriptionHandler,
	type IobObjectSubscriptionHandler,
	// type IobFileSubscriptionHandler,
} from './iobrokerConnection';

export class IoBrokerTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ioBroker Trigger',
		name: 'ioBrokerTrigger',
		subtitle: '={{$parameter["type"] + ($parameter["oid"] ? " - " + $parameter["oid"] : "")}}',
		group: ['trigger'],
		icon: 'file:ioBroker.svg',
		version: 1,
		description: 'ioBroker Input Trigger',
		defaults: {
			name: 'ioBroker Input Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main], // NodeConnectionType.Main
		credentials: [
			{
				name: 'iobrokerApi',
				required: true,
			},
		],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Type',
				noDataExpression: true,
				name: 'type',
				type: 'options',
				default: 'state',
				required: true,
				options: [
					{
						name: 'State',
						value: 'state',
						description: 'Trigger on the state change',
						action: 'Trigger on the state change',
					},
					{
						name: 'Object',
						value: 'object',
						description: 'Trigger on the object change',
						action: 'Trigger on the object change',
					},
					/* 					{
						name: 'File',
						value: 'file',
						description: 'Trigger on the file change',
						action: 'Trigger on the file change',
					}, */
					{
						name: 'Logs',
						value: 'log',
						description: 'Trigger on the new log entry',
						action: 'Trigger on the new log entry',
					},
				],
				description: 'State, Object, File or Log',
			},
			{
				displayName: 'Object ID',
				name: 'oid',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'Write here the ioBroker object ID',
				description: 'Like javascript.0.myObject',
				displayOptions: {
					show: {
						type: ['state', 'object', 'file'],
					},
				},
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '*',
				required: true,
				placeholder: 'File name or pattern',
				description: 'Like main/vis-views.JSON',
				displayOptions: {
					show: {
						type: ['file'],
					},
				},
			},
			{
				displayName: 'File Name',
				name: 'withContent',
				type: 'boolean',
				default: false,
				description: 'Whether with file content',
				displayOptions: {
					show: {
						type: ['file'],
					},
				},
			},
			{
				displayName: 'Log Level',
				name: 'level',
				type: 'options',
				default: '',
				displayOptions: {
					show: {
						type: ['log'],
					},
				},
				options: [
					{
						name: 'Any',
						value: '',
					},
					{
						name: 'Debug',
						value: 'debug',
					},
					{
						name: 'Error',
						value: 'error',
					},
					{
						name: 'Info',
						value: 'info',
					},
					{
						name: 'Warning',
						value: 'warn',
					},
				],
			},
			{
				displayName: 'Log Instance Name or ID',
				name: 'instance',
				type: 'options',
				default: '',
				placeholder: 'You can filter logs by instance',
				description:
					'Like javascript.0. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: {
					loadOptionsMethod: 'getInstances',
				},
				displayOptions: {
					show: {
						type: ['log'],
					},
				},
			},
		],
	};

	retryOnFail = false;

	methods = {
		loadOptions: {
			async getInstances(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('iobrokerApi');
				const iobConnection = new IobrokerConnection();
				await iobConnection.connect(credentials.host as string, credentials.port as number);
				return await iobConnection.getInstances();
			},
		},
		credentialTest: {
			async sshConnectionTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const credentials = credential.data as IDataObject;
				const iobConnection = new IobrokerConnection();
				try {
					await iobConnection.connect(credentials.host as string, credentials.port as number);
				} catch (error) {
					const message = `Connection error: ${error.message}`;
					return {
						status: 'Error',
						message,
					};
				} finally {
					//await iobConnection.disconnect(); // does not exist
				}
				return {
					status: 'OK',
					message: 'Connection successful!',
				};
			},
		},
	};

	// The function below is responsible for actually doing whatever this node
	// is supposed to do. In this case, we're just appending the `myString` property
	// with whatever the user has entered.
	// You can make async calls and use `await`.
	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		let iobConnection: IobrokerConnection;
		const type = this.getNodeParameter('type') as 'state' | 'object' | 'file' | 'log';
		const logHandler: IobLogSubscriptionHandler = (message?: ioBroker.LogMessage): void => {
			this.emit([[{ json: message as unknown as IDataObject }]]);
		};
		const stateHandler: IobStateSubscriptionHandler = (
			id: string,
			state?: ioBroker.State | null,
		): void => {
			console.log('Triggering on', type, id, state);
			this.emit([[{ json: (state as unknown as IDataObject) || {} }]]);
		};
		const objectHandler: IobObjectSubscriptionHandler = (
			id: string,
			obj?: ioBroker.Object | null,
		): void => {
			console.log('Triggering on object', type, id, obj);
			this.emit([[{ json: (obj as unknown as IDataObject) || {} }]]);
		};
		/* 		const fileHandler: IobFileSubscriptionHandler = (
			id: string,
			fileName: string,
			size?: number | null,
			file?: { file: string | Buffer; mimeType?: string },
		): void => {
			console.log('Triggering on file', type, id, fileName);
			this.emit([
				[
					{
						json: {
							fileName,
							size,
							mimeType: file?.mimeType || undefined,
							content: file && typeof file.file === 'string' ? file.file : undefined,
						},
						binary:
							file?.file && typeof file.file !== 'string'
								? { file: file.file as unknown as IBinaryData }
								: undefined,
					},
				],
			]);
		}; */

		const credentials = await this.getCredentials('iobrokerApi');
		iobConnection = new IobrokerConnection();
		await iobConnection.connect(credentials.host as string, credentials.port as number);

		if (type === 'log') {
			iobConnection.registerLogHandler(logHandler);
		} else if (type === 'state') {
			const oid = this.getNodeParameter('oid') as string;
			iobConnection.registerStateHandler(oid, stateHandler);
		} else if (type === 'object') {
			const oid = this.getNodeParameter('oid') as string;
			iobConnection.registerStateHandler(oid, objectHandler);
		} /* else if (type === 'file') {
			const oid = this.getNodeParameter('oid') as string;
			const fileName = this.getNodeParameter('fileName') as string;
			const withContent = this.getNodeParameter('withContent') as boolean;

			
			iobConnection.registerFileHandler(oid, filePattern, callback);
		} */

		const executeTrigger = async () => {
			const type = this.getNodeParameter('type') as 'state' | 'object' | 'file' | 'log';
			if (type === 'log') {
				const instance = this.getNodeParameter('instance') as string;
				const level = this.getNodeParameter('level') as ioBroker.LogLevel;

				const logs = await iobConnection.getLogs(level, instance, 1);
				const logObj = {
					severity: logs[0].level,
					ts: new Date(logs[0].timestamp).getTime(),
					message: `${logs[0].instance} (${logs[0].process}) ${logs[0].message}`,
					from: 'admin.0',
					_id: 1234,
				};
				this.emit([this.helpers.returnJsonArray(logObj)]);
			} else if (type === 'state') {
				const oid = this.getNodeParameter('oid') as string;
				const state = await iobConnection.getState(oid);
				this.emit([this.helpers.returnJsonArray(state)]);
			} else if (type === 'object') {
				const oid = this.getNodeParameter('oid') as string;
				const object = await iobConnection.getObject(oid);
				this.emit([this.helpers.returnJsonArray(object)]);
			} /* else if (type === 'file') {

			} */
		};
		const node = this;
		async function closeFunction() {
			const type = node.getNodeParameter('type') as 'state' | 'object' | 'file' | 'log';
			if (type === 'log') {
				iobConnection.unregisterLogHandler(logHandler);
			} else if (type === 'state') {
				const oid = node.getNodeParameter('oid') as string;
				iobConnection.unregisterStateHandler(oid);
			} else if (type === 'object') {
				const manual = node.getMode();
				console.log('manual', manual);
				const oid = node.getNodeParameter('oid') as string;
				iobConnection.unregisterObjectHandler(oid);
			} /* else if (type === 'file') {

			} */
		}

		async function manualTriggerFunction() {
			executeTrigger();
		}
		return {
			closeFunction,
			manualTriggerFunction,
		};
	}
}
