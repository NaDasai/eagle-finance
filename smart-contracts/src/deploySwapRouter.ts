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
const provider = Web3Provider.buildnet(account);

console.log('Deploying contract...');

const byteCode = getScByteCode('build', 'swapRouter.wasm');

const registryAddress = 'AS12BFMd6JHrZJNLLWiMB4ai8vxNzTpFBdiVEFy2QhFx2KkyTzrXR';

const constructorArgs = new Args()
  .addString(registryAddress) //registry address
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

// const registryContract = new SmartContract(provider, registryAddress);

// Set the swap router address in the registry contract
// await setSwapRouterAddress(registryContract, contract.address);
