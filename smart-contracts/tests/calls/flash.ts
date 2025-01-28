import {
  Args,
  Mas,
  OperationStatus,
  Provider,
  SmartContract,
} from '@massalabs/massa-web3';
import { getScByteCode } from '../utils';

export async function deployFlashSwapContract(
  userProvider: Provider,
  poolAddress: string,
  registryAddress: string,
) {
  const flashSwapByteCode = getScByteCode('build', 'ExempleFlashSwap.wasm');

  const constructorArgs = new Args()
    .addString(poolAddress)
    .addString(registryAddress)
    .serialize();

  const contract = await SmartContract.deploy(
    userProvider,
    flashSwapByteCode,
    constructorArgs,
    {
      coins: Mas.fromString('2'),
    },
  );

  console.log('FlashSwap contract deployed at:', contract.address);

  return contract;
}

export async function deployFlashMaliciousContract(
  userProvider: Provider,
  poolAddress: string,
  registryAddress: string,
) {
  console.log('Deploying Malicious Flash Swap Contract...');

  const flashSwapByteCode = getScByteCode('build', 'MaliciousFlash.wasm');

  const constructorArgs = new Args()
    .addString(poolAddress)
    .addString(registryAddress)
    .serialize();

  const contract = await SmartContract.deploy(
    userProvider,
    flashSwapByteCode,
    constructorArgs,
    {
      coins: Mas.fromString('2'),
    },
  );

  console.log('FlashSwap malicious contract deployed at:', contract.address);

  return contract;
}

export async function initFlash(
  flashContract: SmartContract,
  aAmount: bigint,
  bAmount: bigint,
  profitAddress: string,
  data: Uint8Array,
) {
  console.log('Initializing flash...');

  const operation = await flashContract.call(
    'initFlash',
    new Args()
      .addU256(aAmount)
      .addU256(bAmount)
      .addString(profitAddress)
      .addUint8Array(data)
      .serialize(),
    {
      coins: Mas.fromString('0.1'),
    },
  );

  const operationStatus = await operation.waitSpeculativeExecution();

  if (operationStatus === OperationStatus.SpeculativeSuccess) {
    console.log('Initialization successful');
  } else {
    console.log('Status:', operationStatus);
    throw new Error('Failed to initialize flash');
  }
}
