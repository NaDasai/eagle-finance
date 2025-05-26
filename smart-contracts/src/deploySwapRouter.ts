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

const byteCode = getScByteCode('build', 'swapRouter.wasm');


const constructorArgs = new Args()
  .addString('AS1K2k1Qfn8fCVaMPZhVp6uobAZfCXfTsJxjnnzxgseGcepxF6wu') //registry address
  .serialize();

const contract = await SmartContract.deploy(
  provider,
  byteCode,
  constructorArgs,
  {
    coins: Mas.fromString('0.1'),
  },
);

console.log('Contract deployed at:', contract.address);

const events = await provider.getEvents({
  smartContractAddress: contract.address,
});

for (const event of events) {
  console.log('Event message:', event.data);
}
