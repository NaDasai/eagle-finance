import { beforeAll, describe, expect, it, test } from 'vitest';
import * as dotenv from 'dotenv';
import {
  Account,
  Args,
  formatMas,
  Mas,
  MRC20,
  parseMas,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { createNewPool, deployRegistryContract } from './calls/registry';
import { Pool } from '../src/builnet-tests/structs/pool';
import { getScByteCode, NATIVE_MAS_COIN_ADDRESS } from './utils';
import {
  addLiquidity,
  addLiquidityWithMAS,
  getLPBalance,
  getPoolReserves,
  getPools,
  getPoolTWAP,
  getTokenBalance,
  increaseAllownace,
  removeLiquidity,
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
const aTokenAddress = 'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
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

    const pools = await getPools(registryContract);

    console.log('Pools: ', pools);

    expect(pools.length > 0, 'No pools found');

    // get the last pool address
    poolAddress = pools[pools.length - 1].poolAddress;

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

describe('Scenario 2: Add liquidity, Swap native coins in and out', async () => {
  beforeAll(async () => {
    registryContract = await deployRegistryContract(user1Provider, wmasAddress);
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

    expect(
      user1ATokenBalanceBefore - user1ATokenBalanceAfter,
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
