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
import { transferOwnership } from '../tests/calls/ownership';

dotenv.config();

const account = await Account.fromEnv();

let provider: Web3Provider;

const isMainnet = process.env.IS_MAINNET === 'true';

if (isMainnet) {
  console.log('Deploying contract on mainnet...');
  provider = Web3Provider.mainnet(account);
} else {
  console.log('Deploying contract on buildnet...');
  provider = Web3Provider.buildnet(account);
}

// const registryAddress = 'AS1ux1qNquxNYMouTJDQB8tcAEyuXQxwaCNSq2cKr44Ki3HwVNsK';
// const multisigAddress = 'AS1ArFpxvA1nMeZuCq5nrzWa4aGpBW7KvKgustbZmCUyPqciVKKH';

const registryAddress = 'AS12sMLjqrsjbje5kp3iGtLjwR81DWemFXnMZcC19uUuYZWWS1AjC'; 
const multisigAddress = 'AS12STKH4DincowsczrEYB5bduH2do7CwWm8LQtFXe7GK2UmjatAp';

const registryContract = new SmartContract(provider, registryAddress);

await transferOwnership(registryContract, multisigAddress);

