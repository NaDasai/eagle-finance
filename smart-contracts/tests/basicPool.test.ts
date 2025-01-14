import { beforeAll, describe, expect, test } from 'vitest';
import * as dotenv from 'dotenv';
import {
  Account,
  Args,
  Mas,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { createNewPool } from './calls/registry';
import { Pool } from '../src/builnet-tests/structs/pool';
import { getScByteCode } from './utils';

dotenv.config();

const user1Provider = Web3Provider.buildnet(await Account.fromEnv());

describe('Scenario 1: Add liquidity, Swap, Remove liquidity', async () => {
  const registryByteCode = getScByteCode('build', 'registry.wasm');

  const constructorArgs = new Args()
    .addF64(0.005 * 1000) // 0.005% fee share protocol
    .addString('AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU') // WMAS address
    .serialize();

  const contract = await SmartContract.deploy(
    user1Provider,
    registryByteCode,
    constructorArgs,
    {
      coins: Mas.fromString('8'),
    },
  );

  const registryAddress = contract.address.toString();

  const aTokenAddress = 'AS12V58y942EBAexRzU3bGVb7Fxoduba4UxfLAQCbSeKNVamDCHfL';
  const bTokenAddress = 'AS1mb6djKDu2LnhQtajuLPGX1J2PNYgCY2LoUxQxa69ABUgedJXN';
  const poolFeeRate = 0.3 * 1000;

  const registryContracct = new SmartContract(user1Provider, registryAddress);

  // create new pool
  await createNewPool(
    registryContracct,
    aTokenAddress,
    bTokenAddress,
    poolFeeRate,
  );

  // get pools from registry
  const poolsRes = await registryContracct.read('getPools');

  const pools = new Args(poolsRes.value).nextSerializableObjectArray<Pool>(
    Pool,
  );

  console.log('Pools: ', pools);

  expect(pools.length > 0, 'No pools found');

  // get the last pool address
  const poolAddress = pools[pools.length - 1].poolAddress;

  let poolContract: SmartContract = new SmartContract(
    user1Provider,
    poolAddress,
  );

  test('User 1 Add liquidity to pool when its empty', async () => {
    // get all pool reserves and expect them to be 0
    const reserveA = new Args(
      (await poolContract.read('getLocalReserveA')).value,
    ).nextU256();
    const reserveB = new Args(
      (await poolContract.read('getLocalReserveB')).value,
    ).nextU256();

    expect(
      reserveA === BigInt(0) && reserveB === BigInt(0),
      'Reserves should be 0 when pool is empty',
    );

    // 

  });


});
