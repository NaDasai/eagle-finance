import {
  Account,
  Args,
  BUILDNET_TOKENS,
  MAINNET_TOKENS,
  Mas,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode } from './utils';
import { setSwapRouterAddress } from '../tests/calls/registry';
import dotenv from 'dotenv';

dotenv.config();

const account = await Account.fromEnv();

let wmasAddress: string;
let provider: Web3Provider;

const isMainnet = process.env.IS_MAINNET === 'true';

if (isMainnet) {
  console.log('Deploying contract on mainnet...');
  wmasAddress = MAINNET_TOKENS.WMAS;
  provider = Web3Provider.mainnet(account);
} else {
  console.log('Deploying contract on buildnet...');
  wmasAddress = BUILDNET_TOKENS.WMAS;
  provider = Web3Provider.buildnet(account);
}

const byteCode = getScByteCode('build', 'registry.wasm');

// constructr takes fee share protocol as a parameter
const constructorArgs = new Args()
  .addU64(BigInt(25 * 10000)) // 25% fee share protocol
  .addString(wmasAddress) // WMAS address
  .addU64(BigInt(0.1 * 10_000)) // Flash loan fees
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
