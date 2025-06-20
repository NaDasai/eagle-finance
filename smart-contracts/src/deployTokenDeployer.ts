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

console.log('Deploying contract...');

const byteCode = getScByteCode('build', 'tokenDeployer.wasm');

let provider: Web3Provider;

if (process.env.IS_MAINNET === 'true') {
  console.log('Deploying contract on mainnet...');
  provider = Web3Provider.mainnet(account);
} else {
  console.log('Deploying contract on buildnet...');
  provider = Web3Provider.buildnet(account);
}

// Constructr empty args
const constructorArgs = new Args().serialize();

let contract = await SmartContract.deploy(provider, byteCode, constructorArgs, {
  coins: Mas.fromString('0.5'),
});

console.log('Contract deployed at:', contract.address);
