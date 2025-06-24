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

const registryAddress = 'AS1NYihs2Wy4D4P68JGY2hYSDDaqZ5YxhM2nDRsJVFZUykEEdSAW'; 
const multisigAddress = 'AS1FdvdrhiUZTgQf6ker6Yh75hDWvxFABz4wYZThJAqMFUo318PW';

const registryContract = new SmartContract(provider, registryAddress);

await transferOwnership(registryContract, multisigAddress);

