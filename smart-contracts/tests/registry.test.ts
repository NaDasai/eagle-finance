import {
  Account,
  Args,
  OperationStatus,
  parseMas,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { beforeAll, describe, expect, it, test } from 'vitest';
import {
  createNewPool,
  createNewPoolWithLiquidity,
  deployRegistryContract,
  getPool,
} from './calls/registry';
import * as dotenv from 'dotenv';
import { NATIVE_MAS_COIN_ADDRESS } from './utils';
import { getPoolReserves, increaseAllownace } from './calls/basicPool';

dotenv.config();

const user1Provider = Web3Provider.buildnet(await Account.fromEnv());

const user2Provider = Web3Provider.buildnet(
  await Account.fromEnv('PRIVATE_KEY_TWO'),
);

const wmasAddress = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';

let registryContract: SmartContract;

describe.skip('Create new pool without liquidity', async () => {
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

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      inputFeeRate,
    );

    expect(pool.aTokenddress, 'A token address is not correct').toBe(
      aTokenAddress,
    );

    expect(pool.bTokenAddress, 'B token address is not correct').toBe(
      bTokenAddress,
    );

    expect(pool.inputFeeRate, 'Input fee rate is not correct').toBe(
      inputFeeRate,
    );
  });

  test('Registry should not allow to create a pool with same params', async () => {
    const aTokenAddress =
      'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
    const bTokenAddress = wmasAddress;
    const inputFeeRate = 0.3 * 10_000;

    await expect(
      await createNewPool(
        registryContract,
        aTokenAddress,
        bTokenAddress,
        inputFeeRate,
      ),
      'Should throw an error when creating a pool with same params',
    ).rejects.toThrow();
  });

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

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      inputFeeRate,
    );

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

    const pool = await getPool(
      registryContract,
      bTokenAddress,
      wmasAddress,
      inputFeeRate,
    );

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

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      wmasAddress,
      inputFeeRate,
    );

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

  test('should create pool using 2 mrc20 tokens', async () => {
    let aTokenAddress = 'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
    let bTokenAddress = 'AS12kpwomkZRNWRUgYT2e9AJ3Qun9jByTfmLdS7Xo6dWX4u9rG6bb';
    const inputFeeRate = 0.35 * 10_000;

    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      inputFeeRate,
    );

    //  sort the tokens according
    const aSortedToken = bTokenAddress;
    const bSortedToken = aTokenAddress;

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      inputFeeRate,
    );

    expect(pool.aTokenddress, 'A token address is not correct').toBe(
      aSortedToken,
    );

    expect(pool.bTokenAddress, 'B token address is not correct').toBe(
      bSortedToken,
    );

    expect(pool.inputFeeRate, 'Input fee rate is not correct').toBe(
      inputFeeRate,
    );
  });
});

describe.skip('Create new pool with liquidity', async () => {
  beforeAll(async () => {
    registryContract = await deployRegistryContract(user1Provider, wmasAddress);
  });

  test('should create a new pool with liquidity using B as wmas', async () => {
    const aTokenAddress =
      'AS1maKRNJXeRGeFNXS7yA63raLbic4kMEnkHfVvePWe65eHXn5nS';
    const bTokenAddress = wmasAddress;
    const inputFeeRate = 0.3 * 10_000;

    const aAmount = 5;
    const bAmount = 5;

    //  Increase allownace for both tokens
    await increaseAllownace(
      aTokenAddress,
      registryContract.address,
      aAmount,
      user1Provider,
    );

    await increaseAllownace(
      bTokenAddress,
      registryContract.address,
      bAmount,
      user1Provider,
    );

    const withdrawMasOperation = await registryContract.call(
      'withdrawMas',
      new Args(),
    );

    const status = await withdrawMasOperation.waitSpeculativeExecution();

    if (status === OperationStatus.SpeculativeSuccess) {
      console.log('Withdraw MAS operation successful');
    } else {
      console.log('Withdraw MAS operation failed');
      console.log(
        'Error events:',
        await withdrawMasOperation.getSpeculativeEvents(),
      );
      throw new Error('Withdraw MAS operation failed');
    }

    //  Create a new pool with liquidity
    await createNewPoolWithLiquidity(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      aAmount,
      bAmount,
      0,
      0,
      inputFeeRate,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      inputFeeRate,
    );

    const poolContract = new SmartContract(user1Provider, pool.poolAddress);

    expect(pool.aTokenddress, 'A token address is not correct').toBe(
      aTokenAddress,
    );

    expect(pool.bTokenAddress, 'B token address is not correct').toBe(
      bTokenAddress,
    );

    expect(pool.inputFeeRate, 'Input fee rate is not correct').toBe(
      inputFeeRate,
    );

    //  get pool reserves
    const [aReserve, bReserve] = await getPoolReserves(poolContract);

    expect(aReserve, 'A reserve is not correct').toBe(
      parseMas(aAmount.toString()),
    );

    expect(bReserve, 'B reserve is not correct').toBe(
      parseMas(bAmount.toString()),
    );
  });

  test.skip("should create a new pool with liquidity using B as wmas even if I'm passing it as A token", async () => {
    const aTokenAddress = wmasAddress;
    const bTokenAddress =
      'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
    const inputFeeRate = 0.03 * 10_000;

    const aAmount = 2;
    const bAmount = 3;
    const minAAmount = 0;
    const minBAmount = 0;

    //  Increase allownace for both tokens
    await increaseAllownace(
      aTokenAddress,
      registryContract.address,
      aAmount,
      user1Provider,
    );

    await increaseAllownace(
      bTokenAddress,
      registryContract.address,
      bAmount,
      user1Provider,
    );

    //  Create a new pool with liquidity
    await createNewPoolWithLiquidity(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      aAmount,
      bAmount,
      minAAmount,
      minBAmount,
      inputFeeRate,
    );

    const pool = await getPool(
      registryContract,
      bTokenAddress,
      wmasAddress,
      inputFeeRate,
    );

    const poolContract = new SmartContract(user1Provider, pool.poolAddress);

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

    //  get pool reserves
    const [aReserve, bReserve] = await getPoolReserves(poolContract);

    expect(aReserve, 'A reserve should be equals to bAmount').toBe(
      parseMas(bAmount.toString()),
    );

    expect(bReserve, 'B reserve should be equals to aAmount').toBe(
      parseMas(aAmount.toString()),
    );
  });

  test.skip('should create a new pool with liquidity using B as a native coin', async () => {
    const aTokenAddress =
      'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
    const bTokenAddress = NATIVE_MAS_COIN_ADDRESS;
    const inputFeeRate = 0.08 * 10_000;

    const aAmount = 2;
    const bAmount = 3;
    const minAAmount = 0;
    const minBAmount = 0;

    //  increase allownace for tokenA
    await increaseAllownace(
      aTokenAddress,
      registryContract.address,
      aAmount,
      user1Provider,
    );

    //  Create a new pool with liquidity
    await createNewPoolWithLiquidity(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      aAmount,
      bAmount,
      minAAmount,
      minBAmount,
      inputFeeRate,
      true,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      wmasAddress,
      inputFeeRate,
    );
    const poolContract = new SmartContract(user1Provider, pool.poolAddress);

    expect(
      pool.aTokenddress,
      'A token address should be the A token address',
    ).toBe(aTokenAddress);

    expect(pool.bTokenAddress, 'B token address should be wmas address').toBe(
      wmasAddress,
    );

    expect(pool.inputFeeRate, 'Input fee rate is not correct').toBe(
      inputFeeRate,
    );

    //  get pool reserves
    const [aReserve, bReserve] = await getPoolReserves(poolContract);

    expect(aReserve, 'A reserve should be equals to aAmount').toBe(
      parseMas(aAmount.toString()),
    );

    expect(bReserve, 'B reserve should be equals to bAmount').toBe(
      parseMas(bAmount.toString()),
    );
  });

  // test case that should throw an error.This is why it is commented
  test.skip('Should throw error if native token is A token', async () => {
    const aTokenAddress = NATIVE_MAS_COIN_ADDRESS;
    const bTokenAddress =
      'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
    const inputFeeRate = 0.89 * 10_000;

    const aAmount = 2;
    const bAmount = 3;
    const minAAmount = 0;
    const minBAmount = 0;

    //   increase allownace for tokenA
    await increaseAllownace(
      bTokenAddress,
      registryContract.address,
      aAmount,
      user1Provider,
    );

    //   Create a new pool with liquidity
    await createNewPoolWithLiquidity(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      aAmount,
      bAmount,
      minAAmount,
      minBAmount,
      inputFeeRate,
      true,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      inputFeeRate,
    );

    const poolContract = new SmartContract(user1Provider, pool.poolAddress);

    expect(
      pool.aTokenddress,
      'A token address should be the B token Address',
    ).toBe(bTokenAddress);

    expect(pool.bTokenAddress, 'B token address should be wmas address').toBe(
      wmasAddress,
    );

    expect(pool.inputFeeRate, 'Input fee rate is not correct').toBe(
      inputFeeRate,
    );

    //   get pool reserves
    const [aReserve, bReserve] = await getPoolReserves(poolContract);

    expect(aReserve, 'A reserve should be equals to aAmount').toBe(
      parseMas(aAmount.toString()),
    );

    expect(bReserve, 'B reserve should be equals to bAmount').toBe(
      parseMas(bAmount.toString()),
    );
  });
});
