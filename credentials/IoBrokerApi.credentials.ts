import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class IoBrokerApi implements ICredentialType {
	name = 'iobrokerApi';

	displayName = 'Iobroker Credentials API';

	documentationUrl = 'https://iobroker';

	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			required: true,
			type: 'string',
			default: '',
			placeholder: 'localhost',
		},
		{
			displayName: 'Port',
			name: 'port',
			required: true,
			type: 'number',
			default: 8081,
		},
	];
}
