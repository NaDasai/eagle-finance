import {
  Args,
  Mas,
  OperationStatus,
  Provider,
  SmartContract,
} from '@massalabs/massa-web3';
import { getScByteCode } from '../utils';

export async function createNewPool(
  contract: SmartContract,
  aTokenAddress: string,
  bTokenAddress: string,
  inputFeeRate: number,
) {
  console.log('Creating new pool');

  const operation = await contract.call(
    'createNewPool',
    new Args()
      .addString(aTokenAddress)
      .addString(bTokenAddress)
      .addF64(inputFeeRate)
      .serialize(),
    { coins: Mas.fromString('0.1') },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Pool created successfully');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to create new pool');
  }
}

export async function deployRegistryContract(
  user1Provider: Provider,
  wmasAddress: string,
  fee: number = 0,
) {
  const registryByteCode = getScByteCode('build', 'registry.wasm');

  const constructorArgs = new Args()
    .addF64(fee * 10000) // 0% fee share protocol
    .addString(wmasAddress) // WMAS address
    .serialize();

  const contract = await SmartContract.deploy(
    user1Provider,
    registryByteCode,
    constructorArgs,
    {
      coins: Mas.fromString('8'),
    },
  );

  console.log('Registry contract deployed at:', contract.address);

  return contract;
}
