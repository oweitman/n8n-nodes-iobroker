import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class IoBrokerApi implements ICredentialType {
	name = 'iobrokerApi';

	displayName = 'Iobroker Credentials API';

	documentationUrl = 'https://iobroker';

	properties: INodeProperties[] = [
		{
			displayName: 'Protocol',
			name: 'protocol',
			required: true,
			type: 'options',
			options: [
				{ name: 'HTTP', value: 'http' },
				{ name: 'HTTPS', value: 'https' },
			],
			default: 'http',
		},
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
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			description: 'Optional ioBroker username when Admin authentication is enabled',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Optional ioBroker password when Admin authentication is enabled',
		},
	];
}
