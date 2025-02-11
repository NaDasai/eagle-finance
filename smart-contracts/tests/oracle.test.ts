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
//   getScByteCode,
//   NATIVE_MAS_COIN_ADDRESS,
// } from './utils';
// import {
//   addLiquidity,
//   addLiquidityWithMAS,
//   getAPriceCumulativeLast,
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
// import {
//   deployOracleContract,
//   getAPriceAverage,
//   getBPriceAverage,
//   updateOraclePrices,
// } from './calls/oracle';

// dotenv.config();

// const user1Provider = Web3Provider.buildnet(await Account.fromEnv());
// const user2Provider = Web3Provider.buildnet(
//   await Account.fromEnv('PRIVATE_KEY_TWO'),
// );

// const wmasAddress = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';
// let aTokenAddress = 'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
// const bTokenAddress = wmasAddress;
// let poolFeeRate = 0;
// let period = 1000; // 1 second

// let registryContract: SmartContract;
// let poolContract: SmartContract;
// let poolAddress: string;
// let oracleContract: SmartContract;

// describe('Scenario 1: test oracle TWAP normal case', async () => {
//   beforeAll(async () => {
//     poolFeeRate = 0.3 * 10_000;

//     registryContract = await deployRegistryContract(
//       user1Provider,
//       wmasAddress,
//       0.05,
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
//   });

//     test('Should fail deploying oracle contract with empty pool address', async () => {
//       // deploy oracle contract
//       await expect(
//         (oracleContract = await deployOracleContract(
//           user1Provider,
//           poolAddress,
//           period,
//         )),
//       ).rejects.toThrow('POOL_WITHOUT_LIQUIDITY');
//     });

//     test('should fail if invalid poolAddress is passed', async () => {
//       const fakePoolAddress =
//         'AS12WtrGkZietfjbHQ5AeyXBUvR2rC28HJwHSo8UzRNF58QLsoPR9';

//       await expect(
//         (oracleContract = await deployOracleContract(
//           user1Provider,
//           fakePoolAddress,
//           period,
//         )),
//       ).rejects.toThrow(
//         'AS12WtrGkZietfjbHQ5AeyXBUvR2rC28HJwHSo8UzRNF58QLsoPR9 is not a valid Address ',
//       );
//     });

//   test('User1 adds liquidity, then he deploy an oracle contract that should deployed succesfully', async () => {
//     // get all pool reserves and expect them to be 0
//     const [reserveA, reserveB] = await getPoolReserves(poolContract);

//     expect(reserveA, 'Reserve A should be 0 ').toBe(0n);
//     expect(reserveB, 'Reserve B should be 0 ').toBe(0n);

//     const aAmount = 10;
//     const bAmount = 1;

//     // Increase allowance
//     await increaseAllownace(
//       aTokenAddress,
//       poolContract.address,
//       aAmount,
//       user1Provider,
//     );

//     await increaseAllownace(
//       bTokenAddress,
//       poolContract.address,
//       bAmount,
//       user1Provider,
//     );

//     // add liquidity
//     await addLiquidity(poolContract, aAmount, bAmount, 0, 0);

//     // get all pool reserves and expect them to be equals to the amount added
//     const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

//     expect(reserveAAfter, 'Reserve A should be equal to the amount added').toBe(
//       parseMas(aAmount.toString()),
//     );

//     expect(reserveBAfter, 'Reserve B should be equal to the amount added').toBe(
//       parseMas(bAmount.toString()),
//     );

//     // deploy oracle contract
//     oracleContract = await deployOracleContract(
//       user1Provider,
//       poolAddress,
//       period,
//     );

//     // Get the price of A and B and expect them to be 0 because we never called update function
//     const aPrice = await getAPriceAverage(oracleContract);
//     const bPrice = await getBPriceAverage(oracleContract);

//     expect(aPrice, 'A price should be 0').toBe(0n);
//     expect(bPrice, 'B price should be 0').toBe(0n);
//   });

//   test('User1 calls update in oracle 2 times sperated by 1s period. the price avg should be 0', async () => {
//     // call the update function twice
//     await updateOraclePrices(oracleContract);

//     // wait for 1 second
//     // await new Promise((resolve) => setTimeout(resolve, 1000));

//     // get the average price of A and B
//     const aPrice = await getAPriceAverage(oracleContract);
//     const bPrice = await getBPriceAverage(oracleContract);

//     console.log('A price: ', aPrice);
//     console.log('B price: ', bPrice);

//     expect(aPrice, 'A price should not be 0').toBe(0n);
//     expect(bPrice, 'B price should not be 0').toBe(0n);

//     // wait for the period of oracle to pass
//     await new Promise((resolve) => setTimeout(resolve, 1000));

//     // call the update function again
//     await updateOraclePrices(oracleContract);

//     const aPrice2 = await getAPriceAverage(oracleContract);
//     const bPrice2 = await getBPriceAverage(oracleContract);

//     console.log('A price: ', aPrice2);
//     console.log('B price: ', bPrice2);

//     expect(aPrice2, 'A price should not be 0').toBe(0n);
//     expect(bPrice2, 'B price should not be 0').toBe(0n);
//   });

//   test('User2 make swap in the pool then user1 called update in the oracle so the price should be updated', async () => {
//     // switch pool to User 2
//     poolContract = new SmartContract(user2Provider, poolAddress);

//     // get reserves before
//     const [reserveA, reserveB] = await getPoolReserves(poolContract);

//     expect(reserveA, 'Reserve A should be 10 ').toBe(parseMas('10'));
//     expect(reserveB, 'Reserve B should be 1 ').toBe(parseMas('1'));

//     const aSwapAmount = 1;
//     const minBSwapOut = 0.001;
//     const expectedBAmountOut = await getSwapOutEstimation(
//       poolContract,
//       aSwapAmount,
//       aTokenAddress,
//     );

//     // increase allowance
//     await increaseAllownace(
//       aTokenAddress,
//       poolContract.address,
//       aSwapAmount,
//       user2Provider,
//     );

//     // swap
//     await swap(poolContract, aTokenAddress, aSwapAmount, minBSwapOut);

//     // get reserves after
//     const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

//     // expect the reserves to be changed
//     const expectedAddedToReserveA = calculateExpectedSwapAddedAmount(
//       aSwapAmount,
//       0.3,
//       0.05,
//     );

//     console.log('expectedAddedToReserveA: ', expectedAddedToReserveA);

//     expect(reserveAAfter, 'Reserve A should be reserve a + aswapAmount ').toBe(
//       reserveA + parseMas(expectedAddedToReserveA.toString()),
//     );

//     expect(
//       reserveBAfter,
//       'Reserve B should be reserve b - expectedBAmountOut ',
//     ).toBe(reserveB - expectedBAmountOut);

//     // call the update function
//     await updateOraclePrices(oracleContract);

//     const aPrice = await getAPriceAverage(oracleContract);
//     const bPrice = await getBPriceAverage(oracleContract);

//     console.log('A price: ', aPrice);
//     console.log('B price: ', bPrice);
//   });
// });
