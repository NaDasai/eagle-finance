import {
  Account,
  Args,
  Mas,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode } from './utils';

const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);

console.log('Deploying contract...');

const byteCode = getScByteCode('build', 'pool.wasm');

const constructorArgs = new Args()
  .addString('AS1otSzBjxmtAFfqsRViVSEqbW8ARnY5S34B2bYH2qWqTxzJQsiA') // token a address
  .addString('AS1otSzBjxmtAFfqsRViVSEqbW8ARnY5S34B2bYH2qWqTxzJQsiA') // token b address
  .addF64(0.5)
  .addF64(0.05)
  .addString('AS1otSzBjxmtAFfqsRViVSEqbW8ARnY5S34B2bYH2qWqTxzJQsiA') // lp token address
  .addString('AS12DTJdW6RB3peNQUE4V1T2RZHdxzraEWXdYdvyzejZodhHeDFGA') // registery address
  .serialize();

const contract = await SmartContract.deploy(
  provider,
  byteCode,
  constructorArgs,
  { coins: Mas.fromString('20') },
);

console.log('Contract deployed at:', contract.address);

const events = await provider.getEvents({
  smartContractAddress: contract.address,
});

for (const event of events) {
  console.log('Event message:', event.data);
}
