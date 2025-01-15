import {
  Account,
  Args,
  Mas,
  parseUnits,
  SmartContract,
  U128,
  U8,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode } from './utils';

const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);

console.log('Deploying contract...');

const byteCode = getScByteCode('build', 'token.wasm');

const constructorArgs = new Args()
  .addString(account.address.toString()) // owner
  .addString('Eagle Finance') // token name
  .addString('EGL') // token symbol
  .addU8(U8.fromNumber(9)) // token decimals
  .addU256(parseUnits('10000000', 9)) // token total supply
  .addString('https://eaglex.vercel.app/images/eagle-finance.png') // token url (optional)
  .addString('Dex on Massa') // token description (optional)
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
