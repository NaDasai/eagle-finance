import {
  Account,
  Args,
  Mas,
  SmartContract,
  U16,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode } from './utils';

const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);

console.log('Deploying contract...');

const byteCode = getScByteCode('build', 'pool.wasm');

const name = 'Massa';
const constructorArgs = new Args()
  .addString('token a addr')
  .addString('token b addr')
  .addU16(U16.fromNumber(10))
  .addU16(U16.fromNumber(20))
  .addString('lp token addr')
  .serialize();

const contract = await SmartContract.deploy(
  provider,
  byteCode,
  constructorArgs,
  { coins: Mas.fromString('0.1') },
);

console.log('Contract deployed at:', contract.address);

const events = await provider.getEvents({
  smartContractAddress: contract.address,
});

for (const event of events) {
  console.log('Event message:', event.data);
}
