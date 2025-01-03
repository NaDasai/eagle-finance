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

const byteCode = getScByteCode('build', 'tokenDeployer.wasm');

// Constructr empty args
const constructorArgs = new Args().serialize();

let contract = await SmartContract.deploy(provider, byteCode, constructorArgs, {
  coins: Mas.fromString('0.9'),
});

console.log('Contract deployed at:', contract.address);
