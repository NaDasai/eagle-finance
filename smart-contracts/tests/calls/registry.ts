import {
  Args,
  Mas,
  OperationStatus,
  parseMas,
  parseUnits,
  Provider,
  SmartContract,
} from '@massalabs/massa-web3';
import { getScByteCode, TOKEN_DEFAULT_DECIMALS } from '../utils';
import { Pool } from '../../src/builnet-tests/structs/pool';

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
    { coins: Mas.fromString('8.5') },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Pool created successfully');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to create new pool');
  }
}

export async function createNewPoolWithLiquidity(
  contract: SmartContract,
  aTokenAddress: string,
  bTokenAddress: string,
  aAmount: number,
  bAmount: number,
  minAAmount: number,
  minBAmount: number,
  inputFeeRate: number,
  isBNativeMas: boolean = false,
  aDecimals: number = TOKEN_DEFAULT_DECIMALS,
  bDecimals: number = TOKEN_DEFAULT_DECIMALS,
) {
  console.log('Creating new pool with liquidity...');

  const coinsToSendOnAddLiquidity = isBNativeMas
    ? parseMas(Number(bAmount + 8.5).toString())
    : Mas.fromString('8.5');
  try {
    const operation = await contract.call(
      'createNewPoolWithLiquidity',
      new Args()
        .addString(aTokenAddress)
        .addString(bTokenAddress)
        .addU256(parseUnits(aAmount.toString(), aDecimals))
        .addU256(parseUnits(bAmount.toString(), bDecimals))
        .addU256(parseUnits(minAAmount.toString(), aDecimals))
        .addU256(parseUnits(minBAmount.toString(), bDecimals))
        .addF64(inputFeeRate)
        .addBool(isBNativeMas)
        .serialize(),
      { coins: coinsToSendOnAddLiquidity },
    );

    const status = await operation.waitSpeculativeExecution();

    if (status === OperationStatus.SpeculativeSuccess) {
      console.log('Pool created successfully');
    } else {
      console.log('Status:', status);
      throw new Error('Failed to create new pool');
    }
  } catch (error) {
    console.log('Error:', error);
    throw error;
  }
}

export async function deployRegistryContract(
  user1Provider: Provider,
  wmasAddress: string,
  fee: number = 0,
  flashLoanFee: number = 0,
) {
  const registryByteCode = getScByteCode('build', 'registry.wasm');

  const constructorArgs = new Args()
    .addF64(fee * 10000) // 0% fee share protocol
    .addString(wmasAddress) // WMAS address
    .addF64(flashLoanFee * 10_000) // 0% fee share protocol
    .serialize();

  const contract = await SmartContract.deploy(
    user1Provider,
    registryByteCode,
    constructorArgs,
    {
      coins: Mas.fromString('0.1'),
    },
  );

  console.log('Registry contract deployed at:', contract.address);

  return contract;
}

export async function getPools(registryContract: SmartContract) {
  // get pools from registry
  const poolsRes = await registryContract.read('getPools');

  const pools = new Args(poolsRes.value).nextSerializableObjectArray<Pool>(
    Pool,
  );

  console.log('Pools: ', pools);

  return pools;
}
