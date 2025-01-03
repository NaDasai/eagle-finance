import { Account, Web3Provider } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';

dotenv.config();

const account = await Account.fromEnv('PRIVATE_KEY');
const provider = Web3Provider.buildnet(account);

console.log('getting events');

const events = await provider.getEvents({
  smartContractAddress: 'AS1kMukZGB9S2hhq72viAF3EaQ4YbUmYewzjbFn1hJJB8VC9VAmx',
});

for (const event of events) {
  console.log('Event message:', event.data);
}

console.log('Done');
