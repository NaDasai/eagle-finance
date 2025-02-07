import { beforeAll, describe, expect, it, test } from 'vitest';
import * as dotenv from 'dotenv';
import {
  Account,
  Args,
  formatMas,
  formatUnits,
  Mas,
  MRC20,
  parseMas,
  parseUnits,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import {
  createNewPool,
  deployRegistryContract,
  getPools,
} from './calls/registry';
import { Pool } from '../src/builnet-tests/structs/pool';
import {
  calculateExpectedSwapAddedAmount,
  calculateProtocolFeeAmount,
  getScByteCode,
  NATIVE_MAS_COIN_ADDRESS,
  truncateDecimals,
} from './utils';
import {
  addLiquidity,
  addLiquidityWithMAS,
  claimeProtocolFees,
  getAPriceCumulativeLast,
  getBClaimableProtocolFee,
  getBPriceCumulativeLast,
  getLPBalance,
  getPoolReserves,
  getSwapOutEstimation,
  getTokenBalance,
  increaseAllownace,
  removeLiquidity,
  removeLiquidityUsingPercentage,
  swap,
  swapWithMAS,
  syncReserves,
} from './calls/basicPool';
import { mrc20TransferTo } from './calls/token';

dotenv.config();

const user1Provider = Web3Provider.buildnet(await Account.fromEnv());
const user2Provider = Web3Provider.buildnet(
  await Account.fromEnv('PRIVATE_KEY_TWO'),
);

console.log('User1 address: ', user1Provider.address);
console.log('User2 address: ', user2Provider.address);

const wmasAddress = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';
let aTokenAddress = 'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
const bTokenAddress = wmasAddress;
let poolFeeRate = 0;

let registryContract: SmartContract;
let poolContract: SmartContract;
let poolAddress: string;
let aClaimableFees: number;
let bClaimableFees: number;

describe('Sync reserves tests', async () => {
  beforeAll(async () => {
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      0.05,
      0.3,
    );

    // create new pool
    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    const pools = await getPools(registryContract);

    console.log('Pools: ', pools);

    expect(pools.length > 0, 'No pools found');

    // get the last pool address
    poolAddress = pools[pools.length - 1].poolAddress;

    poolContract = new SmartContract(user1Provider, poolAddress);
    aClaimableFees = 0;
    bClaimableFees = 0;
  });

  test('Should allow owner of the registry to sync reserves.', async () => {
    // Get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

    const aAmount = 1;
    const bAmount = 2;

    //Transfer amoutns to the pool contract
    const aTokenContract = new MRC20(user1Provider, aTokenAddress);
    const bTokenContract = new MRC20(user1Provider, bTokenAddress);

    await mrc20TransferTo(aTokenContract, poolContract.address, aAmount);
    await mrc20TransferTo(bTokenContract, poolContract.address, bAmount);

    // get the pool reserves and pool contract balances after transfer
    const [reserveAAfterTransfer, reserveBAfterTransfer] =
      await getPoolReserves(poolContract);

    const poolContractBalanceAAfter = await getTokenBalance(
      aTokenAddress,
      poolContract.address,
      user1Provider,
    );

    const poolContractBalanceBAfter = await getTokenBalance(
      bTokenAddress,
      poolContract.address,
      user1Provider,
    );

    expect(reserveAAfterTransfer, 'Reserve should be 0 ').toBe(0n);
    expect(reserveBAfterTransfer, 'Reserve should be 0 ').toBe(0n);

    expect(
      poolContractBalanceAAfter,
      'Pool contract balance should be 1 ',
    ).toBe(parseMas(aAmount.toString()));

    expect(
      poolContractBalanceBAfter,
      'Pool contract balance should be 1 ',
    ).toBe(parseMas(bAmount.toString()));

    // Sync reserves
    await syncReserves(poolContract);

    // Get the pool reserves and pool contract balances after sync
    const [reserveAAfterSync, reserveBAfterSync] = await getPoolReserves(
      poolContract,
    );

    // expect them to be the same as the transfer amount
    expect(reserveAAfterSync, 'Reserve should be 1').toBe(
      parseMas(aAmount.toString()),
    );
    expect(reserveBAfterSync, 'Reserve should be 1').toBe(
      parseMas(bAmount.toString()),
    );
  });

  test('Should throw error by not allowing non-owner of the registry to sync reserves.', async () => {
    // switch pool contract to user2
    poolContract = new SmartContract(user2Provider, poolAddress);

    // Get all pool reserves and expect them to be 1
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 1').toBe(parseMas('1'));
    expect(reserveB, 'Reserve should be 1').toBe(parseMas('2'));

    // Sync reserves by non owner
    await expect(syncReserves(poolContract)).rejects.toThrow(
      'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: VM execution error: RuntimeError: Runtime error: error: Caller is not the owner at assembly/utils/ownership-internal.ts:49 col: 3',
    );
  });
});
