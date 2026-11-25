import {
  NodeOperationError,
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
  NodeApiError,
  ICredentialTestFunctions,
  INodeCredentialTestResult,
  ICredentialsDecrypted,
  IDataObject,
  ILoadOptionsFunctions,
  INodePropertyOptions,
  type JsonObject,
} from 'n8n-workflow';
import {} from '@iobroker/types';
import { IobrokerConnection } from './iobrokerConnection';

export class IoBrokerOutput implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'ioBroker Output',
    name: 'ioBrokerOutput',
    subtitle: '={{$parameter["type"] + ($parameter["oid"] ? " - " + $parameter["oid"] : "")}}',
    group: ['output'],
    icon: 'file:ioBroker.svg',
    version: 1,
    description: 'ioBroker Output',
    defaults: {
      name: 'ioBroker Output',
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
            name: 'State',
            value: 'state',
            description: 'Write to state',
            action: 'Write to state',
          },
          {
            name: 'Object',
            value: 'object',
            description: 'Write to object',
            action: 'Write to object',
          },
          {
            name: 'File',
            value: 'file',
            description: 'Write to file',
            action: 'Write to file',
          },
          {
            name: 'Logs',
            value: 'log',
            description: 'Write to logs',
            action: 'Write to logs',
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
        default: '',
        required: true,
        placeholder: 'File name',
        description: 'Like main/vis-views.JSON',
        displayOptions: {
          show: {
            type: ['file'],
          },
        },
      },
      {
        displayName: 'Value',
        name: 'val',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Value or JSON object',
      },
      {
        displayName: 'Log Level',
        name: 'level',
        type: 'options',
        default: 'info',
        options: [
          {
            name: 'Info',
            value: 'info',
          },
          {
            name: 'Debug',
            value: 'debug',
          },
          {
            name: 'Warning',
            value: 'warn',
          },
          {
            name: 'Error',
            value: 'error',
          },
        ],
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
        try {
          await iobConnection.connect(
            credentials.host as string,
            credentials.port as number,
            credentials.username as string,
            credentials.password as string,
            credentials.protocol as 'http' | 'https',
          );
          return await iobConnection.getInstances();
        } finally {
          iobConnection.destroy();
        }
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
          iobConnection.destroy();
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
    try {
      return await processItems(this, iobConnection);
    } finally {
      iobConnection.destroy();
    }
  }
}

async function processItems(
  ctx: IExecuteFunctions,
  iobConnection: IobrokerConnection,
): Promise<INodeExecutionData[][]> {
  const items = ctx.getInputData();

  let type: 'state' | 'object' | undefined;
  let val = '';
  let oid = '';

  // Iterates over all input items and add the key "myString" with the
  // value the parameter "myString" resolves to.
  // (This could be a different value for each item in case it contains an expression)
  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    try {
      type = ctx.getNodeParameter('type', itemIndex, '') as 'state' | 'object';
      oid = ctx.getNodeParameter('oid', itemIndex, '') as string;
      val = ctx.getNodeParameter('val', itemIndex, '') as string;

      // Get the value to write based on the type
      if (type === 'object') {
        // For object type, we assume val is a JSON string
        if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
          const jsonValue = JSON.parse(val);
          await iobConnection.setObject(oid, jsonValue);
        } else if (typeof val === 'object' && val !== null) {
          // If val is already an object, we can directly use it
          await iobConnection.setObject(oid, val);
        } else {
          throw new NodeOperationError(
            ctx.getNode(),
            `Value for OID ${oid} must be a valid JSON object.`,
          );
        }
      } else if (type === 'state') {
        // For state type, we assume val is a simple value
        const obj = await iobConnection.getObject(oid);
        if (!obj) {
          throw new NodeOperationError(ctx.getNode(), `Object with OID ${oid} does not exist.`);
        }
        if (obj.type !== 'state') {
          throw new NodeOperationError(ctx.getNode(), `OID ${oid} is not a state object.`);
        }
        if (obj.common?.type === 'number') {
          if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
            // If the value is a JSON object, parse it
            const parsedState = JSON.parse(val);
            if (typeof parsedState.val !== 'number') {
              throw new NodeOperationError(ctx.getNode(), `Value for OID ${oid} must be a number.`);
            }
            await iobConnection.setState(oid, parsedState);
          } else {
            await iobConnection.setState(oid, { val: parseFloat(val), ack: false });
          }
        } else if (obj.common?.type === 'boolean') {
          if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
            // If the value is a JSON object, parse it
            const parsedState = JSON.parse(val);
            if (typeof parsedState.val !== 'boolean') {
              throw new NodeOperationError(
                ctx.getNode(),
                `Value for OID ${oid} must be a boolean.`,
              );
            }
            await iobConnection.setState(oid, parsedState);
          } else {
            await iobConnection.setState(oid, { val: val.toLowerCase() === 'true', ack: false });
          }
        } else if (obj.common?.type === 'string') {
          if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
            // If the value is a JSON object, parse it
            const parsedState = JSON.parse(val);
            if (typeof parsedState.val !== 'string') {
              throw new NodeOperationError(ctx.getNode(), `Value for OID ${oid} must be a string.`);
            }
            await iobConnection.setState(oid, parsedState);
          } else {
            await iobConnection.setState(oid, { val: val.toString(), ack: false });
          }
        } else {
          // For other types, we assume val is a simple value
          if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
            // If the value is a JSON object, parse it
            const parsedState = JSON.parse(val);
            await iobConnection.setState(oid, parsedState);
          } else {
            await iobConnection.setState(oid, { val, ack: false });
          }
        }
      } else if (type === 'file') {
        // later
      } else if (type === 'log') {
        // For log type, we assume val is a string message
        if (typeof val !== 'string') {
          throw new NodeOperationError(ctx.getNode(), `Value for log must be a string.`);
        }
        iobConnection.log(val, 'info');
      }
    } catch (error) {
      // This node should never fail, but we want to showcase how
      // to handle errors.
      if (ctx.continueOnFail()) {
        items.push({ json: ctx.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
      } else {
        // Adding `itemIndex` allows other workflows to handle this error
        if (error.context) {
          // If the error thrown already contains the context property,
          // only append the itemIndex
          error.context.itemIndex = itemIndex;
          throw error;
        }
        throw new NodeOperationError(ctx.getNode(), error, {
          itemIndex,
        });
      }
    }
  }

  return [items];
}
