/**
 * Basic Pool Tests
 *
 * Note on test execution:
 * - By default, all test suites (describe blocks) will run
 * - Use describe.only() to run only specific test suites
 * - Example: describe.only('Scenario 6', ...) will run only Scenario 6
 * - Multiple describe.only() can be used to run multiple specific scenarios
 * - Use describe.skip() to skip specific test suites
 */

import { beforeAll, describe, expect, it, test } from 'vitest';
import * as dotenv from 'dotenv';
import {
  Account,
  Args,
  formatMas,
  formatUnits,
  Mas,
  MRC20,
  OperationStatus,
  parseMas,
  parseUnits,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import {
  createNewPool,
  deployRegistryContract,
  getPool,
  getSwapRouterAddress,
  setSwapRouterAddress,
} from './calls/registry';
import { Pool } from '../src/builnet-tests/structs/pool';
import {
  getScByteCode,
  NATIVE_MAS_COIN_ADDRESS,
  TOKEN_DEFAULT_DECIMALS,
  truncateDecimals,
} from './utils';
import {
  addLiquidity,
  addLiquidityWithMAS,
  getAPriceCumulativeLast,
  getBPriceCumulativeLast,
  getLPBalance,
  getPoolLPTotalSupply,
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
import {
  deploySwapRouterContract,
  getRouteLimit,
  setRouteLimit,
} from './calls/swapRouter';
import { SwapPath } from './classes/swapPath';

dotenv.config();

const user1Provider = Web3Provider.buildnet(await Account.fromEnv());
const user2Provider = Web3Provider.buildnet(
  await Account.fromEnv('PRIVATE_KEY_TWO'),
);

console.log('User1 address: ', user1Provider.address);
console.log('User2 address: ', user2Provider.address);

const wmasAddress = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';
let aTokenAddress = 'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
let bTokenAddress = wmasAddress;
let poolFeeRate = 0;

let registryContract: SmartContract;
let poolContract: SmartContract;
let swapRouterContract: SmartContract;
let poolAddress: string;

describe.skip('Scenario 6: Add liquidity, swap and remove using low amounts', async () => {
  beforeAll(async () => {
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      0.05,
    );

    swapRouterContract = await deploySwapRouterContract(
      user1Provider,
      registryContract.address,
    );

    // Set the swap router address in the registry contract
    await setSwapRouterAddress(registryContract, swapRouterContract.address);

    // create new pool
    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    // get the last pool address
    poolAddress = pool.poolAddress;

    poolContract = new SmartContract(user1Provider, poolAddress);
  });

  test('User 1 Add liquidity to pool when its empty', async () => {
    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

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

    const aAmount = 0.00001;
    const bAmount = 0.00001;

    // increase allowance of both tokerns amoutns first before adding liquidity
    await increaseAllownace(aTokenAddress, poolAddress, aAmount, user1Provider);
    await increaseAllownace(bTokenAddress, poolAddress, bAmount, user1Provider);

    // add liquidity
    await addLiquidity(poolContract, aAmount, bAmount, 0, 0);

    // get teh reserves
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

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

    expect(
      user1ATokenBalanceAfter,
      'User1 A Token balance should decrease after adding liquidity',
    ).toBe(user1ATokenBalanceBefore - parseMas(aAmount.toString()));

    expect(
      user1BTokenBalanceAfter,
      'User1 B Token balance should decrease after adding liquidity',
    ).toBe(user1BTokenBalanceBefore - parseMas(bAmount.toString()));

    expect(
      reserveAAfter,
      'Reserve A should be aAmount after adding liquidity',
    ).toBe(parseMas(aAmount.toString()));

    expect(
      reserveBAfter,
      'Reserve B should be bAmount after adding liquidity',
    ).toBe(parseMas(bAmount.toString()));

    // get the lp balance of user1
    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    const poolTotalSupply = await getPoolLPTotalSupply(poolContract);

    console.log('User1 LP balance: ', user1LPBalance);
    console.log('Pool total supply: ', poolTotalSupply);
    // expect(poolTotalSupply, 'Pool total supply should be 0.1').toBe(
    //   parseMas(Math.sqrt(aAmount * bAmount).toString()),
    // );
  });

  test("User 2 swaps B token for A token in pool's reserves", async () => {
    // switch poolContract to user2
    poolContract = new SmartContract(user2Provider, poolAddress);
    swapRouterContract = new SmartContract(
      user2Provider,
      swapRouterContract.address,
    );

    // get all pool reserves
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    const initialK = reserveA * reserveB;

    console.log('Initial K: ', initialK);
    console.log('Reserve A: ', reserveA);
    console.log('Reserve B: ', reserveB);

    // swap B token for A token
    const bSwapAmount = 0.00001;

    const expectedaAmountOut = await getSwapOutEstimation(
      poolContract,
      bSwapAmount,
      bTokenAddress,
    );

    const minAmountOut = 0.000001;

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

    expect(
      user2BTokenBalanceBefore,
      'User2 B Token balance should be greater than or equals to swap amount',
    ).toBeGreaterThanOrEqual(parseMas(bSwapAmount.toString()));

    // increase allownace for BToken
    await increaseAllownace(
      bTokenAddress,
      swapRouterContract.address,
      bSwapAmount,
      user2Provider,
    );

    // Generate the swap route data
    const swapRoute = [
      new SwapPath(
        poolContract.address,
        bTokenAddress,
        aTokenAddress,
        user2Provider.address,
        parseMas(bSwapAmount.toString()),
        parseUnits(minAmountOut.toString(), TOKEN_DEFAULT_DECIMALS),
        true,
      ),
    ];

    // swap B token for A token
    await swap(swapRouterContract, swapRoute, '0.01');

    // get reserves after swap
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

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

    const finalK = reserveAAfter * reserveBAfter;

    expect(
      reserveAAfter,
      'Reserve A After should be equals to initial reserve A - expectedOutAmount',
    ).toBe(reserveA - expectedaAmountOut);

    expect(
      reserveBAfter,
      'Reserve B After should be equals to initial reserve B + swap amount',
    ).toBe(reserveB + parseMas(bSwapAmount.toString()));

    expect(finalK, 'Final K should be greater than initial K').toBeGreaterThan(
      initialK,
    );

    expect(
      user2ATokenBalanceAfter,
      'User2 A Token balance should increase after swap',
    ).toBe(user2ATokenBalanceBefore + expectedaAmountOut);

    expect(
      user2BTokenBalanceAfter,
      'User2 B Token balance should increase after swap',
    ).toBe(user2BTokenBalanceBefore - parseMas(bSwapAmount.toString()));
  });

  test('User 1 removes its full liquidity', async () => {
    // switch poolContract to user1
    poolContract = new SmartContract(user1Provider, poolAddress);

    // get all pool reserves
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

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

    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    expect(
      user1LPBalance,
      'User1 LP balance should be greater than 0',
    ).toBeGreaterThan(0n);

    const lpPercentage = 100; // 100%

    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      lpPercentage,
      0,
      0,
    );

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

    const user1LPBalanceAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    expect(
      user1LPBalanceAfter,
      'User1 A Token balance should be 0 after removing full liquidity',
    ).toBe(0n);
  });
});

describe.skip('Scenario 3: Add liquidity, Swap, Remove liquidity with input fees', async () => {
  beforeAll(async () => {
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      0.05,
    );

    swapRouterContract = await deploySwapRouterContract(
      user1Provider,
      registryContract.address,
    );

    // Set the swap router address in the registry contract
    await setSwapRouterAddress(registryContract, swapRouterContract.address);

    // create new pool
    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    // get the last pool address
    poolAddress = pool.poolAddress;

    poolContract = new SmartContract(user1Provider, poolAddress);
  });

  test('User 1 Add liquidity to pool when its empty', async () => {
    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

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

    console.log('Reserve A after: ', formatMas(reserveAAfter));
    console.log('Reserve B after: ', formatMas(reserveBAfter));

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
      parseMas('10'),
    );

    expect(reserveBAfter, 'Reserve B should be 10 after adding liquidity').toBe(
      parseMas('10'),
    );

    // get the lp balance of user1
    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance: ', user1LPBalance);

    // expect(user1LPBalance, 'User1 LP balance should be 9.999999999999999').toBe(
    //   parseUnits('9.999999999999999', 18),
    // );
  });

  test("User 2 swaps B token for A token in pool's reserves", async () => {
    // switch poolContrcat to user2 provider
    poolContract = new SmartContract(user2Provider, poolAddress);
    swapRouterContract = new SmartContract(
      user2Provider,
      swapRouterContract.address,
    );

    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    console.log('Reserve A before swap: ', reserveA);
    console.log('Reserve B before swap: ', reserveB);

    expect(reserveA, 'Reserve A should be 10 before swap').toBe(parseMas('10'));
    expect(reserveB, 'Reserve B should be 10 before swap').toBe(parseMas('10'));

    const initialK = reserveA * reserveB;

    console.log('Initial K: ', initialK);

    const bSwapAmount = 5;
    const minASwapOutAmount = 2;
    const bFeeRate = (5 * 0.3) / 100;

    console.log('B swap amount: ', bSwapAmount);
    console.log('B fee rate: ', bFeeRate);

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
      swapRouterContract.address,
      bSwapAmount,
      user2Provider,
    );

    // Generate Swap Route
    const swapRoute = [
      new SwapPath(
        poolContract.address,
        bTokenAddress,
        aTokenAddress,
        user2Provider.address,
        parseMas(bSwapAmount.toString()),
        parseUnits(minASwapOutAmount.toString(), TOKEN_DEFAULT_DECIMALS),
        true,
      ),
    ];

    // swap B token for A token
    await swap(swapRouterContract, swapRoute, '0.01');

    // get reserves after swap
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after swap: ', formatMas(reserveAAfter));
    console.log('Reserve B after swap: ', formatMas(reserveBAfter));
    console.log('Reserve A after swap: ', reserveAAfter);

    expect(reserveAAfter, 'Reserve A should be 6.673340007 after swap').toBe(
      6673340007n,
    );

    expect(
      reserveBAfter,
      'Reserve B should be 14.985 due (15 - 0.015) after swap',
    ).toBe(parseMas('14.9999925'));

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

    const priceAfterSwap =
      Number(formatMas(reserveBAfter)) / Number(formatUnits(reserveAAfter, 9));
    console.log('Price after swap: ', priceAfterSwap);
  });

  test('User 1 removes its liquidity from pool', async () => {
    // switch to user1
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

    const lpAmount = 100;
    const minAOutAmount = 0;
    const minBOutAmount = 0;

    // remove liquidity
    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      lpAmount,
      minAOutAmount,
      minBOutAmount,
    );

    // get reserves after remove liquidity
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after remove liquidity: ', formatMas(reserveAAfter));
    console.log('Reserve B after remove liquidity: ', formatMas(reserveBAfter));

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
    ).toBe(parseMas('0'));

    const priceAofB =
      Number(formatMas(reserveBAfter)) / Number(formatUnits(reserveAAfter, 9));

    console.log('Price A of B: ', priceAofB);
  });
});

describe.skip('Tesing workflow using different decimals tokens', async () => {
  beforeAll(async () => {
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      0.05,
    );

    swapRouterContract = await deploySwapRouterContract(
      user1Provider,
      registryContract.address,
    );

    aTokenAddress = 'AS12aNMSht9Z2kBetknPbQ89phVT84DMjeoZKG3iW9xRArt5ep3Qb';

    // Set the swap router address in the registry contract
    await setSwapRouterAddress(registryContract, swapRouterContract.address);

    // create new pool
    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    // get the last pool address
    poolAddress = pool.poolAddress;

    poolContract = new SmartContract(user1Provider, poolAddress);
  });

  test('User 1 Add liquidity to pool when its empty', async () => {
    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

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

    console.log('Reserve A after: ', formatMas(reserveAAfter));
    console.log('Reserve B after: ', formatMas(reserveBAfter));

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
      parseMas('10'),
    );

    expect(reserveBAfter, 'Reserve B should be 10 after adding liquidity').toBe(
      parseMas('10'),
    );

    // get the lp balance of user1
    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance: ', user1LPBalance);
  });

  test("User 2 swaps B token for A token in pool's reserves", async () => {
    // switch poolContrcat to user2 provider
    poolContract = new SmartContract(user2Provider, poolAddress);
    swapRouterContract = new SmartContract(
      user2Provider,
      swapRouterContract.address,
    );

    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    console.log('Reserve A before swap: ', reserveA);
    console.log('Reserve B before swap: ', reserveB);

    expect(reserveA, 'Reserve A should be 10 before swap').toBe(parseMas('10'));
    expect(reserveB, 'Reserve B should be 10 before swap').toBe(parseMas('10'));

    const initialK = reserveA * reserveB;

    console.log('Initial K: ', initialK);

    const bSwapAmount = 5;
    const minASwapOutAmount = 2;
    const bFeeRate = (5 * 0.3) / 100;

    console.log('B swap amount: ', bSwapAmount);
    console.log('B fee rate: ', bFeeRate);

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
      swapRouterContract.address,
      bSwapAmount,
      user2Provider,
    );

    // Generate Swap Route
    const swapRoute = [
      new SwapPath(
        poolContract.address,
        bTokenAddress,
        aTokenAddress,
        user2Provider.address,
        parseMas(bSwapAmount.toString()),
        parseUnits(minASwapOutAmount.toString(), TOKEN_DEFAULT_DECIMALS),
        true,
      ),
    ];

    // swap B token for A token
    await swap(swapRouterContract, swapRoute, '0.01', Mas.fromString('0.1'));

    // get reserves after swap
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after swap: ', formatMas(reserveAAfter));
    console.log('Reserve B after swap: ', formatMas(reserveBAfter));
    console.log('Reserve A after swap: ', reserveAAfter);

    expect(reserveAAfter, 'Reserve A should be 6.673340007 after swap').toBe(
      6673340007n,
    );

    expect(
      reserveBAfter,
      'Reserve B should be 14.985 due (15 - 0.015) after swap',
    ).toBe(parseMas('14.9999925'));

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
    // switch to user1
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

    const lpAmount = 100;
    const minAOutAmount = 0;
    const minBOutAmount = 0;

    // remove liquidity
    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      lpAmount,
      minAOutAmount,
      minBOutAmount,
    );

    // get reserves after remove liquidity
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after remove liquidity: ', formatMas(reserveAAfter));
    console.log('Reserve B after remove liquidity: ', formatMas(reserveBAfter));

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
    ).toBe(parseMas('0'));

    const poolTotalSupply = await getPoolLPTotalSupply(poolContract);
    console.log('Pool total supply: ', poolTotalSupply);

    expect(poolTotalSupply, 'Pool total supply should be 0').toBe(1000n);
  });
});

describe.skip('Should fail when trying to swap without passing by the swap Router', async () => {
  beforeAll(async () => {
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      0.05,
    );

    swapRouterContract = await deploySwapRouterContract(
      user1Provider,
      registryContract.address,
    );

    // Set the swap router address in the registry contract
    await setSwapRouterAddress(registryContract, swapRouterContract.address);

    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    // get the last pool address
    poolAddress = pool.poolAddress;

    poolContract = new SmartContract(user1Provider, poolAddress);
  });

  test('User 1 Add liquidity to pool when its empty', async () => {
    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

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

    console.log('Reserve A after: ', formatMas(reserveAAfter));
    console.log('Reserve B after: ', formatMas(reserveBAfter));

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
      parseMas('10'),
    );

    expect(reserveBAfter, 'Reserve B should be 10 after adding liquidity').toBe(
      parseMas('10'),
    );

    // get the lp balance of user1
    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance: ', user1LPBalance);

    expect(user1LPBalance, 'User1 LP balance should be 10').toBe(9999999000n);
  });

  test('User 2 should not be able to swaps B token for A token directly without swap router', async () => {
    // switch poolContrcat to user2 provider
    poolContract = new SmartContract(user2Provider, poolAddress);

    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    console.log('Reserve A before swap: ', reserveA);
    console.log('Reserve B before swap: ', reserveB);

    expect(reserveA, 'Reserve A should be 10 before swap').toBe(parseMas('10'));
    expect(reserveB, 'Reserve B should be 10 before swap').toBe(parseMas('10'));

    const initialK = reserveA * reserveB;

    console.log('Initial K: ', initialK);

    const bSwapAmount = 5;
    const minASwapOutAmount = 2;
    const bFeeRate = (5 * 0.3) / 100;

    console.log('B swap amount: ', bSwapAmount);
    console.log('B fee rate: ', bFeeRate);

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

    // swap B token for A token directly without swap router
    const swapArgs = new Args()
      .addString(bTokenAddress)
      .addU256(parseMas(bSwapAmount.toString()))
      .addU256(parseUnits(minASwapOutAmount.toString(), TOKEN_DEFAULT_DECIMALS))
      .addString(user2Provider.address)
      .addBool(false)
      .serialize();

    const operation = await expect(
      poolContract.call('swap', swapArgs, {
        coins: Mas.fromString('0.01'),
      }),
    ).rejects.toThrowError(
      'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: VM execution error: RuntimeError: Runtime error: error: Caller is not the swap router stored in the registry. at assembly/contracts/basicPool.ts:425 col: 3',
    );
  });
});

describe.skip('Swap Router tests', async () => {
  beforeAll(async () => {
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      0.05,
    );

    swapRouterContract = await deploySwapRouterContract(
      user1Provider,
      registryContract.address,
    );

    // Set the swap router address in the registry contract
    await setSwapRouterAddress(registryContract, swapRouterContract.address);

    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    // get the last pool address
    poolAddress = pool.poolAddress;

    poolContract = new SmartContract(user1Provider, poolAddress);
  });

  test('Should get the swap router address from registry', async () => {
    const swapRouterAddress = await getSwapRouterAddress(registryContract);

    expect(swapRouterAddress).toBe(swapRouterContract.address);
  });

  test('Should get the route length limit and expect it to be 4', async () => {
    const routeLimit = await getRouteLimit(swapRouterContract);

    expect(routeLimit).toBe(4n);
  });

  test('Owner Should be able to update the swap router address', async () => {
    // Deploy a new swap router contract
    const newSwapRouterContract = await deploySwapRouterContract(
      user1Provider,
      registryContract.address,
    );

    await setSwapRouterAddress(registryContract, newSwapRouterContract.address);

    const swapRouterAddress = await getSwapRouterAddress(registryContract);

    // expect the swap router address to be the new swap router address
    expect(swapRouterAddress).toBe(newSwapRouterContract.address);
  });

  test('Should Fail when non owner trying to update the swap router address', async () => {
    // switch registry contract to user 2 which is not the owner
    registryContract = new SmartContract(
      user2Provider,
      registryContract.address,
    );

    await expect(
      setSwapRouterAddress(registryContract, swapRouterContract.address),
    ).rejects.toThrowError(
      'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: VM execution error: RuntimeError: Runtime error: error: Caller is not the owner at ~lib/@massalabs/sc-standards/assembly/contracts/utils/ownership-internal.ts:49 col: 3',
    );
  });

  test('Owner should be able to update the route length limit', async () => {
    // switch swap router contract to user 1 which is the owner
    swapRouterContract = new SmartContract(
      user1Provider,
      swapRouterContract.address,
    );

    // set the route limit to 5
    await setRouteLimit(swapRouterContract, 5);

    const routeLimit = await getRouteLimit(swapRouterContract);

    expect(routeLimit).toBe(5n);
  });

  test('Non owner should not be able to update the route length limit', async () => {
    // switch swap router contract to user 2 which is not the owner
    swapRouterContract = new SmartContract(
      user2Provider,
      swapRouterContract.address,
    );

    await expect(setRouteLimit(swapRouterContract, 5)).rejects.toThrowError(
      'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: VM execution error: RuntimeError: Runtime error: error: CALLER_IS_NOT_REGISTRY_OWNER at assembly/contracts/swapRouter.ts:321 col: 3',
    );
  });

  test.skip('User1 adds liquidity to the pool', async () => {
    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

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

    const aAmount = 10;
    const bAmount = 10;
    const minAmountA = 0;
    const minAmountB = 0;
    const aDecimals = TOKEN_DEFAULT_DECIMALS;
    const bDecimals = TOKEN_DEFAULT_DECIMALS;

    // increase allowance of both tokerns amoutns first before adding liquidity
    await increaseAllownace(
      aTokenAddress,
      poolAddress,
      aAmount,
      user1Provider,
      aDecimals,
    );

    await increaseAllownace(
      bTokenAddress,
      poolAddress,
      bAmount,
      user1Provider,
      bDecimals,
    );

    // add liquidity
    await addLiquidity(poolContract, aAmount, bAmount, minAmountA, minAmountB);

    // get the reserves after adding liquidity
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    expect(reserveAAfter, 'Reserve A should be 10 after adding liquidity').toBe(
      parseUnits('10', TOKEN_DEFAULT_DECIMALS),
    );

    expect(reserveBAfter, 'Reserve B should be 10 after adding liquidity').toBe(
      parseUnits('10', TOKEN_DEFAULT_DECIMALS),
    );

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

    // Expect balances beffore - after should be equal a_amount and b_amount
    expect(
      user1ATokenBalanceBefore - user1ATokenBalanceAfter,
      'User1 A Token balance should decrease after adding liquidity',
    ).toBe(parseUnits(aAmount.toString(), TOKEN_DEFAULT_DECIMALS));

    expect(
      user1BTokenBalanceBefore - user1BTokenBalanceAfter,
      'User1 B Token balance should decrease after adding liquidity',
    ).toBe(parseUnits(bAmount.toString(), TOKEN_DEFAULT_DECIMALS));
  });

  test('User 2 try to swap with a route length greater than 4', async () => {
    // switch to user 2*
    swapRouterContract = new SmartContract(
      user2Provider,
      swapRouterContract.address,
    );

    const bSwapAmount = 0.5;
    const minAmountOut = 0.000001;

    // route length is 6
    const swapRoute = [
      new SwapPath(
        poolContract.address,
        bTokenAddress,
        aTokenAddress,
        user2Provider.address,
        parseMas(bSwapAmount.toString()),
        parseUnits(minAmountOut.toString(), TOKEN_DEFAULT_DECIMALS),
        true,
      ),
      new SwapPath(
        poolContract.address,
        bTokenAddress,
        aTokenAddress,
        user2Provider.address,
        parseMas(bSwapAmount.toString()),
        parseUnits(minAmountOut.toString(), TOKEN_DEFAULT_DECIMALS),
        true,
      ),
      new SwapPath(
        poolContract.address,
        bTokenAddress,
        aTokenAddress,
        user2Provider.address,
        parseMas(bSwapAmount.toString()),
        parseUnits(minAmountOut.toString(), TOKEN_DEFAULT_DECIMALS),
        true,
      ),

      new SwapPath(
        poolContract.address,
        bTokenAddress,
        aTokenAddress,
        user2Provider.address,
        parseMas(bSwapAmount.toString()),
        parseUnits(minAmountOut.toString(), TOKEN_DEFAULT_DECIMALS),
        true,
      ),
      new SwapPath(
        poolContract.address,
        bTokenAddress,
        aTokenAddress,
        user2Provider.address,
        parseMas(bSwapAmount.toString()),
        parseUnits(minAmountOut.toString(), TOKEN_DEFAULT_DECIMALS),
        true,
      ),
      new SwapPath(
        poolContract.address,
        bTokenAddress,
        aTokenAddress,
        user2Provider.address,
        parseMas(bSwapAmount.toString()),
        parseUnits(minAmountOut.toString(), TOKEN_DEFAULT_DECIMALS),
        true,
      ),
    ];

    await expect(
      swap(swapRouterContract, swapRoute, '0.01'),
    ).rejects.toThrowError(
      'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: VM execution error: RuntimeError: Runtime error: error: INVALID_SWAP_PATH_ARRAY_LENGTH at assembly/contracts/swapRouter.ts:89 col: 3',
    );
  });
});

describe.skip('MINIMUM_LIQUIDITY tests with different token decimals (18-9)', async () => {
  beforeAll(async () => {
    aTokenAddress = 'AS1Jg6cLstoXEVe6uGr3gTd3dhWLVqFPbYcMuHjcpzRQTJMtvY9k';
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      25,
    );

    // create new pool
    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    // get the last pool address
    poolAddress = pool.poolAddress;

    poolContract = new SmartContract(user1Provider, poolAddress);
  });

  test('User 1 adds liquidity to the pool', async () => {
    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

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

    const aAmount = 10;
    const bAmount = 10;

    // increase allowance of both tokerns amoutns first before adding liquidity
    await increaseAllownace(
      aTokenAddress,
      poolAddress,
      aAmount,
      user1Provider,
      18,
    );
    await increaseAllownace(bTokenAddress, poolAddress, bAmount, user1Provider);

    // add liquidity
    await addLiquidity(poolContract, aAmount, bAmount, 0, 0, 18);

    // get teh reserves
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    expect(reserveAAfter, 'Reserve A should be 10 after adding liquidity').toBe(
      parseUnits('10', 18),
    );

    expect(reserveBAfter, 'Reserve B should be 10 after adding liquidity').toBe(
      parseMas('10'),
    );

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
    // Expect balances beffore - after should be equal a_amount and b_amount
    expect(
      user1ATokenBalanceBefore - user1ATokenBalanceAfter,
      'User1 A Token balance should decrease after adding liquidity',
    ).toBe(parseUnits(aAmount.toString(), 18));

    expect(
      user1BTokenBalanceBefore - user1BTokenBalanceAfter,
      'User1 B Token balance should decrease after adding liquidity',
    ).toBe(parseMas(bAmount.toString()));

    // get the lp balance of user1
    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance: ', user1LPBalance);

    // Get pool total supply
    const poolTotalSupply = await getPoolLPTotalSupply(poolContract);
    console.log('Pool total supply: ', poolTotalSupply);

    // expect the pool total supply to be 10
    expect(poolTotalSupply, 'Pool total supply should be 10').toBe(
      parseUnits('10', 18),
    );

    const priceAofB =
      Number(formatMas(reserveBAfter)) / Number(formatUnits(reserveAAfter, 18));
    console.log('Price A of B: ', priceAofB);
    expect(priceAofB, 'Price A of B should be 1').toBe(1);
  });

  test('User 1 Should be able to remove liquidity minus the MINIMUM_LIQUIDITY', async () => {
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

    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      100,
      0,
      0,
      18,
      9,
    );

    const lpBalanceAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    expect(lpBalanceAfter, 'User1 LP balance should be 0').toBe(0n);

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    const priceAofB =
      Number(formatMas(reserveBAfter)) / Number(formatUnits(reserveAAfter, 18));
    console.log('Price A of B: ', priceAofB);
    expect(priceAofB, 'Price A of B should be 1').toBe(1);
  });
});

describe.skip('MINIMUM_LIQUIDITY test with same token decimals (9)', async () => {
  beforeAll(async () => {
    aTokenAddress = 'AS1wEisPRcU4pMddXoCdjQzBYqnVPHY652WwkRYDYMFzg7UBrw93';
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      25,
    );

    // create new pool
    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    // get the last pool address
    poolAddress = pool.poolAddress;

    poolContract = new SmartContract(user1Provider, poolAddress);
  });

  test('User 1 adds liquidity to the pool', async () => {
    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

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

    const aAmount = 10;
    const bAmount = 10;

    // increase allowance of both tokerns amoutns first before adding liquidity
    await increaseAllownace(
      aTokenAddress,
      poolAddress,
      aAmount,
      user1Provider,
      9,
    );
    await increaseAllownace(bTokenAddress, poolAddress, bAmount, user1Provider);

    // add liquidity
    await addLiquidity(poolContract, aAmount, bAmount, 0, 0, 9);

    // get teh reserves
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    expect(reserveAAfter, 'Reserve A should be 10 after adding liquidity').toBe(
      parseUnits('10', 9),
    );

    expect(reserveBAfter, 'Reserve B should be 10 after adding liquidity').toBe(
      parseMas('10'),
    );

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
    // Expect balances beffore - after should be equal a_amount and b_amount
    expect(
      user1ATokenBalanceBefore - user1ATokenBalanceAfter,
      'User1 A Token balance should decrease after adding liquidity',
    ).toBe(parseUnits(aAmount.toString(), 9));

    expect(
      user1BTokenBalanceBefore - user1BTokenBalanceAfter,
      'User1 B Token balance should decrease after adding liquidity',
    ).toBe(parseMas(bAmount.toString()));

    // get the lp balance of user1
    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance: ', user1LPBalance);

    // Get pool total supply
    const poolTotalSupply = await getPoolLPTotalSupply(poolContract);
    console.log('Pool total supply: ', poolTotalSupply);

    // expect the pool total supply to be 10
    expect(poolTotalSupply, 'Pool total supply should be 10').toBe(
      parseUnits('10', 18),
    );

    const priceAofB =
      Number(formatMas(reserveBAfter)) / Number(formatUnits(reserveAAfter, 9));
    console.log('Price A of B: ', priceAofB);
    expect(priceAofB, 'Price A of B should be 1').toBe(1);
  });

  test('User 1 Should be able to remove liquidity minus the MINIMUM_LIQUIDITY', async () => {
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

    const lpBalanceBefore = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      100,
      0,
      0,
      9,
      9,
    );

    const lpBalanceAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    expect(lpBalanceAfter, 'User1 LP balance should be 0').toBe(0n);

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    const priceAofB =
      Number(formatMas(reserveBAfter)) / Number(formatUnits(reserveAAfter, 9));
    console.log('Price A of B: ', priceAofB);
    expect(priceAofB, 'Price A of B should be 1').toBe(1);
  });
});

describe.skip('MINIMUM_LIQUIDITY test with same token decimals (18)', async () => {
  beforeAll(async () => {
    aTokenAddress = 'AS12ipfgzeJtZ8pgB9LWwHH73Fpx75wr3kTBNxmMiADfn5m6dSmqg';
    bTokenAddress = 'AS12omtoowDkrZgdByGH16TDQL3vP9cTa35yUpQ9RHXxUACy2YB2v';

    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      25,
    );

    // create new pool
    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    // get the last pool address
    poolAddress = pool.poolAddress;

    poolContract = new SmartContract(user1Provider, poolAddress);
  });

  test('User 1 adds liquidity to the pool', async () => {
    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

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

    const aAmount = 10;
    const bAmount = 10;

    // increase allowance of both tokerns amoutns first before adding liquidity
    await increaseAllownace(
      aTokenAddress,
      poolAddress,
      aAmount,
      user1Provider,
      18,
    );
    await increaseAllownace(
      bTokenAddress,
      poolAddress,
      bAmount,
      user1Provider,
      18,
    );

    // add liquidity
    await addLiquidity(poolContract, aAmount, bAmount, 0, 0, 18, 18);

    // get teh reserves
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    expect(reserveAAfter, 'Reserve A should be 10 after adding liquidity').toBe(
      parseUnits('10', 18),
    );

    expect(reserveBAfter, 'Reserve B should be 10 after adding liquidity').toBe(
      parseUnits('10', 18),
    );

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
    // Expect balances beffore - after should be equal a_amount and b_amount
    expect(
      user1ATokenBalanceBefore - user1ATokenBalanceAfter,
      'User1 A Token balance should decrease after adding liquidity',
    ).toBe(parseUnits(aAmount.toString(), 18));

    expect(
      user1BTokenBalanceBefore - user1BTokenBalanceAfter,
      'User1 B Token balance should decrease after adding liquidity',
    ).toBe(parseUnits(bAmount.toString(), 18));

    // get the lp balance of user1
    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance: ', user1LPBalance);

    // Get pool total supply
    const poolTotalSupply = await getPoolLPTotalSupply(poolContract);
    console.log('Pool total supply: ', poolTotalSupply);

    const priceAofB =
      Number(formatUnits(reserveBAfter, 18)) /
      Number(formatUnits(reserveAAfter, 18));
    console.log('Price A of B: ', priceAofB);

    // expect the pool total supply to be 10
    expect(poolTotalSupply, 'Pool total supply should be 10').toBe(
      parseUnits('10', 18),
    );

    expect(priceAofB, 'Price A of B should be 1').toBe(1);
  });

  test('User 1 Should be able to remove liquidity minus the MINIMUM_LIQUIDITY', async () => {
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

    const lpBalanceBefore = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      100,
      0,
      0,
      18,
      18,
    );

    const lpBalanceAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    expect(lpBalanceAfter, 'User1 LP balance should be 0').toBe(0n);

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    const priceAofB =
      Number(formatUnits(reserveBAfter, 18)) /
      Number(formatUnits(reserveAAfter, 18));
    console.log('Price A of B: ', priceAofB);

    expect(priceAofB, 'Price A of B should be 1').toBe(1);
  });
});

describe.skip('Minimum liquidity test with different decimals (18 - 6) ', async () => {
  beforeAll(async () => {
    bTokenAddress = 'AS12ipfgzeJtZ8pgB9LWwHH73Fpx75wr3kTBNxmMiADfn5m6dSmqg'; // 18 decimals
    aTokenAddress = 'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ'; // 6 decimals

    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      25,
    );

    // create new pool
    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    // get the last pool address
    poolAddress = pool.poolAddress;

    poolContract = new SmartContract(user1Provider, poolAddress);
  });

  test('User 1 adds liquidity to the pool', async () => {
    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

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

    const aAmount = 10;
    const bAmount = 10;

    // increase allowance of both tokerns amoutns first before adding liquidity
    await increaseAllownace(
      aTokenAddress,
      poolAddress,
      aAmount,
      user1Provider,
      6,
    );
    await increaseAllownace(
      bTokenAddress,
      poolAddress,
      bAmount,
      user1Provider,
      18,
    );

    // Get allowance of both tokens
    const aTokenAllowance = await new MRC20(
      user1Provider,
      aTokenAddress,
    ).allowance(user1Provider.address, poolAddress);

    const bTokenAllowance = await new MRC20(
      user1Provider,
      bTokenAddress,
    ).allowance(user1Provider.address, poolAddress);

    console.log('aTokenAllowance: ', aTokenAllowance);
    console.log('bTokenAllowance: ', bTokenAllowance);

    // add liquidity
    await addLiquidity(poolContract, aAmount, bAmount, 0, 0, 6, 18);

    // get teh reserves
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    expect(reserveAAfter, 'Reserve A should be 10 after adding liquidity').toBe(
      parseUnits('10', 6),
    );

    expect(reserveBAfter, 'Reserve B should be 10 after adding liquidity').toBe(
      parseUnits('10', 18),
    );

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
    // Expect balances beffore - after should be equal a_amount and b_amount
    expect(
      user1ATokenBalanceBefore - user1ATokenBalanceAfter,
      'User1 A Token balance should decrease after adding liquidity',
    ).toBe(parseUnits(aAmount.toString(), 6));

    expect(
      user1BTokenBalanceBefore - user1BTokenBalanceAfter,
      'User1 B Token balance should decrease after adding liquidity',
    ).toBe(parseUnits(bAmount.toString(), 18));

    // get the lp balance of user1
    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance: ', user1LPBalance);

    // Get pool total supply
    const poolTotalSupply = await getPoolLPTotalSupply(poolContract);
    console.log('Pool total supply: ', poolTotalSupply);

    // expect the pool total supply to be 10
    expect(poolTotalSupply, 'Pool total supply should be 10').toBe(
      parseUnits('10', 18),
    );

    const priceAofB =
      Number(formatUnits(reserveBAfter, 18)) /
      Number(formatUnits(reserveAAfter, 6));
    console.log('Price A of B: ', priceAofB);

    expect(priceAofB, 'Price A of B should be 1').toBe(1);
  });

  test('User 1 Should be able to remove liquidity minus the MINIMUM_LIQUIDITY', async () => {
    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      100,
      0,
      0,
      6,
      18, // b decimals
    );

    const lpBalanceAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    expect(lpBalanceAfter, 'User1 LP balance should be 0').toBe(0n);

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    const priceAofB =
      Number(formatUnits(reserveBAfter, 18)) /
      Number(formatUnits(reserveAAfter, 6));
    console.log('Price A of B: ', priceAofB);

    expect(priceAofB, 'Price A of B should be 1').toBe(1);
  });
});

describe.skip('Minimum liquidity test with different decimals (9 - 6) ', async () => {
  beforeAll(async () => {
    bTokenAddress = wmasAddress; // 9 decimals
    aTokenAddress = 'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ'; // 6 decimals

    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      25,
    );

    // create new pool
    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    // get the last pool address
    poolAddress = pool.poolAddress;

    poolContract = new SmartContract(user1Provider, poolAddress);
  });

  test('User 1 adds liquidity to the pool', async () => {
    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

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

    const aAmount = 10;
    const bAmount = 10;

    // increase allowance of both tokerns amoutns first before adding liquidity
    await increaseAllownace(
      aTokenAddress,
      poolAddress,
      aAmount,
      user1Provider,
      6,
    );
    await increaseAllownace(
      bTokenAddress,
      poolAddress,
      bAmount,
      user1Provider,
      9,
    );

    // Get allowance of both tokens
    const aTokenAllowance = await new MRC20(
      user1Provider,
      aTokenAddress,
    ).allowance(user1Provider.address, poolAddress);

    const bTokenAllowance = await new MRC20(
      user1Provider,
      bTokenAddress,
    ).allowance(user1Provider.address, poolAddress);

    console.log('aTokenAllowance: ', aTokenAllowance);
    console.log('bTokenAllowance: ', bTokenAllowance);

    // add liquidity
    await addLiquidity(poolContract, aAmount, bAmount, 0, 0, 6, 9);

    // get teh reserves
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    expect(reserveAAfter, 'Reserve A should be 10 after adding liquidity').toBe(
      parseUnits('10', 6),
    );

    expect(reserveBAfter, 'Reserve B should be 10 after adding liquidity').toBe(
      parseUnits('10', 9),
    );

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
    // Expect balances beffore - after should be equal a_amount and b_amount
    expect(
      user1ATokenBalanceBefore - user1ATokenBalanceAfter,
      'User1 A Token balance should decrease after adding liquidity',
    ).toBe(parseUnits(aAmount.toString(), 6));

    expect(
      user1BTokenBalanceBefore - user1BTokenBalanceAfter,
      'User1 B Token balance should decrease after adding liquidity',
    ).toBe(parseUnits(bAmount.toString(), 9));

    // get the lp balance of user1
    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance: ', user1LPBalance);

    // expect(
    //   user1LPBalance,
    //   'User1 LP balance should be 10 - MINIMUM_LIQUIDITY',
    // ).toBe(9999999999999000000n);

    // Get pool total supply
    const poolTotalSupply = await getPoolLPTotalSupply(poolContract);
    console.log('Pool total supply: ', poolTotalSupply);

    // expect the pool total supply to be 10
    // expect(poolTotalSupply, 'Pool total supply should be 10').toBe(
    //   parseUnits('10', 18),
    // );

    const priceAofB =
      Number(formatUnits(reserveBAfter, 9)) /
      Number(formatUnits(reserveAAfter, 6));
    console.log('Price A of B: ', priceAofB);

    expect(priceAofB, 'Price A of B should be 1').toBe(1);
  });

  test('User 1 Should be able to remove liquidity minus the MINIMUM_LIQUIDITY', async () => {
    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      100,
      0,
      0,
      6,
      9, // b decimals
    );

    const lpBalanceAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    expect(lpBalanceAfter, 'User1 LP balance should be 0').toBe(0n);

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);
    console.log('Reserve A after formatted: ', formatUnits(reserveAAfter, 6));
    console.log('Reserve B after formatted: ', formatUnits(reserveBAfter, 9));

    const priceAofB =
      Number(formatUnits(reserveBAfter, 9)) /
      Number(formatUnits(reserveAAfter, 6));
    console.log('Price A of B: ', priceAofB);

    expect(priceAofB, 'Price A of B should be 1').toBe(1);
  });
});

describe.skip('Minimum liquidity test with different decimals (18 - 9) and low amounts ', async () => {
  beforeAll(async () => {
    aTokenAddress = 'AS1Jg6cLstoXEVe6uGr3gTd3dhWLVqFPbYcMuHjcpzRQTJMtvY9k';
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      25,
    );

    // create new pool
    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    // get the last pool address
    poolAddress = pool.poolAddress;

    poolContract = new SmartContract(user1Provider, poolAddress);
  });

  test('User 1 adds liquidity to the pool', async () => {
    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

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

    const aAmount = 1;
    const bAmount = 1;

    // increase allowance of both tokerns amoutns first before adding liquidity
    await increaseAllownace(
      aTokenAddress,
      poolAddress,
      aAmount,
      user1Provider,
      18,
    );
    await increaseAllownace(bTokenAddress, poolAddress, bAmount, user1Provider);

    // add liquidity
    await addLiquidity(poolContract, aAmount, bAmount, 0, 0, 18);

    // get teh reserves
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    expect(reserveAAfter, 'Reserve A should be 10 after adding liquidity').toBe(
      parseUnits(aAmount.toString(), 18),
    );

    expect(reserveBAfter, 'Reserve B should be 10 after adding liquidity').toBe(
      parseMas(bAmount.toString()),
    );

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

    // Expect balances beffore - after should be equal a_amount and b_amount
    expect(
      user1ATokenBalanceBefore - user1ATokenBalanceAfter,
      'User1 A Token balance should decrease after adding liquidity',
    ).toBe(parseUnits(aAmount.toString(), 18));

    expect(
      user1BTokenBalanceBefore - user1BTokenBalanceAfter,
      'User1 B Token balance should decrease after adding liquidity',
    ).toBe(parseMas(bAmount.toString()));

    // get the lp balance of user1
    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance: ', user1LPBalance);

    // Get pool total supply
    const poolTotalSupply = await getPoolLPTotalSupply(poolContract);
    console.log('Pool total supply: ', poolTotalSupply);

    // expect the pool total supply to be 1
    expect(poolTotalSupply, 'Pool total supply should be 1').toBe(
      parseUnits('1', 18),
    );

    const priceAofB =
      Number(formatMas(reserveBAfter)) / Number(formatUnits(reserveAAfter, 18));
    console.log('Price A of B: ', priceAofB);
    expect(priceAofB, 'Price A of B should be 1').toBe(1);
  });

  test('User 1 Should be able to remove liquidity minus the MINIMUM_LIQUIDITY', async () => {
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

    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      100,
      0,
      0,
      18,
      9,
    );

    const lpBalanceAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    expect(lpBalanceAfter, 'User1 LP balance should be 0').toBe(0n);

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    const priceAofB =
      Number(formatMas(reserveBAfter)) / Number(formatUnits(reserveAAfter, 18));
    console.log('Price A of B: ', priceAofB);
    expect(priceAofB, 'Price A of B should be 1').toBe(1);
  });
});

describe.skip('Minimum liquidity test with different decimals (18 - 9) and very very low amounts ', async () => {
  beforeAll(async () => {
    aTokenAddress = 'AS1Jg6cLstoXEVe6uGr3gTd3dhWLVqFPbYcMuHjcpzRQTJMtvY9k';
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      25,
    );

    // create new pool
    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    // get the last pool address
    poolAddress = pool.poolAddress;

    poolContract = new SmartContract(user1Provider, poolAddress);
  });

  test('User 1 adds liquidity to the pool', async () => {
    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

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

    const aAmount = 0.000000000000000001; // min value of a 18 decimals
    const bAmount = 0.000000001; // min value of a 9 decimals

    // increase allowance of both tokerns amoutns first before adding liquidity
    await increaseAllownace(
      aTokenAddress,
      poolAddress,
      aAmount,
      user1Provider,
      18,
    );
    await increaseAllownace(bTokenAddress, poolAddress, bAmount, user1Provider);

    // add liquidity
    await addLiquidity(poolContract, aAmount, bAmount, 0, 0, 18);

    // get teh reserves
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    expect(reserveAAfter, 'Reserve A should be 10 after adding liquidity').toBe(
      parseUnits(truncateDecimals(aAmount, 18), 18),
    );

    expect(reserveBAfter, 'Reserve B should be 10 after adding liquidity').toBe(
      parseMas(truncateDecimals(bAmount)),
    );

    console.log('Reserve A after add lqi: ', reserveAAfter);
    console.log('Reserve B after add lqi: ', reserveBAfter);

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

    // Expect balances beffore - after should be equal a_amount and b_amount
    expect(
      user1ATokenBalanceBefore - user1ATokenBalanceAfter,
      'User1 A Token balance should decrease after adding liquidity',
    ).toBe(parseUnits(truncateDecimals(aAmount, 18), 18));

    expect(
      user1BTokenBalanceBefore - user1BTokenBalanceAfter,
      'User1 B Token balance should decrease after adding liquidity',
    ).toBe(parseMas(truncateDecimals(bAmount)));

    // get the lp balance of user1
    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance: ', user1LPBalance);

    // Get pool total supply
    const poolTotalSupply = await getPoolLPTotalSupply(poolContract);
    console.log('Pool total supply: ', poolTotalSupply);

    // expect the pool total supply to be 1
    // expect(poolTotalSupply, 'Pool total supply should be 1').toBe(
    //   parseUnits('1', 18),
    // );

    const priceAofB =
      Number(formatMas(reserveBAfter)) / Number(formatUnits(reserveAAfter, 18));
    console.log('Price A of B: ', priceAofB);
    // expect(priceAofB, 'Price A of B should be 1000000000').toBe(1000000000);
  });

  test('User 1 Should be able to remove liquidity minus the MINIMUM_LIQUIDITY', async () => {
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

    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      100,
      0,
      0,
      18,
      9,
    );

    const lpBalanceAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    expect(lpBalanceAfter, 'User1 LP balance should be 0').toBe(0n);

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    const priceAofB =
      Number(formatMas(reserveBAfter)) / Number(formatUnits(reserveAAfter, 18));
    console.log('Price A of B: ', priceAofB);
    // expect(priceAofB, 'Price A of B should be 1000000000').toBe(1000000000);
  });
});

describe.skip('User 1 add lqi, user2 swap,  user2 add liq, user1 rem liquidity, user2 rem liquidity test with diff decimals 18-9', async () => {
  let storedPriceAofB: number = 0;
  const aDecimals = 18;
  const bDecimals = 9;

  beforeAll(async () => {
    aTokenAddress = 'AS1Jg6cLstoXEVe6uGr3gTd3dhWLVqFPbYcMuHjcpzRQTJMtvY9k';
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      25,
    );

    swapRouterContract = await deploySwapRouterContract(
      user1Provider,
      registryContract.address,
    );

    // Set the swap router address in the registry contract
    await setSwapRouterAddress(registryContract, swapRouterContract.address);

    // create new pool
    await createNewPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    const pool = await getPool(
      registryContract,
      aTokenAddress,
      bTokenAddress,
      poolFeeRate,
    );

    // get the last pool address
    poolAddress = pool.poolAddress;

    poolContract = new SmartContract(user1Provider, poolAddress);
  });

  test('User 1 adds liquidity to the pool', async () => {
    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);
    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

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

    const aAmount = 10;
    const bAmount = 10;

    // increase allowance of both tokerns amoutns first before adding liquidity
    await increaseAllownace(
      aTokenAddress,
      poolAddress,
      aAmount,
      user1Provider,
      aDecimals,
    );
    await increaseAllownace(
      bTokenAddress,
      poolAddress,
      bAmount,
      user1Provider,
      bDecimals,
    );

    // add liquidity
    await addLiquidity(
      poolContract,
      aAmount,
      bAmount,
      0,
      0,
      aDecimals,
      bDecimals,
    );

    // Get reserves after adding liquidity
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    expect(reserveAAfter, 'Reserve A should be 10 after adding liquidity').toBe(
      parseUnits(truncateDecimals(aAmount, aDecimals), aDecimals),
    );

    expect(reserveBAfter, 'Reserve B should be 10 after adding liquidity').toBe(
      parseUnits(truncateDecimals(bAmount, bDecimals), bDecimals),
    );

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

    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance: ', user1LPBalance);

    const poolTotalSupply = await getPoolLPTotalSupply(poolContract);

    console.log('Pool total supply: ', poolTotalSupply);

    const priceAofB =
      Number(formatUnits(reserveBAfter, bDecimals)) /
      Number(formatUnits(reserveAAfter, aDecimals));

    console.log('Price A of B After First Add Liquidity: ', priceAofB);

    storedPriceAofB = priceAofB;

    expect(
      user1ATokenBalanceBefore - user1ATokenBalanceAfter,
      'User1 A Token balance should decrease after adding liquidity',
    ).toBe(parseUnits(truncateDecimals(aAmount, aDecimals), aDecimals));

    expect(
      user1BTokenBalanceBefore - user1BTokenBalanceAfter,
      'User1 B Token balance should decrease after adding liquidity',
    ).toBe(parseUnits(truncateDecimals(bAmount, bDecimals), bDecimals));
  });

  test("User 2 swaps B token for A token in pool's reserves", async () => {
    // switch poolContrcat to user2 provider
    poolContract = new SmartContract(user2Provider, poolAddress);
    swapRouterContract = new SmartContract(
      user2Provider,
      swapRouterContract.address,
    );

    const bSwapAmount = 5;
    const minASwapOutAmount = 2;
    const bFeeRate = (5 * 0.3) / 100;

    console.log('B swap amount: ', bSwapAmount);
    console.log('B fee rate: ', bFeeRate);

    // Increase allowance for BToken
    await increaseAllownace(
      bTokenAddress,
      swapRouterContract.address,
      bSwapAmount,
      user2Provider,
      bDecimals,
    );

    // Generate Swap Route
    const swapRoute = [
      new SwapPath(
        poolContract.address,
        bTokenAddress,
        aTokenAddress,
        user2Provider.address,
        parseMas(bSwapAmount.toString()),
        parseUnits(minASwapOutAmount.toString(), TOKEN_DEFAULT_DECIMALS),
        true,
      ),
    ];

    // swap B token for A token
    await swap(swapRouterContract, swapRoute, '0.01');

    // get reserves after swap
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after swap: ', reserveAAfter);
    console.log('Reserve B after swap: ', reserveBAfter);

    const priceAofBAfterSwap =
      Number(formatUnits(reserveBAfter, bDecimals)) /
      Number(formatUnits(reserveAAfter, aDecimals));

    console.log('Price A of B after swap: ', priceAofBAfterSwap);

    storedPriceAofB = priceAofBAfterSwap;

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

    console.log('User2 A Token balance after swap: ', user2ATokenBalanceAfter);

    console.log('User2 B Token balance after swap: ', user2BTokenBalanceAfter);
  });

  test('User 2 adds liquidity to the pool', async () => {
    // switch poolContrcat to user2 provider
    poolContract = new SmartContract(user2Provider, poolAddress);

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

    const aAmount = 5;
    const bAmount = 5;

    // expect user2 to have enough balance to add liquidity
    expect(
      user2ATokenBalanceBefore,
      'User2 A Token balance should be greater than 5',
    ).toBeGreaterThan(parseUnits(aAmount.toString(), aDecimals));

    expect(
      user2BTokenBalanceBefore,
      'User2 B Token balance should be greater than 5',
    ).toBeGreaterThan(parseUnits(bAmount.toString(), bDecimals));

    // increase allowance of both tokerns amoutns first before adding liquidity
    await increaseAllownace(
      aTokenAddress,
      poolAddress,
      aAmount,
      user2Provider,
      aDecimals,
    );

    await increaseAllownace(
      bTokenAddress,
      poolAddress,
      bAmount,
      user2Provider,
      bDecimals,
    );

    // add liquidity
    await addLiquidity(
      poolContract,
      aAmount,
      bAmount,
      0,
      0,
      aDecimals,
      bDecimals,
    );

    // get the reserves after adding liquidity
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    const reserveAAfterDiff =
      reserveAAfter -
      parseUnits(truncateDecimals(aAmount, aDecimals), aDecimals);
    const reserveBAfterDiff =
      reserveBAfter -
      parseUnits(truncateDecimals(bAmount, bDecimals), bDecimals);

    console.log('Reserve A after diff: ', reserveAAfterDiff);
    console.log('Reserve B after diff: ', reserveBAfterDiff);

    const priceAofBAfterAddLiquidity =
      Number(formatUnits(reserveBAfter, bDecimals)) /
      Number(formatUnits(reserveAAfter, aDecimals));

    console.log(
      'Price A of B after add liquidity: ',
      priceAofBAfterAddLiquidity,
    );
  });

  test('User 1 removes its liquidity from pool', async () => {
    // switch to user1
    poolContract = new SmartContract(user1Provider, poolAddress);

    // get all pool reserves
    const [reserveA, reserveB] = await getPoolReserves(poolContract);
    console.log('Reserve A before remove liquidity: ', reserveA);

    console.log('Reserve B before remove liquidity: ', reserveB);

    const user1LPBalanceBefore = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance before: ', user1LPBalanceBefore);

    const lpPercentage = 100; // 100%

    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      lpPercentage,
      0,
      0,
      aDecimals,
      bDecimals,
    );

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

    const user1LPBalanceAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    expect(user1LPBalanceAfter, 'User1 LP balance should be 0').toBe(0n);

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);

    console.log('Reserve B after: ', reserveBAfter);

    const priceAofB =
      Number(formatUnits(reserveBAfter, bDecimals)) /
      Number(formatUnits(reserveAAfter, aDecimals));

    console.log('Price A of B: ', priceAofB);
  });

  test('User 2 removes its liquidity from pool', async () => {
    // switch to user2
    poolContract = new SmartContract(user2Provider, poolAddress);

    // get all pool reserves
    const [reserveA, reserveB] = await getPoolReserves(poolContract);
    console.log('Reserve A before remove liquidity: ', reserveA);

    console.log('Reserve B before remove liquidity: ', reserveB);

    const user1LPBalanceBefore = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance before: ', user1LPBalanceBefore);

    const lpPercentage = 100; // 100%

    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      lpPercentage,
      0,
      0,
      aDecimals,
      bDecimals,
    );

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

    const user1LPBalanceAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    expect(user1LPBalanceAfter, 'User1 LP balance should be 0').toBe(0n);

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);

    console.log('Reserve B after: ', reserveBAfter);

    const priceAofB =
      Number(formatUnits(reserveBAfter, bDecimals)) /
      Number(formatUnits(reserveAAfter, aDecimals));

    console.log('Price A of B: ', priceAofB);
  });
});

describe('Trying to swap without pay the amountIn', async () => {
  beforeAll(async () => {
    swapRouterContract = new SmartContract(
      user1Provider,
      'AS1cwUV8S9R4SdUYYejRk3ZpLYwBFy3Q7Y7RrFYEspKXwJZMDygR',
    );

    poolAddress = 'AS12gSdL2EZH5Mj4UAFuk69aiYPuKoH1sK982oEDQfwxu97sAT9js';

    poolContract = new SmartContract(user1Provider, poolAddress);
  });

  test('User1 make swap without transfering the amountIn', async () => {
    const swapPath = [
      new SwapPath(
        poolContract.address,
        wmasAddress,
        aTokenAddress,
        user1Provider.address,
        parseMas('5'),
        1n,
        false,
      ),
    ];

    const poolReserves = await getPoolReserves(poolContract);

    console.log('Pool Reserves Before Swap: ', poolReserves);

    await swap(swapRouterContract, swapPath, '0.01');

    const poolReservesAfter = await getPoolReserves(poolContract);

    console.log('Pool Reserves After Swap: ', poolReservesAfter);
  });
});
