// import { beforeAll, describe, expect, it, test } from 'vitest';
// import * as dotenv from 'dotenv';
// import {
//   Account,
//   Args,
//   formatMas,
//   formatUnits,
//   Mas,
//   MRC20,
//   parseMas,
//   parseUnits,
//   SmartContract,
//   Web3Provider,
// } from '@massalabs/massa-web3';
// import {
//   createNewPool,
//   deployRegistryContract,
//   getPools,
// } from './calls/registry';
// import { Pool } from '../src/builnet-tests/structs/pool';
// import {
//   calculateExpectedSwapAddedAmount,
//   calculateProtocolFeeAmount,
//   getScByteCode,
//   NATIVE_MAS_COIN_ADDRESS,
//   truncateDecimals,
// } from './utils';
// import {
//   addLiquidity,
//   addLiquidityWithMAS,
//   claimeProtocolFees,
//   getAPriceCumulativeLast,
//   getBClaimableProtocolFee,
//   getBPriceCumulativeLast,
//   getLPBalance,
//   getPoolReserves,
//   getSwapOutEstimation,
//   getTokenBalance,
//   increaseAllownace,
//   removeLiquidity,
//   removeLiquidityUsingPercentage,
//   swap,
//   swapWithMAS,
// } from './calls/basicPool';

// dotenv.config();

// const user1Provider = Web3Provider.buildnet(await Account.fromEnv());
// const user2Provider = Web3Provider.buildnet(
//   await Account.fromEnv('PRIVATE_KEY_TWO'),
// );

// console.log('User1 address: ', user1Provider.address);
// console.log('User2 address: ', user2Provider.address);

// const wmasAddress = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';
// let aTokenAddress = 'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
// const bTokenAddress = wmasAddress;
// let poolFeeRate = 0;

// let registryContract: SmartContract;
// let poolContract: SmartContract;
// let poolAddress: string;
// let aClaimableFees: number;
// let bClaimableFees: number;

// describe('Scenario 1: Add liquidity, swap and remove liquiidty then claim protocol fees with a normal user', async () => {
//   beforeAll(async () => {
//     poolFeeRate = 0.3 * 10_000;

//     registryContract = await deployRegistryContract(
//       user1Provider,
//       wmasAddress,
//       0.05,
//       0.3,
//     );

//     // create new pool
//     await createNewPool(
//       registryContract,
//       aTokenAddress,
//       bTokenAddress,
//       poolFeeRate,
//     );

//     const pools = await getPools(registryContract);

//     console.log('Pools: ', pools);

//     expect(pools.length > 0, 'No pools found');

//     // get the last pool address
//     poolAddress = pools[pools.length - 1].poolAddress;

//     poolContract = new SmartContract(user1Provider, poolAddress);
//     aClaimableFees = 0;
//     bClaimableFees = 0;
//   });

//   test('User 1 Add liquidity to pool when its empty', async () => {
//     // get all pool reserves and expect them to be 0
//     const [reserveA, reserveB] = await getPoolReserves(poolContract);

//     expect(reserveA, 'Reserve should be 0 when pool is empty').toBe(0n);
//     expect(reserveB, 'Reserve should be 0 when pool is empty').toBe(0n);

//     const user1ATokenBalanceBefore = await getTokenBalance(
//       aTokenAddress,
//       user1Provider.address,
//       user1Provider,
//     );

//     const user1BTokenBalanceBefore = await getTokenBalance(
//       bTokenAddress,
//       user1Provider.address,
//       user1Provider,
//     );

//     const aAmount = 100;
//     const bAmount = 10;

//     // increase allowance of both tokerns amoutns first before adding liquidity
//     await increaseAllownace(aTokenAddress, poolAddress, aAmount, user1Provider);
//     await increaseAllownace(bTokenAddress, poolAddress, bAmount, user1Provider);

//     // add liquidity
//     await addLiquidity(poolContract, aAmount, bAmount, 0, 0);

//     // get teh reserves
//     const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

//     const user1ATokenBalanceAfter = await getTokenBalance(
//       aTokenAddress,
//       user1Provider.address,
//       user1Provider,
//     );

//     const user1BTokenBalanceAfter = await getTokenBalance(
//       bTokenAddress,
//       user1Provider.address,
//       user1Provider,
//     );

//     expect(
//       user1ATokenBalanceAfter,
//       'User1 A Token balance should decrease after adding liquidity',
//     ).toBe(user1ATokenBalanceBefore - parseMas(aAmount.toString()));

//     expect(
//       user1BTokenBalanceAfter,
//       'User1 B Token balance should decrease after adding liquidity',
//     ).toBe(user1BTokenBalanceBefore - parseMas(bAmount.toString()));

//     expect(
//       reserveAAfter,
//       'Reserve A should be aAmount after adding liquidity',
//     ).toBe(parseMas(aAmount.toString()));

//     expect(
//       reserveBAfter,
//       'Reserve B should be bAmount after adding liquidity',
//     ).toBe(parseMas(bAmount.toString()));

//     // get the lp balance of user1
//     const user1LPBalance = await getLPBalance(
//       poolContract,
//       user1Provider.address,
//     );

//     expect(user1LPBalance, 'User1 LP balance should be 0.1').toBe(
//       parseMas(truncateDecimals(Math.sqrt(aAmount * bAmount))),
//     );
//   });

//   test("User 2 swaps B token for A token in pool's reserves", async () => {
//     // switch poolContract to user2
//     poolContract = new SmartContract(user2Provider, poolAddress);

//     // get all pool reserves
//     const [reserveA, reserveB] = await getPoolReserves(poolContract);

//     const initialK = reserveA * reserveB;

//     console.log('Initial K: ', initialK);
//     console.log('Reserve A: ', reserveA);
//     console.log('Reserve B: ', reserveB);

//     // swap B token for A token
//     const bSwapAmount = 5;

//     const expectedaAmountOut = await getSwapOutEstimation(
//       poolContract,
//       bSwapAmount,
//       bTokenAddress,
//     );

//     const minAmountOut = Number(
//       formatMas(expectedaAmountOut - (expectedaAmountOut * 1n) / 100n),
//     );

//     console.log('Expected A amount out: ', expectedaAmountOut);
//     console.log('Min amount out: ', minAmountOut);

//     const user2ATokenBalanceBefore = await getTokenBalance(
//       aTokenAddress,
//       user2Provider.address,
//       user2Provider,
//     );

//     const user2BTokenBalanceBefore = await getTokenBalance(
//       bTokenAddress,
//       user2Provider.address,
//       user2Provider,
//     );

//     expect(
//       user2BTokenBalanceBefore,
//       'User2 B Token balance should be greater than or equals to swap amount',
//     ).toBeGreaterThanOrEqual(parseMas(bSwapAmount.toString()));

//     // increase allownace for BToken
//     await increaseAllownace(
//       bTokenAddress,
//       poolAddress,
//       bSwapAmount,
//       user2Provider,
//     );

//     // swap B token for A token
//     await swap(poolContract, bTokenAddress, bSwapAmount, minAmountOut);

//     // get reserves after swap
//     const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

//     // get user2 balances after swap
//     const user2ATokenBalanceAfter = await getTokenBalance(
//       aTokenAddress,
//       user2Provider.address,
//       user2Provider,
//     );

//     const user2BTokenBalanceAfter = await getTokenBalance(
//       bTokenAddress,
//       user2Provider.address,
//       user2Provider,
//     );

//     const finalK = reserveAAfter * reserveBAfter;

//     expect(
//       reserveAAfter,
//       'Reserve A After should be equals to initial reserve A - expectedOutAmount',
//     ).toBe(reserveA - expectedaAmountOut);

//     const estimatedReserveBAfter =
//       calculateExpectedSwapAddedAmount(bSwapAmount);

//     expect(
//       reserveBAfter,
//       'Reserve B After should be equals to initial reserve B + swap amount',
//     ).toBe(reserveB + parseMas(estimatedReserveBAfter.toString()));

//     expect(finalK, 'Final K should be greater than initial K').toBeGreaterThan(
//       initialK,
//     );

//     expect(
//       user2ATokenBalanceAfter,
//       'User2 A Token balance should increase after swap',
//     ).toBe(user2ATokenBalanceBefore + expectedaAmountOut);

//     expect(
//       user2BTokenBalanceAfter,
//       'User2 B Token balance should increase after swap',
//     ).toBe(user2BTokenBalanceBefore - parseMas(bSwapAmount.toString()));

//     const claimedProtocolFees = calculateProtocolFeeAmount(bSwapAmount);

//     bClaimableFees += claimedProtocolFees;

//     console.log('B Claimable fees: ', bClaimableFees);
//   });

//   test('User 1 removes its full liquidity', async () => {
//     // switch poolContract to user1
//     poolContract = new SmartContract(user1Provider, poolAddress);

//     // get all pool reserves
//     const [reserveA, reserveB] = await getPoolReserves(poolContract);

//     const user1ATokenBalanceBefore = await getTokenBalance(
//       aTokenAddress,
//       user1Provider.address,
//       user1Provider,
//     );

//     const user1BTokenBalanceBefore = await getTokenBalance(
//       bTokenAddress,
//       user1Provider.address,
//       user1Provider,
//     );

//     const user1LPBalance = await getLPBalance(
//       poolContract,
//       user1Provider.address,
//     );

//     expect(
//       user1LPBalance,
//       'User1 LP balance should be greater than 0',
//     ).toBeGreaterThan(0n);

//     const lpPercentage = 100; // 100%

//     await removeLiquidityUsingPercentage(
//       poolContract,
//       user1Provider,
//       lpPercentage,
//       0,
//       0,
//     );

//     const user1ATokenBalanceAfter = await getTokenBalance(
//       aTokenAddress,
//       user1Provider.address,
//       user1Provider,
//     );

//     const user1BTokenBalanceAfter = await getTokenBalance(
//       bTokenAddress,
//       user1Provider.address,
//       user1Provider,
//     );

//     const user1LPBalanceAfter = await getLPBalance(
//       poolContract,
//       user1Provider.address,
//     );

//     const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

//     expect(
//       reserveAAfter,
//       'Reserve A should be 0 after removing all liquidity',
//     ).toBe(0n);

//     expect(
//       reserveBAfter,
//       'Reserve B should be 0 after removing all liquidity',
//     ).toBe(0n);

//     expect(
//       user1LPBalanceAfter,
//       'User1 A Token balance should be 0 after removing full liquidity',
//     ).toBe(0n);

//     expect(
//       user1ATokenBalanceAfter,
//       'User1 A Token balance should increased by the total resreve A amount',
//     ).toBe(reserveA + user1ATokenBalanceBefore);

//     expect(
//       user1BTokenBalanceAfter,
//       'User1 B Token balance should increased by the total resreve B amount',
//     ).toBe(reserveB + user1BTokenBalanceBefore);
//   });

//   test('User 2 init claim protocol fees but they should be sent to User1 balance ', async () => {
//     // switch poolContract to user2
//     poolContract = new SmartContract(user2Provider, poolAddress);

//     // Get the balances of token B for user 1 and 2 before claiming protocol fees
//     const user2BTokenBalanceBefore = await getTokenBalance(
//       bTokenAddress,
//       user2Provider.address,
//       user2Provider,
//     );

//     const user1BTokenBalanceBefore = await getTokenBalance(
//       bTokenAddress,
//       user1Provider.address,
//       user1Provider,
//     );

//     expect(
//       bClaimableFees,
//       'Protocol fees should be greater than 0',
//     ).toBeGreaterThanOrEqual(0);

//     // Claim protocol fees as user 2
//     await claimeProtocolFees(poolContract);

//     // Get the balances of token B for user 1 and 2 after claiming protocol fees
//     const user2BTokenBalanceAfter = await getTokenBalance(
//       bTokenAddress,
//       user2Provider.address,
//       user2Provider,
//     );

//     const user1BTokenBalanceAfter = await getTokenBalance(
//       bTokenAddress,
//       user1Provider.address,
//       user1Provider,
//     );

//     // Expect user2 balance to stay the same after
//     expect(
//       user2BTokenBalanceAfter,
//       'User2 B Token balance should stay the same after claiming protocol fees',
//     ).toBe(user2BTokenBalanceBefore);

//     // Expect user1 balance to increase by the protocol fees
//     expect(
//       user1BTokenBalanceAfter,
//       'User1 B Token balance should increase by the protocol fees',
//     ).toBe(user1BTokenBalanceBefore + parseMas(bClaimableFees.toString()));

//     // get the b claimable fees of pool contract
//     const poolBClaimableFees = await getBClaimableProtocolFee(poolContract);

//     expect(
//       poolBClaimableFees,
//       'Pool B claimable fees should be 0 after claiming protocol fees',
//     ).toBe(0n);
//   });
// });
