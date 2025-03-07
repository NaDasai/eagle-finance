import {
  Account,
  Args,
  BUILDNET_TOKENS,
  Mas,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode } from './utils';
import { setSwapRouterAddress } from '../tests/calls/registry';

const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);
const wmasAddress = BUILDNET_TOKENS.WMAS;

console.log('Deploying contract...');

const byteCode = getScByteCode('build', 'registry.wasm');

// constructr takes fee share protocol as a parameter
const constructorArgs = new Args()
  .addU64(BigInt(0.005 * 10000)) // 0.005% fee share protocol
  .addString(wmasAddress) // WMAS address
  .addU64(BigInt(0.3 * 10_000)) // Flash loan fees
  .serialize();

const contract = await SmartContract.deploy(
  provider,
  byteCode,
  constructorArgs,
  {
    coins: Mas.fromString('0.1'),
  },
);

console.log('Registry Contract deployed at:', contract.address);

const swapRouterByteCode = getScByteCode('build', 'swapRouter.wasm');

const swapRouterConstructorArgs = new Args()
  .addString(contract.address)
  .serialize();

const swapRouterContract = await SmartContract.deploy(
  provider,
  swapRouterByteCode,
  swapRouterConstructorArgs,
  {
    coins: Mas.fromString('0.1'),
  },
);

console.log('SwapRouter Contract deployed at:', swapRouterContract.address);

// Set the swap router address in the registry contract
await setSwapRouterAddress(contract, swapRouterContract.address);

const events = await provider.getEvents({
  smartContractAddress: contract.address,
});

console.log('Registry Events:');

for (const event of events) {
  console.log('Event message:', event.data);
}
