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
let aTokenAddress = 'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ';
let bTokenAddress = wmasAddress;
let poolFeeRate = 0.3 * 10_000;

let registryContract: SmartContract;
let poolContract: SmartContract;
let swapRouterContract: SmartContract;
let poolAddress: string;

// beforeAll(async () => {
//   registryContract = await deployRegistryContract(user1Provider, wmasAddress);

//   // create new pool
//   await createNewPool(
//     registryContract,
//     aTokenAddress,
//     bTokenAddress,
//     poolFeeRate,
//   );

//   const pool = await getPool(
//     registryContract,
//     aTokenAddress,
//     bTokenAddress,
//     poolFeeRate,
//   );

//   // get the last pool address
//   poolAddress = pool.poolAddress;

//   poolContract = new SmartContract(user1Provider, poolAddress);

//   // Create the swap router contract
//   swapRouterContract = await deploySwapRouterContract(
//     user1Provider,
//     registryContract.address,
//   );

//   // Set the swap router address in the registry contract
//   await setSwapRouterAddress(registryContract, swapRouterContract.address);
// });

// beforeAll(async () => {
//   poolAddress = 'AS12S6apFw6tmkFfA6W9iAMUMKjzu3ZkZXqZixXRUHpSYnsdMqpns';
//   poolContract = new SmartContract(user1Provider, poolAddress);

//   swapRouterContract = new SmartContract(
//     user1Provider,
//     'AS12M6VuwUnxDt3W9UQ6d2yMoJYY1XFHEwySPjum95FqvKZ7ba7AV',
//   );

//   registryContract = new SmartContract(
//     user1Provider,
//     'AS12CF51tsTAs4wsw772g76QKfxdM4JDrUwe1H5GEYrJqzQnJybR5',
//   );
// });

test.skip('User 1 adds liquidity to the pool', async () => {
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

test.skip('User1 transfer maunally additonal amount of B token to the pool', async () => {
  const bToken = new MRC20(user1Provider, bTokenAddress);

  const transOpe = await bToken.transfer(poolAddress, parseMas('2'));

  const status = await transOpe.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Transfer to pool successful');
  } else {
    console.log('Status:', status);
    console.log('Error events:', await transOpe.getSpeculativeEvents());
    throw new Error('Failed to transfer');
  }

  // get all pool reserves
  const [reserveA, reserveB] = await getPoolReserves(poolContract);

  expect(reserveA, 'Reserve A should be 10 after adding liquidity').toBe(
    parseUnits('10', 6),
  );

  expect(reserveB, 'Reserve B should be 10 after adding liquidity').toBe(
    parseUnits('10', 9),
  );
});

test.skip('Should fail : User1 swaps B token for A token in pool without passing the amountIn', async () => {
  const swapPath = [
    new SwapPath(
      poolContract.address,
      bTokenAddress,
      aTokenAddress,
      user1Provider.address,
      parseMas('1'),
      1n,
      false,
    ),
  ];

  const poolReserves = await getPoolReserves(poolContract);
  console.log('Pool Reserves Before Swap: ', poolReserves);

  const bToken = new MRC20(user1Provider, bTokenAddress);

  const tokenBContractBalance = await bToken.balanceOf(poolAddress);

  console.log('Token B contract balance before swap: ', tokenBContractBalance);

  expect(tokenBContractBalance, 'Token B contract balance should be 2').toBe(
    parseMas('12'),
  );

  await expect(swap(swapRouterContract, swapPath, '0.01')).rejects.toThrowError(
    'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: Depth error: Runtime error: error: INSUFFICIENT_TOKEN_IN_ALLOWANCE at assembly/contracts/swapRouter.ts:290 col: 7',
  );
});

test.skip('Do a Correct Swap', async () => {
  const swapRoute = [
    new SwapPath(
      poolContract.address,
      bTokenAddress,
      aTokenAddress,
      user1Provider.address,
      parseMas('1'),
      1n,
      false,
    ),
  ];

  const poolReserves = await getPoolReserves(poolContract);
  console.log('Pool Reserves Before Swap: ', poolReserves);

  // Increase allowance for BToken
  await increaseAllownace(
    bTokenAddress,
    swapRouterContract.address,
    1,
    user1Provider,
    9,
  );

  // swap B token for A token
  await swap(swapRouterContract, swapRoute, '0.01');

  // get reserves after swap
  const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

  console.log('Reserve A after swap: ', reserveAAfter);
  console.log('Reserve B after swap: ', reserveBAfter);
});
