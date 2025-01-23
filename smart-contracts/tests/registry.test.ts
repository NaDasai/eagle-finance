import { Account, SmartContract, Web3Provider } from '@massalabs/massa-web3';
import { beforeAll, describe, expect, it, test } from 'vitest';
import {
  createNewPool,
  deployRegistryContract,
  getPools,
} from './calls/registry';
import * as dotenv from 'dotenv';
import { NATIVE_MAS_COIN_ADDRESS } from './utils';

dotenv.config();

const user1Provider = Web3Provider.buildnet(await Account.fromEnv());

const user2Provider = Web3Provider.buildnet(
  await Account.fromEnv('PRIVATE_KEY_TWO'),
);

const wmasAddress = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';

let registryContract: SmartContract;

describe('Create new pool without liquidity', async () => {
  beforeAll(async () => {
    registryContract = await deployRegistryContract(user1Provider, wmasAddress);
  });

  test('When creating a pool, the registry should add the pool to the pools list', async () => {
    const aTokenAddress =
      'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
    const bTokenAddress = wmasAddress;
    const inputFeeRate = 0.3 * 10_000;

    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      inputFeeRate,
    );

    const pools = await getPools(registryContract);

    expect(pools.length, 'No pools found').toBeGreaterThan(0);

    expect(pools[0].aTokenddress, 'A token address is not correct').toBe(
      aTokenAddress,
    );

    expect(pools[0].bTokenAddress, 'B token address is not correct').toBe(
      bTokenAddress,
    );

    expect(pools[0].inputFeeRate, 'Input fee rate is not correct').toBe(
      inputFeeRate,
    );
  });

  // test('Registry should not allow to create a pool with same params', async () => {
  //   const aTokenAddress =
  //     'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
  //   const bTokenAddress = wmasAddress;
  //   const inputFeeRate = 0.3 * 10_000;

  //   await expect(
  //     await createNewPool(
  //       registryContract,
  //       aTokenAddress,
  //       bTokenAddress,
  //       inputFeeRate,
  //     ),
  //     'Should throw an error when creating a pool with same params',
  //   ).rejects.toThrow(

  //   );
  // });

  test('Resgistry when creating pool should sort the tokens and pass the wmas address as bToken even when it passed reversed', async () => {
    const aTokenAddress = wmasAddress;
    const bTokenAddress =
      'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
    const inputFeeRate = 0.05 * 10_000;

    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      inputFeeRate,
    );

    const pools = await getPools(registryContract);

    expect(pools.length, 'No pools found').toBeGreaterThan(1);

    const pool = pools[pools.length - 1];
    console.log('Pool: ', pool);

    expect(
      pool.aTokenddress,
      'A token address should be the b token address',
    ).toBe(bTokenAddress);

    expect(pool.bTokenAddress, 'B token address should be wmas address').toBe(
      wmasAddress,
    );

    expect(pool.inputFeeRate, 'Input fee rate is not correct').toBe(
      inputFeeRate,
    );
  });

  test('When creating a pool using A native coin, the registry should always convert it to wmas and add it as bToken', async () => {
    const aTokenAddress = NATIVE_MAS_COIN_ADDRESS;
    const bTokenAddress =
      'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
    const inputFeeRate = 0.01 * 10_000;

    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      inputFeeRate,
    );

    const pools = await getPools(registryContract);

    expect(pools.length, 'No pools found').toBeGreaterThan(0);

    const pool = pools[pools.length - 1];

    expect(pool.bTokenAddress, 'B token address should be wmas address').toBe(
      wmasAddress,
    );

    expect(
      pool.aTokenddress,
      'A token address should be the bTokenAddress',
    ).toBe(bTokenAddress);

    expect(pool.inputFeeRate, 'Input fee rate is not correct').toBe(
      inputFeeRate,
    );
  });

  test('When creating a pool using B native coin, the registry should always convert it to wmas and add it as bToken', async () => {
    const bTokenAddress = NATIVE_MAS_COIN_ADDRESS;
    const aTokenAddress =
      'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
    const inputFeeRate = 0.08 * 10_000;

    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      inputFeeRate,
    );

    const pools = await getPools(registryContract);

    expect(pools.length, 'No pools found').toBeGreaterThan(0);

    const pool = pools[pools.length - 1];

    expect(pool.bTokenAddress, 'B token address should be wmas address').toBe(
      wmasAddress,
    );

    expect(
      pool.aTokenddress,
      'A token address should be the aTokenAddress',
    ).toBe(aTokenAddress);

    expect(pool.inputFeeRate, 'Input fee rate is not correct').toBe(
      inputFeeRate,
    );
  });

  test('should throws an error if both tokens re the same');
});
