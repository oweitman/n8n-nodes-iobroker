import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
  IBinaryData,
  ILoadOptionsFunctions,
  INodePropertyOptions,
  JsonObject,
  ICredentialTestFunctions,
  INodeCredentialTestResult,
  ICredentialsDecrypted,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import {} from '@iobroker/types';
import { IobrokerConnection } from './iobrokerConnection';

export class IoBrokerRead implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'ioBroker Read',
    name: 'ioBrokerRead',
    subtitle: '={{$parameter["type"] + ($parameter["oid"] ? " - " + $parameter["oid"] : "")}}',
    group: ['output'],
    icon: 'file:ioBroker.svg',
    version: 1,
    description: 'ioBroker Read',
    defaults: {
      name: 'ioBroker Read',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'iobrokerApi',
        required: true,
        testedBy: 'iobrokerConnectionTest',
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
            name: 'Devices',
            value: 'devices',
            description: 'Read devices',
            action: 'Read devices',
          },
          {
            name: 'File',
            value: 'file',
            description: 'Read file',
            action: 'Read file',
          },
          {
            name: 'Functions',
            value: 'functions',
            description: 'Read functions',
            action: 'Read functions',
          },
          {
            name: 'Logs',
            value: 'log',
            description: 'Read logs',
            action: 'Read logs',
          },
          {
            name: 'Object',
            value: 'object',
            description: 'Read object',
            action: 'Read object',
          },
          {
            name: 'Rooms',
            value: 'rooms',
            description: 'Read rooms',
            action: 'Read rooms',
          },
          {
            name: 'State',
            value: 'state',
            description: 'Read state',
            action: 'Read state',
          },
        ],
        description: 'State, Object, File, Logs, Rooms, Functions or Devices',
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
        displayName: 'Number of Logs',
        name: 'logsCount',
        type: 'number',
        default: 10,
        displayOptions: {
          show: {
            type: ['log'],
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
            value: 'Warn',
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
      {
        displayName: 'Language',
        name: 'language',
        type: 'options',
        default: 'de',
        displayOptions: {
          show: {
            type: ['rooms', 'functions', 'devices'],
          },
        },
        options: [
          {
            name: 'Deutsch',
            value: 'de',
          },
          {
            name: 'English',
            value: 'en',
          },
          {
            name: 'Español',
            value: 'es',
          },
          {
            name: 'Français',
            value: 'fr',
          },
          {
            name: 'Italiano',
            value: 'it',
          },
          {
            name: 'Polski',
            value: 'pl',
          },
          {
            name: 'Português',
            value: 'pt',
          },
          {
            name: 'Русский',
            value: 'ru',
          },
          {
            name: 'Українська',
            value: 'uk',
          },
          {
            name: '中文',
            value: 'zh-cn',
          },
        ],
      },
      {
        displayName: 'With Icons',
        name: 'withIcons',
        default: false,
        type: 'boolean',
        description: 'Whether to deliver objects with icons',
        displayOptions: {
          show: {
            type: ['rooms', 'functions'],
          },
        },
      },
      {
        displayName: 'Ignore Empty Items',
        name: 'ignoreEmptyItems',
        default: false,
        type: 'boolean',
        description: 'Whether to ignore rooms or functions without items',
        displayOptions: {
          show: {
            type: ['rooms', 'functions'],
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
        await iobConnection.connect(
          credentials.host as string,
          credentials.port as number,
          credentials.username as string,
          credentials.password as string,
          credentials.protocol as 'http' | 'https',
        );
        return await iobConnection.getInstances();
      },
    },
    credentialTest: {
      async iobrokerConnectionTest(
        this: ICredentialTestFunctions,
        credential: ICredentialsDecrypted,
      ): Promise<INodeCredentialTestResult> {
        const credentials = credential.data as IDataObject;
        const iobConnection = new IobrokerConnection();
        try {
          await iobConnection.test(
            credentials.host as string,
            credentials.port as number,
            credentials.username as string,
            credentials.password as string,
            credentials.protocol as 'http' | 'https',
          );
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
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    console.log('io node execute');
    const credentials = await this.getCredentials('iobrokerApi');
    const iobConnection = new IobrokerConnection();
    try {
      await iobConnection.connect(
        credentials.host as string,
        credentials.port as number,
        credentials.username as string,
        credentials.password as string,
        credentials.protocol as 'http' | 'https',
      );
    } catch (error) {
      console.error(`Error: ${error}`);
      const connectionError = error instanceof Error ? error.message : String(error);
      throw new NodeApiError(this.getNode(), error as JsonObject, {
        message: `ioBroker connection failed: ${connectionError}`,
        description: 'Check the host, port, protocol, and ioBroker credentials.',
      });
    }

    const items = this.getInputData();

    let type: 'state' | 'object' | 'file' | 'log' | 'rooms' | 'functions' | 'devices' | undefined;

    const result: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        type = this.getNodeParameter('type', itemIndex, '') as
          | 'state'
          | 'object'
          | 'file'
          | 'log'
          | 'rooms'
          | 'functions'
          | 'devices';
        if (type === 'object') {
          const oid = this.getNodeParameter('oid', itemIndex, '') as string;
          const object = await iobConnection.getObject(oid);
          result.push({
            json: { [oid]: (object as unknown as IDataObject) || { error: 'Object not found' } },
            pairedItem: itemIndex,
          });
        } else if (type === 'state') {
          const oid = this.getNodeParameter('oid', itemIndex, '') as string;
          const state = await iobConnection.getState(oid);
          result.push({
            json: { [oid]: (state as unknown as IDataObject) || { error: 'State not found' } },
            pairedItem: itemIndex,
          });
        } else if (type === 'file') {
          const oid = this.getNodeParameter('oid', itemIndex, '') as string;
          const fileName = this.getNodeParameter('fileName', itemIndex, '') as string;
          const file = await iobConnection.readFile(oid, fileName);
          result.push({
            json: {
              fileName,
              mimeType: file?.mimeType || undefined,
              content: file && typeof file.file === 'string' ? file.file : undefined,
            },
            binary:
              file?.file && typeof file.file !== 'string'
                ? { file: file.file as unknown as IBinaryData }
                : undefined,
            pairedItem: itemIndex,
          });
        } else if (type === 'log') {
          const level = this.getNodeParameter('level', itemIndex, '') as ioBroker.LogLevel;
          const instance = this.getNodeParameter('instance', itemIndex, '') as string;
          const logsCount = this.getNodeParameter('logsCount', itemIndex, '') as number;

          const messages = await iobConnection.getLogs(level, instance, logsCount || 200);
          result.push({
            json: { logs: messages },
            pairedItem: itemIndex,
          });
        } else if (type === 'rooms') {
          const language = this.getNodeParameter('language', itemIndex, 'de') as ioBroker.Languages;
          const withIcons = this.getNodeParameter('withIcons', itemIndex, false) as boolean;
          const ignoreEmptyItems = this.getNodeParameter(
            'ignoreEmptyItems',
            itemIndex,
            false,
          ) as boolean;
          const enums = await iobConnection.readEnum('rooms', language, withIcons);
          if (ignoreEmptyItems) {
            result.push({
              json: { enums: enums.filter((e) => e.items.length) },
              pairedItem: itemIndex,
            });
          } else {
            result.push({ json: { enums }, pairedItem: itemIndex });
          }
        } else if (type === 'functions') {
          const language = this.getNodeParameter('language', itemIndex, 'de') as ioBroker.Languages;
          const withIcons = this.getNodeParameter('withIcons', itemIndex, false) as boolean;
          const ignoreEmptyItems = this.getNodeParameter(
            'ignoreEmptyItems',
            itemIndex,
            false,
          ) as boolean;
          const enums = await iobConnection.readEnum('functions', language, withIcons);
          if (ignoreEmptyItems) {
            result.push({
              json: { enums: enums.filter((e) => e.items.length) },
              pairedItem: itemIndex,
            });
          } else {
            result.push({ json: { enums }, pairedItem: itemIndex });
          }
        } else if (type === 'devices') {
          console.log('iob read execute devices start');
          const language = this.getNodeParameter('language', itemIndex, 'de') as ioBroker.Languages;
          const devices = await iobConnection.readEnum('devices', language);
          result.push({
            json: { devices: [devices] },
            pairedItem: itemIndex,
          });
          console.log('iob read execute devices end');
        }
      } catch (error) {
        // This node should never fail, but we want to showcase how
        // to handle errors.
        if (this.continueOnFail()) {
          result.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
        } else {
          // Adding `itemIndex` allows other workflows to handle this error
          if (error.context) {
            // If the error thrown already contains the context property,
            // only append the itemIndex
            error.context.itemIndex = itemIndex;
            throw error;
          }
          throw new NodeOperationError(this.getNode(), error, {
            itemIndex,
          });
        }
      }
    }

    return [result];
  }
}
