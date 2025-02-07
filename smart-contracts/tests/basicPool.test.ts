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
  getPool,
} from './calls/registry';
import { Pool } from '../src/builnet-tests/structs/pool';
import { getScByteCode, NATIVE_MAS_COIN_ADDRESS } from './utils';
import {
  addLiquidity,
  addLiquidityWithMAS,
  getAPriceCumulativeLast,
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
} from './calls/basicPool';

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

describe('Scenario 1: Add liquidity, Swap, Remove liquidity without feees', async () => {
  beforeAll(async () => {
    registryContract = await deployRegistryContract(user1Provider, wmasAddress);
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

    expect(user1LPBalance, 'User1 LP balance should be 10').toBe(
      parseMas('10'),
    );
  });

  test("User 2 swaps B token for A token in pool's reserves", async () => {
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
    const expectedaAmountOut = await getSwapOutEstimation(
      poolContract,
      bSwapAmount,
      bTokenAddress,
    );

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

    console.log('Reserve A after swap: ', formatMas(reserveAAfter));
    console.log('Reserve B after swap: ', formatMas(reserveBAfter));

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

    expect(
      reserveAAfter,
      'Reserve A After should be equals to initial reserve A - expectedOutAmount',
    ).toBe(reserveA - expectedaAmountOut);

    expect(
      reserveBAfter,
      'Reserve B After should be equals to initial reserve B + swap amount',
    ).toBe(reserveB + parseMas(bSwapAmount.toString()));

    expect(
      user2ATokenBalanceAfter,
      'User2 A Token balance should increase after swap',
    ).toBe(user2ATokenBalanceBefore + expectedaAmountOut);

    expect(
      user2BTokenBalanceAfter,
      'User2 B Token balance should increase after swap',
    ).toBe(user2BTokenBalanceBefore - parseMas(bSwapAmount.toString()));

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

    expect(
      user1LPBalanceBefore,
      'User1 LP balance should be equals to 10 before removing liquidity',
    ).toBe(parseMas('10'));

    const lpAmount = 10;
    const minAOutAmount = 0;
    const minBOutAmount = 0;

    // remove liquidity
    await removeLiquidity(poolContract, lpAmount, minAOutAmount, minBOutAmount);

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
  });
});

describe('Scenario 2: Add liquidity, Swap native coins in and out without fees', async () => {
  beforeAll(async () => {
    registryContract = await deployRegistryContract(user1Provider, wmasAddress);

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

  test('User 1 Add liquidity to pool using MAS when its empty', async () => {
    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

    const user1ATokenBalanceBefore = await getTokenBalance(
      aTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    const user1MasBalanceBefore = await user1Provider.balance(false);

    console.log('User1 A Token balance before: ', user1ATokenBalanceBefore);
    console.log('User1 MAS balance before: ', user1MasBalanceBefore);

    const contractATokenBalanceBefore = await getTokenBalance(
      aTokenAddress,
      poolAddress,
      user1Provider,
    );

    const contractBTokenBalanceBefore = await getTokenBalance(
      bTokenAddress,
      poolAddress,
      user1Provider,
    );

    expect(
      contractATokenBalanceBefore,
      'Contract A Token balance should be 0 when pool is empty',
    ).toBe(0n);

    expect(
      contractBTokenBalanceBefore,
      'Contract B Token balance should be 0 when pool is empty',
    ).toBe(0n);

    const aAmount = 100;
    const bAmount = 1;

    // increase allowance of both a token first before adding liquidity
    await increaseAllownace(aTokenAddress, poolAddress, aAmount, user1Provider);

    // add Liquidity with MAS
    const sendCoins = await addLiquidityWithMAS(
      poolContract,
      aAmount,
      bAmount,
      0,
      0,
    );

    // get the reserves
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    expect(
      reserveAAfter,
      'Reserve A should be 100 after adding liquidity',
    ).toBe(parseMas(aAmount.toString()));

    expect(reserveBAfter, 'Reserve B should be 1 after adding liquidity').toBe(
      parseMas(bAmount.toString()),
    );

    const user1ATokenBalanceAfter = await getTokenBalance(
      aTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    const user1MasBalanceAfter = await user1Provider.balance(false);

    console.log('User1 A Token balance after: ', user1ATokenBalanceAfter);
    console.log('User1 MAS balance after: ', user1MasBalanceAfter);

    const tokenAUserDifference =
      user1ATokenBalanceBefore - user1ATokenBalanceAfter;

    console.log('User Token A difference : ', tokenAUserDifference);

    expect(
      tokenAUserDifference,
      'User1 A Token balance should decrease after adding liquidity',
    ).toBe(parseMas(aAmount.toString()));

    console.log('Difference: ', user1MasBalanceBefore - user1MasBalanceAfter);

    const contractATokenBalanceAfter = await getTokenBalance(
      aTokenAddress,
      poolAddress,
      user1Provider,
    );

    const contractBTokenBalanceAfter = await getTokenBalance(
      bTokenAddress,
      poolAddress,
      user1Provider,
    );

    expect(
      contractATokenBalanceAfter,
      'Contract A Token balance should be equal to reserve A',
    ).toBe(reserveAAfter);

    expect(
      contractBTokenBalanceAfter,
      'Contract B Token balance should be equal to reserve B',
    ).toEqual(reserveBAfter);

    console.log('Contract A Token Balance After: ', contractATokenBalanceAfter);
    console.log('Contract B Token Balance After: ', contractBTokenBalanceAfter);

    // expect(
    //   Number(user1MasBalanceBefore - user1MasBalanceAfter).toFixed(0),
    //   'User1 MAS balance should decrease after adding liquidity',
    // ).toBe(Number(formatMas(sendCoins)).toFixed(0));

    // get the lp balance of user1
    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance: ', user1LPBalance);

    expect(user1LPBalance, 'User1 LP balance should be 10').toBe(
      parseMas('10'),
    );
  });

  test('User 2 swaps native coin for token A in pool', async () => {
    // switch poolContrcat to user2 provider
    poolContract = new SmartContract(user2Provider, poolAddress);

    // get reserves before swap
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    console.log('Reserve A before swap: ', reserveA);
    console.log('Reserve B before swap: ', reserveB);

    const user2ATokenBalanceBefore = await getTokenBalance(
      aTokenAddress,
      user2Provider.address,
      user2Provider,
    );

    const user2MasBalanceBefore = await user2Provider.balance(false);

    console.log('User2 A Token balance before: ', user2ATokenBalanceBefore);
    console.log('User2 MAS balance before: ', user2MasBalanceBefore);

    const contractATokenBalanceBefore = await getTokenBalance(
      aTokenAddress,
      poolAddress,
      user2Provider,
    );

    const contractBTokenBalanceBefore = await getTokenBalance(
      bTokenAddress,
      poolAddress,
      user2Provider,
    );

    console.log(
      'Contract A Token Balance Before: ',
      contractATokenBalanceBefore,
    );
    console.log(
      'Contract B Token Balance Before: ',
      contractBTokenBalanceBefore,
    );

    const bSwapAmount = 0.5;
    const minASwapOutAmount = 0.1;

    // swap B token for A token
    const sendCoins = await swapWithMAS(
      poolContract,
      NATIVE_MAS_COIN_ADDRESS,
      bSwapAmount,
      minASwapOutAmount,
    );

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    expect(
      reserveBAfter - reserveB,
      'Reserve B should be  equals to initial reserve B + swap amount',
    ).toEqual(parseMas(bSwapAmount.toString()));

    expect(
      reserveAAfter,
      'Reserve A should be less than the intial reserve A',
    ).toBeLessThan(parseMas(reserveA.toString()));

    const user2ATokenBalanceAfter = await getTokenBalance(
      aTokenAddress,
      user2Provider.address,
      user2Provider,
    );

    const user2MasBalanceAfter = await user2Provider.balance(false);

    console.log('User2 A Token balance after: ', user2ATokenBalanceAfter);
    console.log('User2 MAS balance after: ', user2MasBalanceAfter);

    const contractATokenBalanceAfter = await getTokenBalance(
      aTokenAddress,
      poolAddress,
      user2Provider,
    );

    const contractBTokenBalanceAfter = await getTokenBalance(
      bTokenAddress,
      poolAddress,
      user2Provider,
    );

    console.log('Contract A Token balance after: ', contractATokenBalanceAfter);
    console.log('Contract B Token balance after: ', contractBTokenBalanceAfter);
  });

  test('User 2 swaps token A for native coin in pool', async () => {
    // switch poolContrcat to user2 provider
    poolContract = new SmartContract(user2Provider, poolAddress);

    // get reserves before swap
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    console.log('Reserve A before swap: ', reserveA);
    console.log('Reserve B before swap: ', reserveB);

    const user2ATokenBalanceBefore = await getTokenBalance(
      aTokenAddress,
      user2Provider.address,
      user2Provider,
    );

    const user2MasBalanceBefore = await user2Provider.balance(false);

    console.log(
      'User2 A Token balance before: ',
      formatMas(user2ATokenBalanceBefore),
    );
    console.log('User2 MAS balance before: ', formatMas(user2MasBalanceBefore));

    const contractATokenBalanceBefore = await getTokenBalance(
      aTokenAddress,
      poolAddress,
      user2Provider,
    );

    const contractBTokenBalanceBefore = await getTokenBalance(
      bTokenAddress,
      poolAddress,
      user2Provider,
    );

    console.log(
      'Contract A Token Balance Before: ',
      contractATokenBalanceBefore,
    );
    console.log(
      'Contract B Token Balance Before: ',
      contractBTokenBalanceBefore,
    );

    const aSwapAmount = 50;
    const minBSwapOutAmount = 0.1;

    // increase allowance of  a token first before swapping
    await increaseAllownace(
      aTokenAddress,
      poolAddress,
      aSwapAmount,
      user2Provider,
    );

    // swap A token for Native coin
    const sendCoins = await swapWithMAS(
      poolContract,
      aTokenAddress,
      aSwapAmount,
      minBSwapOutAmount,
      false,
    );

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    expect(reserveAAfter, 'Reserve should increase by swap amount').toBe(
      reserveA + parseMas(aSwapAmount.toString()),
    );

    // expect(
    //   reserveBAfter.toFixed(1),
    //   'Reserve B should decrease to 0.857142858',
    // ).toBe('0.8');

    const user2ATokenBalanceAfter = await getTokenBalance(
      aTokenAddress,
      user2Provider.address,
      user2Provider,
    );

    const user2MasBalanceAfter = await user2Provider.balance(false);

    console.log('User2 A Token balance after: ', user2ATokenBalanceAfter);
    console.log('User2 MAS balance after: ', user2MasBalanceAfter);

    const contractATokenBalanceAfter = await getTokenBalance(
      aTokenAddress,
      poolAddress,
      user2Provider,
    );

    const contractBTokenBalanceAfter = await getTokenBalance(
      bTokenAddress,
      poolAddress,
      user2Provider,
    );

    console.log('Contract A Token balance after: ', contractATokenBalanceAfter);
    console.log('Contract B Token balance after: ', contractBTokenBalanceAfter);
  });
});

describe('Oracle TWAP tests', () => {
  beforeAll(async () => {
    registryContract = await deployRegistryContract(user1Provider, wmasAddress);
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

  test('Get pool TWAP and accumulative prices at first contract deployment', async () => {
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve A should be 0').toBe(0n);
    expect(reserveB, 'Reserve B should be 0').toBe(0n);

    const priceAccumulativeA = await getAPriceCumulativeLast(poolContract);
    const priceAccumulativeB = await getBPriceCumulativeLast(poolContract);

    console.log('Price Accumulative A: ', priceAccumulativeA);
    console.log('Price Accumulative B: ', priceAccumulativeB);

    expect(priceAccumulativeA, 'Price Accumulative A should be 0').toBe(0n);
    expect(priceAccumulativeB, 'Price Accumulative B should be 0').toBe(0n);
  });

  test('Add liquidity to pool', async () => {
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

    expect(user1LPBalance, 'User1 LP balance should be 10').toBe(
      parseMas('10'),
    );
  });

  test('swap B to A token in pool', async () => {
    // switch poolContrcat to user2 provider
    poolContract = new SmartContract(user2Provider, poolAddress);

    // get all pool reserves and expect them to be 0
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve A should be 10 before swap').toBe(parseMas('10'));
    expect(reserveB, 'Reserve B should be 10 before swap').toBe(parseMas('10'));

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

    console.log('Reserve A after swap: ', formatMas(reserveAAfter));
    console.log('Reserve B after swap: ', formatMas(reserveBAfter));

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

    console.log('Final K: ', finalK);

    expect(
      finalK,
      'Final K should be greater than or equal to initial K',
    ).toBeGreaterThanOrEqual(initialK);
  });

  test('Get pool TWAP and accumulative prices after swap', async () => {
    const priceAccumulativeA = await getAPriceCumulativeLast(poolContract);
    const priceAccumulativeB = await getBPriceCumulativeLast(poolContract);

    console.log('Price Accumulative A: ', priceAccumulativeA);
    console.log('Price Accumulative B: ', priceAccumulativeB);

    expect(
      priceAccumulativeA,
      'Price Accumulative A should be greater than 0',
    ).toBeGreaterThan(0n);

    expect(
      priceAccumulativeB,
      'Price Accumulative B should be greater than 0',
    ).toBeGreaterThan(0n);
  });
});

describe('Scenario 3: Add liquidity, Swap, Remove liquidity with input fees', async () => {
  beforeAll(async () => {
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      0.05,
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

    expect(user1LPBalance, 'User1 LP balance should be 10').toBe(
      parseMas('10'),
    );
  });

  test("User 2 swaps B token for A token in pool's reserves", async () => {
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

    expect(
      user1LPBalanceBefore,
      'User1 LP balance should be equals to 10 before removing liquidity',
    ).toBe(parseMas('10'));

    const lpAmount = 10;
    const minAOutAmount = 0;
    const minBOutAmount = 0;

    // remove liquidity
    await removeLiquidity(poolContract, lpAmount, minAOutAmount, minBOutAmount);

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
  });
});

describe('Scenario 4: Add liquidity using different token decimals wmas(9 decimals) and token A (18 decimals)', async () => {
  beforeAll(async () => {
    // another token that its decimals are 18
    aTokenAddress = 'AS12mmxJw7XF4iRpMpuMbYLcs2xX6EUKT9E9Bs7hzPPUxPk5ZZsaN';
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      0.05,
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
      parseUnits('10', 18),
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

    const m = 10000000000n * 10000000000000000000n;
    const sqrtM = Math.sqrt(Number(m));

    expect(user1LPBalance, 'User1 LP balance should be 10').toBe(
      BigInt(sqrtM.toString().split('.')[0]),
    );
  });

  test("User 2 adds liquidity to pool's reserves", async () => {
    // switch poolContrcat to user2 provider
    poolContract = new SmartContract(user2Provider, poolAddress);

    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(
      parseUnits('10', 18),
    );
    expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(
      parseUnits('10', 9),
    );

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

    const aAmount = 10;
    const bAmount = 10;

    // check if user 2 has enough tokens to add liquidity
    expect(
      user2ATokenBalanceBefore,
      'User2 does not have enough A tokens to add liquidity',
    ).toBeGreaterThanOrEqual(parseUnits(aAmount.toString(), 18));

    expect(
      user2BTokenBalanceBefore,
      'User2 does not have enough B tokens to add liquidity',
    ).toBeGreaterThanOrEqual(parseUnits(bAmount.toString(), 9));

    // increase allowance of both tokerns amoutns first before adding liquidity
    await increaseAllownace(
      aTokenAddress,
      poolAddress,
      aAmount,
      user2Provider,
      18,
    );

    await increaseAllownace(bTokenAddress, poolAddress, bAmount, user2Provider);

    // add liquidity
    await addLiquidity(poolContract, aAmount, bAmount, 0, 0, 18);

    // get the reserves after adding liquidity
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    expect(reserveAAfter, 'Reserve A should be 20 after adding liquidity').toBe(
      parseUnits('20', 18),
    );
    expect(reserveBAfter, 'Reserve B should be 20 after adding liquidity').toBe(
      parseUnits('20', 9),
    );

    // get the lp balance of user2
    const user2LPBalance = await getLPBalance(
      poolContract,
      user2Provider.address,
    );

    console.log('User2 LP balance: ', user2LPBalance);

    const m = 10000000000n * 10000000000000000000n;
    const sqrtM = Math.sqrt(Number(m));

    expect(user2LPBalance, 'User2 LP balance should be 10').toBe(
      BigInt(sqrtM.toString().split('.')[0]),
    );
  });
});

describe('Scenario 5: Add liquidity and swap with different token decimals wmas(9 decimals) and token A (18 decimals)', async () => {
  beforeAll(async () => {
    // another token that its decimals are 18
    aTokenAddress = 'AS12mmxJw7XF4iRpMpuMbYLcs2xX6EUKT9E9Bs7hzPPUxPk5ZZsaN';
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      0.05,
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
      parseUnits('10', 18),
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

    const m = 10000000000n * 10000000000000000000n;
    const sqrtM = Math.sqrt(Number(m));

    expect(user1LPBalance, 'User1 LP balance should be 10').toBe(
      BigInt(sqrtM.toString().split('.')[0]),
    );
  });

  test("User2 swaps B token for A token in pool's reserves", async () => {
    // switch to user 2
    poolContract = new SmartContract(user2Provider, poolAddress);

    // get all pool reserves and expect them to be 10
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    expect(reserveA, 'Reserve A should be 10 before swap').toBe(
      parseUnits('10', 18),
    );
    expect(reserveB, 'Reserve B should be 10 before swap').toBe(parseMas('10'));

    const bSwapAmount = 5;
    const minAOutAmount = 1;

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

    // Ensure that user2 has enough B tokens to swap
    expect(
      user2BTokenBalanceBefore,
      'User2 token B balance should be greater than swap amount',
    ).toBeGreaterThanOrEqual(parseMas(bSwapAmount.toString()));

    // increase allowance of B token amount first before swapping
    await increaseAllownace(
      bTokenAddress,
      poolAddress,
      bSwapAmount,
      user2Provider,
    );

    // swap
    await swap(poolContract, bTokenAddress, bSwapAmount, minAOutAmount, 9, 18);

    // get the reserves after the swap
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    expect(
      Number(formatUnits(reserveAAfter, 18)).toFixed(5),
      'Reserve A should be 6.67334 after swap',
    ).toBe('6.67334');

    expect(reserveBAfter, 'Reserve B should be 14.985 after swap').toBe(
      parseMas('14.9999925'),
    );

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

    expect(
      user2BTokenBalanceAfter,
      'User2 B token balance should decrease after swap',
    ).toBe(user2BTokenBalanceBefore - parseMas(bSwapAmount.toString()));
  });

  test("User1 removes its liquidity using percentage from pool's reserves", async () => {
    // switch to user 1
    poolContract = new SmartContract(user1Provider, poolAddress);

    // get all pool reserves
    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    const removeLpPercentage = 50; // 50%
    const minAmountA = 1;
    const minAmountB = 1;

    // remove lqiudiity using percentage
    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      removeLpPercentage,
      minAmountA,
      minAmountB,
      18, // a decimals
      9, // b decimals
    );

    // get the reserves after the remove liquidity
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    const expectedReserveA = 3336670003336680555n;

    const expectedReserveB = 7499996251n;

    console.log('Expected Reserve A after: ', expectedReserveA);
    console.log('Expected Reserve B after: ', expectedReserveB);

    expect(
      reserveAAfter,
      'Reserve A should be equals to expected reserve after remove liquidity',
    ).toBe(expectedReserveA);

    expect(
      reserveBAfter,
      'Reserve B should be equals to expected reserve after remove liquidity',
    ).toBe(expectedReserveB);

    // Get the token lp balance of user1
    const user1LPBalance = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance after: ', user1LPBalance);

    // Number(formatUnits(reserveAAfter, 18)).toFixed(5)
  });

  test('User 1 removes teh rest of its liquidity from the pool', async () => {
    // switch to user 1
    poolContract = new SmartContract(user1Provider, poolAddress);

    const removeLpPercentage = 100; // 100%
    const minAmountA = 1;
    const minAmountB = 1;

    // remove lqiudiity using percentage
    await removeLiquidityUsingPercentage(
      poolContract,
      user1Provider,
      removeLpPercentage,
      minAmountA,
      minAmountB,
      18, // a decimals
      9, // b decimals
    );

    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);
    const user1LPBalanceAfter = await getLPBalance(
      poolContract,
      user1Provider.address,
    );

    console.log('User1 LP balance after: ', user1LPBalanceAfter);
    console.log('Reserve A after: ', reserveAAfter);
    console.log('Reserve B after: ', reserveBAfter);

    expect(reserveAAfter, 'Reserve A should be 0 after remove liquidity').toBe(
      0n,
    );
    expect(reserveBAfter, 'Reserve B should be 0 after remove liquidity').toBe(
      0n,
    );
    expect(
      user1LPBalanceAfter,
      'User1 LP balance should be 0 after remove liquidity',
    ).toBe(0n);
  });
});

describe('Scenario 6: Add liquidity, swap and remove using low amounts', async () => {
  beforeAll(async () => {
    poolFeeRate = 0.3 * 10_000;

    registryContract = await deployRegistryContract(
      user1Provider,
      wmasAddress,
      0.05,
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

    expect(user1LPBalance, 'User1 LP balance should be 0.1').toBe(
      parseMas(Math.sqrt(aAmount * bAmount).toString()),
    );
  });

  test("User 2 swaps B token for A token in pool's reserves", async () => {
    // switch poolContract to user2
    poolContract = new SmartContract(user2Provider, poolAddress);

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
      poolAddress,
      bSwapAmount,
      user2Provider,
    );

    // swap B token for A token
    await swap(poolContract, bTokenAddress, bSwapAmount, minAmountOut);

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
      reserveAAfter,
      'Reserve A should be 0 after removing all liquidity',
    ).toBe(0n);

    expect(
      reserveBAfter,
      'Reserve B should be 0 after removing all liquidity',
    ).toBe(0n);

    expect(
      user1LPBalanceAfter,
      'User1 A Token balance should be 0 after removing full liquidity',
    ).toBe(0n);

    expect(
      user1ATokenBalanceAfter,
      'User1 A Token balance should increased by the total resreve A amount',
    ).toBe(reserveA + user1ATokenBalanceBefore);

    expect(
      user1BTokenBalanceAfter,
      'User1 B Token balance should increased by the total resreve B amount',
    ).toBe(reserveB + user1BTokenBalanceBefore);
  });
});
