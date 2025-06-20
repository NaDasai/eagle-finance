import {
  Account,
  Args,
  bytesToStr,
  Mas,
  OperationStatus,
  parseMas,
  parseUnits,
  Provider,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode, TOKEN_DEFAULT_DECIMALS } from '../utils';
import { Pool } from '../../src/builnet-tests/structs/pool';
import * as dotenv from 'dotenv';

dotenv.config();

const user1Provider = Web3Provider.buildnet(await Account.fromEnv());

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
      .addU64(BigInt(inputFeeRate))
      .serialize(),
    { coins: Mas.fromString('9') },
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
    ? parseMas(Number(bAmount + 12).toString())
    : Mas.fromString('12');

  console.log('coinsToSendOnAddLiquidity', coinsToSendOnAddLiquidity);
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
        .addU64(BigInt(inputFeeRate))
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
  fee: number = 25,
  flashLoanFee: number = 0.1,
) {
  const registryByteCode = getScByteCode('build', 'registry.wasm');

  const constructorArgs = new Args()
    .addU64(BigInt(fee * 10000)) // 0% fee share protocol
    .addString(wmasAddress) // WMAS address
    .addU64(BigInt(flashLoanFee * 10_000)) // 0% fee share protocol
    .serialize();

  const contract = await SmartContract.deploy(
    user1Provider,
    registryByteCode,
    constructorArgs,
    {
      coins: Mas.fromString('0.05'),
    },
  );

  console.log('Registry contract deployed at:', contract.address);

  return contract;
}

export async function getPools(registryContract: SmartContract) {
  const keys = await user1Provider.getStorageKeys(
    registryContract.address,
    'pools::',
    false,
  );

  const poolsKeys = [];

  for (const key of keys) {
    const deserializedKey = bytesToStr(key);
    poolsKeys.push(deserializedKey);
  }

  console.log('Pools keys:', poolsKeys);

  const pools = [];

  for (const key of poolsKeys) {
    const pool = await getPoolByKey(registryContract, key);
    pools.push(pool);
  }

  return pools;
}

export async function getFeeShareProtocolReceiver(
  registryContract: SmartContract,
) {
  const feeShareProtocolReceiver = bytesToStr(
    (await registryContract.read('getFeeShareProtocolReceiver')).value,
  );

  return feeShareProtocolReceiver;
}

export async function getWmasTokenAddress(registryContract: SmartContract) {
  const wmasTokenAddress = bytesToStr(
    (await registryContract.read('getWmasTokenAddress')).value,
  );

  return wmasTokenAddress;
}

export async function getFlashLoanFeeReceiver(registryContract: SmartContract) {
  const flashLoanFeeReceiver = bytesToStr(
    (await registryContract.read('getFlashLoanFeeReceiver')).value,
  );

  return flashLoanFeeReceiver;
}

export async function setFlashLoanFeeReceiver(
  registryContract: SmartContract,
  flashLoanFeeReceiver: string,
) {
  const operation = await registryContract.call(
    'setFlashLoanFeeReceiver',
    new Args().addString(flashLoanFeeReceiver).serialize(),
    { coins: Mas.fromString('0.1') },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Flash loan fee receiver set successfully');
  } else {
    console.log('Status:', status);
    console.error('Error events:', await operation.getSpeculativeEvents());
    throw new Error('Failed to set flash loan fee receiver');
  }
}

export async function setFeeShareProtocolReceiver(
  registeryContract: SmartContract,
  feeShareProtocolReceiver: string,
) {
  const operation = await registeryContract.call(
    'setFeeShareProtocolReceiver',
    new Args().addString(feeShareProtocolReceiver).serialize(),
    {
      coins: Mas.fromString('0.1'),
    },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Fee share protocol receiver set successfully');
  } else {
    console.log('Status:', status);

    console.log('Error events:', operation.getSpeculativeEvents());

    throw new Error('Failed to set fee share protocol receiver');
  }
}

export async function setWmasTokenAddress(
  registeryContract: SmartContract,
  wmasTokenAddress: string,
) {
  const operation = await registeryContract.call(
    'setWmasTokenAddress',
    new Args().addString(wmasTokenAddress).serialize(),
    { coins: Mas.fromString('0.1') },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('WMAS token address set successfully');
  } else {
    console.log('Status:', status);
    console.log('Error events:', operation.getSpeculativeEvents());
    throw new Error('Failed to set WMAS token address');
  }
}

export async function getPool(
  registryContract: SmartContract,
  aTokenAddress: string,
  bTokenAddress: string,
  inputFeeRate: number,
) {
  const poolResult = await registryContract.read(
    'getPool',
    new Args()
      .addString(aTokenAddress)
      .addString(bTokenAddress)
      .addU64(BigInt(inputFeeRate))
      .serialize(),
  );

  console.log('Pool RESULT', poolResult);

  const pool = new Args(poolResult.value).nextSerializable<Pool>(Pool);

  console.log('Pool:', pool);

  return pool;
}

export async function getPoolByKey(
  registryContract: SmartContract,
  key: string,
) {
  const poolResult = await user1Provider.readStorage(
    registryContract.address,
    [key],
    false,
  );

  const pool = new Args(poolResult[0]).nextSerializable<Pool>(Pool);

  return pool;
}

export async function setSwapRouterAddress(
  registryContract: SmartContract,
  swapRouterAddress: string,
) {
  const operation = await registryContract.call(
    'setSwapRouterAddress',
    new Args().addString(swapRouterAddress).serialize(),
    { coins: Mas.fromString('0.01') },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Swap router set successfully');
  } else {
    console.log('Status:', status);
    console.log('Error events:', await operation.getSpeculativeEvents());
    throw new Error('Failed to set swap router address');
  }
}

export async function getSwapRouterAddress(registryContract: SmartContract) {
  const swapRouterAddress = bytesToStr(
    (await registryContract.read('getSwapRouterAddress')).value,
  );

  return swapRouterAddress;
}
