import { Account, Web3Provider } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';

dotenv.config();

const account = await Account.fromEnv('PRIVATE_KEY');
const account2 = await Account.fromEnv('PRIVATE_KEY_TWO');
const provider = Web3Provider.buildnet(account);

console.log('getting events');

const events = await provider.getEvents({
  // callerAddress: account.address.toString(),
  smartContractAddress: 'AS12Fy5cFzm6ERfjKf53PYASEj4eBbLzwesiGSBxsJWnuJ12ES9cD',
});

for (const event of events) {
  console.log('Event message:', event.data);
}

console.log('Done');
