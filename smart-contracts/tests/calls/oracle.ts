import {
  Args,
  Mas,
  OperationStatus,
  Provider,
  SmartContract,
} from '@massalabs/massa-web3';
import { getScByteCode } from '../utils';

export async function deployOracleContract(
  userProvider: Provider,
  poolAddress: string,
  period: number,
) {
  const oracleByteCode = getScByteCode('build', 'oracle.wasm');

  const constructorArgs = new Args()
    .addString(poolAddress)
    .addU64(BigInt(period))
    .serialize();

  const contract = await SmartContract.deploy(
    userProvider,
    oracleByteCode,
    constructorArgs,
    {
      coins: Mas.fromString('0.1'),
    },
  );

  console.log('Oracle contract deployed at:', contract.address);

  return contract;
}

export async function getAPriceAverage(oracleContract: SmartContract) {
  const result = await oracleContract.read('getAPriceAverage');

  return new Args(result.value).nextU256();
}

export async function getBPriceAverage(oracleContract: SmartContract) {
  const result = await oracleContract.read('getBPriceAverage');
  return new Args(result.value).nextU256();
}

export async function updateOraclePrices(oracleContract: SmartContract) {
  console.log('Updating oracle contract prices..');
  const operation = await oracleContract.call('update');

  const operationStatus = await operation.waitSpeculativeExecution();

  if (operationStatus === OperationStatus.SpeculativeSuccess) {
    console.log('Oracle contract prices updated successfully');
  } else {
    console.log('Oracle contract prices update failed');
    throw new Error('Oracle contract prices update failed');
  }
}
