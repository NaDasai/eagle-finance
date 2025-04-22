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
import { deployFlashSwapContract, initFlash } from './calls/flash';

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
let flashSwapContract: SmartContract;
let flashSwapContractAddress: string;

describe.skip('Scenario 1: User 1 Add liquidity, and then flash loan', async () => {
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

    // Deploy flash exemple Contract and transfer amount to it
    flashSwapContract = await deployFlashSwapContract(
      user2Provider,
      poolAddress,
      registryContract.address,
    );

    flashSwapContractAddress = flashSwapContract.address;
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

  test('User 2 flash loan 5 of A from that pool', async () => {
    // switch to user 2
    poolContract = new SmartContract(user2Provider, poolAddress);

    const [reserveA, reserveB] = await getPoolReserves(poolContract);

    console.log('Reserve A: ', reserveA);
    console.log('Reserve B: ', reserveB);

    expect(reserveA, 'Reserve A should be 10').toBe(
      parseUnits('10', aDecimals),
    );
    expect(reserveB, 'Reserve B should be 10').toBe(
      parseUnits('10', bDecimals),
    );

    const tokenA = new MRC20(user1Provider, aTokenAddress);
    const tokenB = new MRC20(user1Provider, bTokenAddress);

    // user 1 transfer 3 aTokens to teh flash swap contract for testign purpose
    const trasnferOperation = await tokenA.transfer(
      flashSwapContractAddress,
      parseUnits('3', aDecimals),
    );

    const status = await trasnferOperation.waitSpeculativeExecution();

    if (status === OperationStatus.SpeculativeSuccess) {
      console.log('Transfer To flash swap contract successfully.');
    } else {
      console.log('Status: ', status);
      const events = await trasnferOperation.getSpeculativeEvents();
      console.error('Events Error: ', events);
      throw new Error('Failed to transfer');
    }

    // Confirm that the flash swap contract a balance before flash swap is 3
    const aFlashBalanceBefore = await tokenA.balanceOf(
      flashSwapContractAddress,
    );

    expect(aFlashBalanceBefore, 'aFlashBalanceBefore should be 3').toBe(
      parseUnits('3', aDecimals),
    );

    console.log('A Flash Balance: ', aFlashBalanceBefore);

    const aAmount = parseUnits('5', aDecimals);
    const bAmount = 0n;

    const user1ATokenBalanceBefore = await getTokenBalance(
      aTokenAddress,
      user1Provider.address,
      user1Provider,
    );

    // Get user2 aToken balance before flash swap
    const aTokenBalanceBefore = await tokenA.balanceOf(user2Provider.address);
    const bTokenBalanceBefore = await tokenB.balanceOf(user2Provider.address);

    console.log(
      'User2 A Token balance before: ',
      formatUnits(aTokenBalanceBefore, aDecimals),
    );

    console.log(
      'User2 B Token balance before: ',
      formatUnits(bTokenBalanceBefore, bDecimals),
    );

    // Now user2 calls flash swap contract to loan aTokens
    await initFlash(
      flashSwapContract,
      aAmount,
      bAmount,
      user2Provider.address,
      new Args().addU256(0n).serialize(),
    );

    // Get user2 aToken balance after flash swap
    const aTokenBalanceAfter = await tokenA.balanceOf(user2Provider.address);
    const bTokenBalanceAfter = await tokenB.balanceOf(user2Provider.address);

    console.log(
      'User2 A Token balance after: ',
      formatUnits(aTokenBalanceAfter, aDecimals),
    );

    console.log(
      'User2 B Token balance after: ',
      formatUnits(bTokenBalanceAfter, bDecimals),
    );

    // Reserves should
    const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

    console.log('Reserve A after: ', formatUnits(reserveAAfter, aDecimals));
    console.log('Reserve B after: ', formatUnits(reserveBAfter, bDecimals));

    expect(reserveAAfter, 'Reserve A should be 10 aTokens').toBe(
      parseUnits('10', aDecimals),
    );

    expect(reserveBAfter, 'Reserve B should be 10 bTokens').toBe(
      parseUnits('10', bDecimals),
    );

    const aFlashBalanceAfter = await tokenA.balanceOf(flashSwapContractAddress);

    console.log('A Flash Balance after: ', aFlashBalanceAfter);

    expect(aFlashBalanceAfter, 'aFlashBalanceAfter should be 1').toBe(
      parseUnits('2', aDecimals),
    );

    const userATokenBlanceDiff = aTokenBalanceAfter - aTokenBalanceBefore;

    console.log('userATokenBlanceDiff: ', userATokenBlanceDiff);

    expect(userATokenBlanceDiff, 'userATokenBlanceDiff should be 0.995').toBe(
      parseUnits('0.995', aDecimals),
    );

    // Ensure that the user1 get the 0.005 amounts
    const user1ATokenBalanceAfter = await tokenA.balanceOf(
      user1Provider.address,
    );

    const user1ATokenBalanceDiff =
      user1ATokenBalanceAfter - user1ATokenBalanceBefore;

    console.log('user1ATokenBalanceDiff: ', user1ATokenBalanceDiff);

    expect(
      user1ATokenBalanceDiff,
      'user1ATokenBalanceDiff should be 0.005',
    ).toBe(parseUnits('0.005', aDecimals));
  });
});
