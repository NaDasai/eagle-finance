import {
  Account,
  Args,
  Mas,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode } from './utils';
import { setSwapRouterAddress } from '../tests/calls/registry';

const account = await Account.fromEnv();

console.log('Deploying contract...');

const byteCode = getScByteCode('build', 'swapRouter.wasm');

const registryAddress = 'AS12sMLjqrsjbje5kp3iGtLjwR81DWemFXnMZcC19uUuYZWWS1AjC';

const constructorArgs = new Args()
  .addString(registryAddress) //registry address
  .serialize();

const isMainnet = process.env.IS_MAINNET === 'true';

let provider: Web3Provider;

if (isMainnet) {
  console.log('Deploying contract on mainnet...');
  provider = Web3Provider.mainnet(account);
} else {
  console.log('Deploying contract on buildnet...');
  provider = Web3Provider.buildnet(account);
}

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

const registryContract = new SmartContract(provider, registryAddress);

// Set the swap router address in the registry contract
await setSwapRouterAddress(registryContract, contract.address);
