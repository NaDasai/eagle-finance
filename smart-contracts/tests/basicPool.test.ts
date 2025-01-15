import { beforeAll, describe, expect, it, test } from 'vitest';
import * as dotenv from 'dotenv';
import {
  Account,
  Args,
  formatMas,
  Mas,
  MRC20,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { createNewPool } from './calls/registry';
import { Pool } from '../src/builnet-tests/structs/pool';
import { getScByteCode } from './utils';
import {
  addLiquidity,
  getLPBalance,
  getPoolReserves,
  getTokenBalance,
  increaseAllownace,
  removeLiquidity,
  swap,
} from './calls/basicPool';

dotenv.config();

const user1Provider = Web3Provider.buildnet(await Account.fromEnv());
const user2Provider = Web3Provider.buildnet(
  await Account.fromEnv('PRIVATE_KEY_TWO'),
);

console.log('User1 address: ', user1Provider.address);
console.log('User2 address: ', user2Provider.address);

describe('Scenario 1: Add liquidity, Swap, Remove liquidity', async () => {
  const wmasAddress = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';
  const aTokenAddress = 'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
  //   const bTokenAddress = 'AS1mb6djKDu2LnhQtajuLPGX1J2PNYgCY2LoUxQxa69ABUgedJXN';
  const bTokenAddress = wmasAddress;
  const poolFeeRate = 0;

  const registryByteCode = getScByteCode('build', 'registry.wasm');

  const constructorArgs = new Args()
    .addF64(0) // 0% fee share protocol
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

  const registryAddress = contract.address.toString();

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
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0);

    const user1ATokenBalanceBefore = await getTokenBalance(
      aTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    const user1BTokenBalanceBefore = await getTokenBalance(
      bTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    console.log('User1 A Token balance before: ', user1ATokenBalanceBefore);
    console.log('User1 B Token balance before: ', user1BTokenBalanceBefore);

    const aAmount = 10;
    const bAmount = 10;

    // increase allowance of both tokerns amoutns first before adding liquidity
    await increaseAllownace(aTokenAddress, poolAddress, aAmount, user1Provider);
    await increaseAllownace(bTokenAddress, poolAddress, bAmount, user1Provider);

    // add liquidity
    await addLiquidity(poolContract, aAmount, bAmount, 0, 0);

    // get teh reserves
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    const user1ATokenBalanceAfter = await getTokenBalance(
      aTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    const user1BTokenBalanceAfter = await getTokenBalance(
      bTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    console.log('User1 A Token balance after: ', user1ATokenBalanceAfter);
    console.log('User1 B Token balance after: ', user1BTokenBalanceAfter);

    expect(
      user1ATokenBalanceAfter,
      'User1 A Token balance should decrease after adding liquidity',
    ).toBeLessThan(user1ATokenBalanceBefore);

    expect(
      user1BTokenBalanceAfter,
      'User1 B Token balance should decrease after adding liquidity',
    ).toBeLessThan(user1BTokenBalanceBefore);

    expect(reserveAAfter, 'Reserve A should be 10 after adding liquidity').toBe(
      10,
    );

    expect(reserveBAfter, 'Reserve B should be 10 after adding liquidity').toBe(
      10,
    );

    // get the lp balance of user1
    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance: ', user1LPBalance);

    expect(user1LPBalance, 'User1 LP balance should be 10').toBe(10);
  });

  test("User 2 swaps B token for A token in pool's reserves", async () => {
    // switch poolContrcat to user2 provider
    poolContract = new SmartContract(user2Provider, poolAddress);

    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    console.log('Reserve A before swap: ', reserveA);
    console.log('Reserve B before swap: ', reserveB);

    expect(reserveA, 'Reserve A should be 10 before swap').toBe(10);
    expect(reserveB, 'Reserve B should be 10 before swap').toBe(10);

    const initialK = reserveA * reserveB;

    console.log('Initial K: ', initialK);

    const bSwapAmount = 5;
    const minASwapOutAmount = 2;

    const user2ATokenBalanceBefore = await getTokenBalance(
      aTokenAddress,
      user2Provider.address,
      user2Provider,
    );

    const user2BTokenBalanceBefore = await getTokenBalance(
      bTokenAddress,
      user2Provider.address,
      user2Provider,
    );

    console.log('User2 A Token balance before: ', user2ATokenBalanceBefore);
    console.log('User2 B Token balance before: ', user2BTokenBalanceBefore);

    expect(
      user2BTokenBalanceBefore,
      'User2 B Token balance should be greater than or equals to swap amount',
    ).toBeGreaterThanOrEqual(bSwapAmount);

    // increase allownace for BToken
    await increaseAllownace(
      bTokenAddress,
      poolAddress,
      bSwapAmount,
      user2Provider,
    );

    // swap B token for A token
    await swap(poolContract, bTokenAddress, bSwapAmount, minASwapOutAmount);

    // get reserves after swap
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after swap: ', reserveAAfter);
    console.log('Reserve B after swap: ', reserveBAfter);

    // get user2 balances after swap
    const user2ATokenBalanceAfter = await getTokenBalance(
      aTokenAddress,
      user2Provider.address,
      user2Provider,
    );

    const user2BTokenBalanceAfter = await getTokenBalance(
      bTokenAddress,
      user2Provider.address,
      user2Provider,
    );

    console.log('User2 A Token balance after: ', user2ATokenBalanceAfter);

    console.log('User2 B Token balance after: ', user2BTokenBalanceAfter);

    const finalK = reserveAAfter * reserveBAfter;

    console.log('Final K: ', finalK);

    expect(
      finalK,
      'Final K should be greater than or equal to initial K',
    ).toBeGreaterThanOrEqual(initialK);
  });

  test('User 1 removes its liquidity from pool', async () => {
    // switch poolContrcat to user1 provider
    poolContract = new SmartContract(user1Provider, poolAddress);

    // get all pool reserves
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    console.log('Reserve A before remove liquidity: ', reserveA);
    console.log('Reserve B before remove liquidity: ', reserveB);

    const user1ATokenBalanceBefore = await getTokenBalance(
      aTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    const user1BTokenBalanceBefore = await getTokenBalance(
      bTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    console.log('User1 A Token balance before: ', user1ATokenBalanceBefore);
    console.log('User1 B Token balance before: ', user1BTokenBalanceBefore);

    const user1LPBalanceBefore = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance before: ', user1LPBalanceBefore);

    expect(
      user1LPBalanceBefore,
      'User1 LP balance should be equals to 10 before removing liquidity',
    ).toBe(10);

    const lpAmount = 10;
    const minAOutAmount = 0;
    const minBOutAmount = 0;

    // remove liquidity
    await removeLiquidity(poolContract, lpAmount, minAOutAmount, minBOutAmount);

    // get reserves after remove liquidity
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after remove liquidity: ', reserveAAfter);
    console.log('Reserve B after remove liquidity: ', reserveBAfter);

    const user1ATokenBalanceAfter = await getTokenBalance(
      aTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    const user1BTokenBalanceAfter = await getTokenBalance(
      bTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    console.log('User1 A Token balance after: ', user1ATokenBalanceAfter);
    console.log('User1 B Token balance after: ', user1BTokenBalanceAfter);

    expect(
      user1ATokenBalanceAfter,
      'User1 A Token balance should increase after removing liquidity',
    ).toBeGreaterThan(user1ATokenBalanceBefore);

    expect(
      user1BTokenBalanceAfter,
      'User1 B Token balance should increase after removing liquidity',
    ).toBeGreaterThan(user1BTokenBalanceBefore);

    const lpAmountAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance after: ', lpAmountAfter);

    expect(
      lpAmountAfter,
      'User1 LP balance should be 0 after removing liquidity',
    ).toBe(0);
  });
});
