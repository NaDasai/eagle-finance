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

describe.skip('User 1 add lqi, user2 swap,  user2 add liq, user1 rem liquidity, user2 rem liquidity test with diff decimals 6-9', async () => {
  let storedPriceAofB: number = 0;
  const aDecimals = 6;
  const bDecimals = 9;

  beforeAll(async () => {
    aTokenAddress = 'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ';
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
    const minASwapOutAmount = 0.1;
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
        parseUnits(minASwapOutAmount.toString(), aDecimals),
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
    ).toBeGreaterThanOrEqual(parseUnits(aAmount.toString(), aDecimals));

    expect(
      user2BTokenBalanceBefore,
      'User2 B Token balance should be greater than 5',
    ).toBeGreaterThanOrEqual(parseUnits(bAmount.toString(), bDecimals));

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

describe.skip('Minimul Liquidity With big and small amounts with 18 - 9 decimals', async () => {
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

    const aAmount = 4400;
    const bAmount = 0.00001;

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

    //
    expect(priceAofB, 'Price A of B should be storedPriceAofB').toBe(
      storedPriceAofB,
    );
  });
});

describe.skip('Minimul liq with full workload add, swap, rem lig with 18 - 9 decimals + 15.8547655 - 6.487557 Amounts', async () => {
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

    const aAmount = 15.8547655;
    const bAmount = 6.487557;

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

    console.log('Reserve A after add liq: ', reserveAAfter);
    console.log('Reserve B after add liq: ', reserveBAfter);

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

  test('User 2 swaps B for A', async () => {
    // switch to user 2
    swapRouterContract = new SmartContract(
      user2Provider,
      swapRouterContract.address,
    );

    const bSwapAmount = 5;
    const minASwapOutAmount = 0.001;
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
        parseUnits(minASwapOutAmount.toString(), aDecimals),
        true,
      ),
    ];

    // swap B token for A token
    await swap(swapRouterContract, swapRoute, '0.01');

    // get reserves after swap
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after swap: ', reserveAAfter);
    console.log('Reserve B after swap: ', reserveBAfter);

    expect(
      reserveBAfter,
      'Reserve B should be 10 + (bSwapAmount - inputFee) after swap',
    ).toBe(11483807000n);

    const priceAofBAfterSwap =
      Number(formatUnits(reserveBAfter, bDecimals)) /
      Number(formatUnits(reserveAAfter, aDecimals));

    console.log('Price A of B after swap: ', priceAofBAfterSwap);

    storedPriceAofB = priceAofBAfterSwap;
  });

  test('User 1 removes liquidity from the pool', async () => {
    // switch to user 1
    poolContract = new SmartContract(user1Provider, poolAddress);

    const lpPercentage = 100; // 100%

    const user1TokenABalanceBefore = await getTokenBalance(
      aTokenAddress,
      user1Provider.address,
      user1Provider,
    );
    console.log('User1 Token balance before: ', user1TokenABalanceBefore);

    const user1TokenBBalanceBefore = await getTokenBalance(
      bTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    console.log('User1 Token balance before: ', user1TokenBBalanceBefore);

    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      lpPercentage,
      0,
      0,
      aDecimals,
      bDecimals,
    );

    const user1LpBalanceAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    expect(user1LpBalanceAfter, 'User1 LP balance should be 0').toBe(0n);

    const user1TokenABalanceAfter = await getTokenBalance(
      aTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    const user1TokenBBalanceAfter = await getTokenBalance(
      bTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    console.log('User1 Token balance after: ', user1TokenABalanceAfter);
    console.log('User1 Token balance after: ', user1TokenBBalanceAfter);

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    const balanceDiffA = user1TokenABalanceAfter - user1TokenABalanceBefore;
    const balanceDiffB = user1TokenBBalanceAfter - user1TokenBBalanceBefore;
    const reserveDiffA = reserveA - reserveAAfter;
    const reserveDiffB = reserveB - reserveBAfter;

    console.log('Balance diff A: ', balanceDiffA);
    console.log('Balance diff B: ', balanceDiffB);
    console.log('Reserve diff A: ', reserveDiffA);
    console.log('Reserve diff B: ', reserveDiffB);

    expect(
      balanceDiffA,
      'Balance diff A should be equal to reserve diff A',
    ).toBe(reserveDiffA);

    expect(
      balanceDiffB,
      'Balance diff B should be equal to reserve diff B',
    ).toBe(reserveDiffB);

    const priceAofBAfterRemoveLiquidity =
      Number(formatUnits(reserveBAfter, bDecimals)) /
      Number(formatUnits(reserveAAfter, aDecimals));

    console.log(
      'Price A of B after remove liquidity: ',
      priceAofBAfterRemoveLiquidity,
    );
    expect(
      priceAofBAfterRemoveLiquidity,
      'Price A of B should be stored price',
    ).toBe(storedPriceAofB);
  });
});


describe.skip('Minimul liq with full workload add, swap, rem lig with 18 - 9 decimals + 0.000000000000009915 - 6487.5574897 Amounts', async () => {
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

    const aAmount = 0.000000000000009915;
    const bAmount = 6487.5574897;

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

    console.log('Reserve A after add liq: ', reserveAAfter);
    console.log('Reserve B after add liq: ', reserveBAfter);

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

  test('User 2 swaps B for A', async () => {
    // switch to user 2
    swapRouterContract = new SmartContract(
      user2Provider,
      swapRouterContract.address,
    );

    const bSwapAmount = 5;
    const minASwapOutAmount = 0.000000000000000001;
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
        parseUnits(truncateDecimals(minASwapOutAmount, aDecimals), aDecimals),
        true,
      ),
    ];

    // swap B token for A token
    await swap(swapRouterContract, swapRoute, '0.01');

    // get reserves after swap
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after swap: ', reserveAAfter);
    console.log('Reserve B after swap: ', reserveBAfter);

    // expect(
    //   reserveBAfter,
    //   'Reserve B should be 10 + (bSwapAmount - inputFee) after swap',
    // ).toBe(11483807000n);

    const priceAofBAfterSwap =
      Number(formatUnits(reserveBAfter, bDecimals)) /
      Number(formatUnits(reserveAAfter, aDecimals));

    console.log('Price A of B after swap: ', priceAofBAfterSwap);

    storedPriceAofB = priceAofBAfterSwap;
  });

  test('User 1 removes liquidity from the pool', async () => {
    // switch to user 1
    poolContract = new SmartContract(user1Provider, poolAddress);

    const lpPercentage = 100; // 100%

    const user1TokenABalanceBefore = await getTokenBalance(
      aTokenAddress,
      user1Provider.address,
      user1Provider,
    );
    console.log('User1 Token balance before: ', user1TokenABalanceBefore);

    const user1TokenBBalanceBefore = await getTokenBalance(
      bTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    console.log('User1 Token balance before: ', user1TokenBBalanceBefore);

    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      lpPercentage,
      0,
      0,
      aDecimals,
      bDecimals,
    );

    const user1LpBalanceAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    expect(user1LpBalanceAfter, 'User1 LP balance should be 0').toBe(0n);

    const user1TokenABalanceAfter = await getTokenBalance(
      aTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    const user1TokenBBalanceAfter = await getTokenBalance(
      bTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    console.log('User1 Token balance after: ', user1TokenABalanceAfter);
    console.log('User1 Token balance after: ', user1TokenBBalanceAfter);

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    const balanceDiffA = user1TokenABalanceAfter - user1TokenABalanceBefore;
    const balanceDiffB = user1TokenBBalanceAfter - user1TokenBBalanceBefore;
    const reserveDiffA = reserveA - reserveAAfter;
    const reserveDiffB = reserveB - reserveBAfter;

    console.log('Balance diff A: ', balanceDiffA);
    console.log('Balance diff B: ', balanceDiffB);
    console.log('Reserve diff A: ', reserveDiffA);
    console.log('Reserve diff B: ', reserveDiffB);

    expect(
      balanceDiffA,
      'Balance diff A should be equal to reserve diff A',
    ).toBe(reserveDiffA);

    expect(
      balanceDiffB,
      'Balance diff B should be equal to reserve diff B',
    ).toBe(reserveDiffB);

    const priceAofBAfterRemoveLiquidity =
      Number(formatUnits(reserveBAfter, bDecimals)) /
      Number(formatUnits(reserveAAfter, aDecimals));

    console.log(
      'Price A of B after remove liquidity: ',
      priceAofBAfterRemoveLiquidity,
    );
    expect(
      priceAofBAfterRemoveLiquidity,
      'Price A of B should be stored price',
    ).toBe(storedPriceAofB);
  });
});

describe.skip('Minimul liq with full workload add, swap, rem lig with 18 - 9 decimals + 768640247.947 - 5000 Amounts', async () => {
  let storedPriceAofB: number = 0;
  const aDecimals = 18;
  const bDecimals = 9;

  beforeAll(async () => {
    aTokenAddress = 'AS1Lqt5n1q7jFWrEozAiFL2dd1kBNyg1QURLR8VApZErmicudRoR'; // BIL
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

    const aAmount = 768640247.947;
    const bAmount = 5000;

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

    console.log('User1 A Token balance before: ', user1ATokenBalanceBefore);
    console.log('User1 B Token balance before: ', user1BTokenBalanceBefore);

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

    console.log('Reserve A after add liq: ', reserveAAfter);
    console.log('Reserve B after add liq: ', reserveBAfter);

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

  test('User 2 swaps B for A', async () => {
    // switch to user 2
    swapRouterContract = new SmartContract(
      user2Provider,
      swapRouterContract.address,
    );

    const bSwapAmount = 5;
    const minASwapOutAmount = 0.000000000000000001;
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
        parseUnits(truncateDecimals(minASwapOutAmount, aDecimals), aDecimals),
        true,
      ),
    ];

    // swap B token for A token
    await swap(swapRouterContract, swapRoute, '0.01');

    // get reserves after swap
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after swap: ', reserveAAfter);
    console.log('Reserve B after swap: ', reserveBAfter);

    // expect(
    //   reserveBAfter,
    //   'Reserve B should be 10 + (bSwapAmount - inputFee) after swap',
    // ).toBe(11483807000n);

    const priceAofBAfterSwap =
      Number(formatUnits(reserveBAfter, bDecimals)) /
      Number(formatUnits(reserveAAfter, aDecimals));

    console.log('Price A of B after swap: ', priceAofBAfterSwap);

    storedPriceAofB = priceAofBAfterSwap;
  });

  test('User 1 removes liquidity from the pool', async () => {
    // switch to user 1
    poolContract = new SmartContract(user1Provider, poolAddress);

    const lpPercentage = 100; // 100%

    const user1TokenABalanceBefore = await getTokenBalance(
      aTokenAddress,
      user1Provider.address,
      user1Provider,
    );
    console.log('User1 Token balance before: ', user1TokenABalanceBefore);

    const user1TokenBBalanceBefore = await getTokenBalance(
      bTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    console.log('User1 Token balance before: ', user1TokenBBalanceBefore);

    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      lpPercentage,
      0,
      0,
      aDecimals,
      bDecimals,
    );

    const user1LpBalanceAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    expect(user1LpBalanceAfter, 'User1 LP balance should be 0').toBe(0n);

    const user1TokenABalanceAfter = await getTokenBalance(
      aTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    const user1TokenBBalanceAfter = await getTokenBalance(
      bTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    console.log('User1 Token balance after: ', user1TokenABalanceAfter);
    console.log('User1 Token balance after: ', user1TokenBBalanceAfter);

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    const balanceDiffA = user1TokenABalanceAfter - user1TokenABalanceBefore;
    const balanceDiffB = user1TokenBBalanceAfter - user1TokenBBalanceBefore;
    const reserveDiffA = reserveA - reserveAAfter;
    const reserveDiffB = reserveB - reserveBAfter;

    console.log('Balance diff A: ', balanceDiffA);
    console.log('Balance diff B: ', balanceDiffB);
    console.log('Reserve diff A: ', reserveDiffA);
    console.log('Reserve diff B: ', reserveDiffB);

    expect(
      balanceDiffA,
      'Balance diff A should be equal to reserve diff A',
    ).toBe(reserveDiffA);

    expect(
      balanceDiffB,
      'Balance diff B should be equal to reserve diff B',
    ).toBe(reserveDiffB);

    const priceAofBAfterRemoveLiquidity =
      Number(formatUnits(reserveBAfter, bDecimals)) /
      Number(formatUnits(reserveAAfter, aDecimals));

    console.log(
      'Price A of B after remove liquidity: ',
      priceAofBAfterRemoveLiquidity,
    );
    expect(
      priceAofBAfterRemoveLiquidity,
      'Price A of B should be stored price',
    ).toBe(storedPriceAofB);
  });
});
