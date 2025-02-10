// import { beforeAll, describe, expect, it, test } from 'vitest';
// import * as dotenv from 'dotenv';
// import {
//   Account,
//   Args,
//   formatMas,
//   formatUnits,
//   Mas,
//   MRC20,
//   OperationStatus,
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
// import { getScByteCode, NATIVE_MAS_COIN_ADDRESS } from './utils';
// import {
//   addLiquidity,
//   addLiquidityWithMAS,
//   flash,
//   getAPriceCumulativeLast,
//   getBPriceCumulativeLast,
//   getLPBalance,
//   getPoolReserves,
//   getTokenBalance,
//   increaseAllownace,
//   removeLiquidity,
//   removeLiquidityUsingPercentage,
//   swap,
//   swapWithMAS,
// } from './calls/basicPool';
// import {
//   deployFlashMaliciousContract,
//   deployFlashReentrancyContract,
//   deployFlashSwapContract,
//   initFlash,
// } from './calls/flash';

// dotenv.config();

// const user1Provider = Web3Provider.buildnet(await Account.fromEnv());
// const user2Provider = Web3Provider.buildnet(
//   await Account.fromEnv('PRIVATE_KEY_TWO'),
// );

// console.log('User1 address: ', user1Provider.address);
// console.log('User2 address: ', user2Provider.address);

// const wmasAddress = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU'; // 9 decimals
// let aTokenAddress = 'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H'; // 9 decimals
// let bTokenAddress = wmasAddress;
// let poolFeeRate = 0.3 * 10_000;

// let registryContract: SmartContract;
// let poolContract: SmartContract;
// let poolAddress: string;
// let regisrtyAddress: string;
// let flashSwapContract: SmartContract;
// let flashSwapContractAddress: string;

// describe('Scenario 1: User 1 Add liquidity, and then flash using correct flash swap contract.', async () => {
//   beforeAll(async () => {
//     // Deploying Registry Contract
//     registryContract = await deployRegistryContract(
//       user1Provider,
//       wmasAddress,
//       0.05,
//       0.3,
//     );

//     regisrtyAddress = registryContract.address;

//     // create new pool
//     await createNewPool(
//       registryContract,
//       aTokenAddress,
//       bTokenAddress,
//       0.01 * 10_000, // pool fee rate
//     );

//     const pools = await getPools(registryContract);

//     expect(pools.length > 0, 'No pools found');

//     // get the last pool address
//     poolAddress = pools[pools.length - 1].poolAddress;

//     poolContract = new SmartContract(user1Provider, poolAddress);

//     // Deploy flash exemple Contract and transfer amount to it
//     flashSwapContract = await deployFlashSwapContract(
//       user1Provider,
//       poolAddress,
//       regisrtyAddress,
//     );

//     flashSwapContractAddress = flashSwapContract.address;
//   });

//   test('User 1 adds liquidity to the pool unisng native coin', async () => {
//     const [reserveA, reserveB] = await getPoolReserves(poolContract);

//     // Reserves should be empty
//     expect(reserveA, 'Reserve A should be 0').toBe(0n);
//     expect(reserveB, 'Reserve B should be 0').toBe(0n);

//     const aAmount = 5;
//     const bAmount = 1;

//     // increase allowance of both tokerns amoutns first before adding liquidity
//     await increaseAllownace(aTokenAddress, poolAddress, aAmount, user1Provider);

//     // add liquidity using native coin
//     await addLiquidityWithMAS(poolContract, aAmount, bAmount, 0, 0);

//     const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

//     expect(reserveAAfter, 'Reserve A should equals to aAmount').toBe(
//       parseUnits(aAmount.toString(), 9),
//     );

//     expect(reserveBAfter, 'Reserve B should be equals to bAmount').toBe(
//       parseUnits(bAmount.toString(), 9),
//     );
//   });

//   test('User2 uses flash swap contract to loan aTokens', async () => {
//     // switch to user 2
//     flashSwapContract = new SmartContract(
//       user2Provider,
//       flashSwapContractAddress,
//     );

//     poolContract = new SmartContract(user2Provider, poolAddress);

//     const [reserveA, reserveB] = await getPoolReserves(poolContract);

//     console.log('Reserve A: ', reserveA);
//     console.log('Reserve B: ', reserveB);

//     const tokenA = new MRC20(user1Provider, aTokenAddress);
//     const tokenB = new MRC20(user1Provider, bTokenAddress);

//     // user 1 transfer 3 aTokens to teh flash swap contract for testign purpose
//     const trasnferOperation = await tokenA.transfer(
//       flashSwapContractAddress,
//       parseUnits('3', 9),
//     );

//     const status = await trasnferOperation.waitSpeculativeExecution();

//     if (status === OperationStatus.SpeculativeSuccess) {
//       console.log('Transfer To flash swap contract successful');
//     } else {
//       console.log('Status:', status);
//       throw new Error('Failed to transfer');
//     }

//     // Confirm that the flash swap contract a balance before flash swap is 3
//     const aFlashBalanceBefore = await tokenA.balanceOf(
//       flashSwapContractAddress,
//     );

//     expect(aFlashBalanceBefore, 'aFlashBalanceBefore should be 3').toBe(
//       parseUnits('3', 9),
//     );

//     console.log('A Flash Balance: ', aFlashBalanceBefore);

//     const aAmount = parseMas('2');
//     const bAmount = 0n;

//     // Get user2 aToken balance before flash swap
//     const aTokenBalanceBefore = await tokenA.balanceOf(user2Provider.address);
//     const bTokenBalanceBefore = await tokenB.balanceOf(user2Provider.address);

//     console.log(
//       'User2 A Token balance before: ',
//       formatUnits(aTokenBalanceBefore, 9),
//     );

//     console.log(
//       'User2 B Token balance before: ',
//       formatUnits(bTokenBalanceBefore, 9),
//     );

//     // Now user2 calls flash swap contract to loan aTokens
//     await initFlash(
//       flashSwapContract,
//       aAmount,
//       bAmount,
//       user2Provider.address,
//       new Args().addU256(0n).serialize(),
//     );

//     // Get user2 aToken balance after flash swap
//     const aTokenBalanceAfter = await tokenA.balanceOf(user2Provider.address);
//     const bTokenBalanceAfter = await tokenB.balanceOf(user2Provider.address);

//     console.log(
//       'User2 A Token balance after: ',
//       formatUnits(aTokenBalanceAfter, 9),
//     );

//     console.log(
//       'User2 B Token balance after: ',
//       formatUnits(bTokenBalanceAfter, 9),
//     );

//     // Reserves should
//     const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

//     console.log('Reserve A after: ', formatMas(reserveAAfter));
//     console.log('Reserve B after: ', formatMas(reserveBAfter));

//     expect(reserveAAfter, 'Reserve A should be 5.006 aTokens').toBe(
//       parseMas('5.006'),
//     );

//     expect(reserveBAfter, 'Reserve B should be 1 bTokens').toBe(parseMas('1'));

//     const aFlashBalanceAfter = await tokenA.balanceOf(flashSwapContractAddress);

//     console.log('A Flash Balance after: ', aFlashBalanceAfter);

//     expect(aFlashBalanceAfter, 'aFlashBalanceAfter should be 1').toBe(
//       parseUnits('2', 9),
//     );
//   });

//   test('User2 uses flash swap contract to loan bTokens', async () => {
//     const [reserveA, reserveB] = await getPoolReserves(poolContract);

//     console.log('Reserve A: ', reserveA);
//     console.log('Reserve B: ', reserveB);

//     const tokenA = new MRC20(user1Provider, aTokenAddress);
//     const tokenB = new MRC20(user1Provider, bTokenAddress);

//     // user 1 transfer 2 bTokens to the flash swap contract for testign purpose
//     const trasnferOperation = await tokenB.transfer(
//       flashSwapContractAddress,
//       parseUnits('2', 9),
//     );

//     const status = await trasnferOperation.waitSpeculativeExecution();

//     if (status === OperationStatus.SpeculativeSuccess) {
//       console.log('Transfer To flash swap contract successful');
//     } else {
//       console.log('Status:', status);
//       throw new Error('Failed to transfer');
//     }

//     // Confirm that the flash swap contract b balance before flash swap is 2
//     const bFlashBalanceBefore = await tokenB.balanceOf(
//       flashSwapContractAddress,
//     );

//     expect(bFlashBalanceBefore, 'bFlashBalanceBefore should be 2').toBe(
//       parseUnits('2', 9),
//     );

//     const user2BTokenBalanceBefore = await tokenB.balanceOf(
//       user2Provider.address,
//     );

//     console.log('User2 B Token balance before: ', user2BTokenBalanceBefore);

//     const flashSwapData = new Args().addU256(0n).serialize();

//     // user 2 calls the flash contract to loan bTokens
//     await initFlash(
//       flashSwapContract,
//       0n,
//       parseUnits('1', 9),
//       user2Provider.address,
//       new Args().addU256(0n).serialize(),
//     );

//     const bFlashBalanceAfter = await tokenB.balanceOf(flashSwapContractAddress);

//     const user2BTokenBalanceAfter = await tokenB.balanceOf(
//       user2Provider.address,
//     );

//     console.log('User2 B Token balance after: ', user2BTokenBalanceAfter);

//     expect(bFlashBalanceAfter, 'bFlashBalanceAfter should be 1').toBe(
//       parseUnits('1', 9),
//     );

//     const [aReserveAfter, bReserveAfter] = await getPoolReserves(poolContract);

//     console.log('A reserve after: ', aReserveAfter);
//     console.log('B reserve after: ', bReserveAfter);

//     expect(aReserveAfter, 'aReserveAfter should be 5.006').toBe(
//       parseMas('5.006'),
//     );
//   });
// });

// describe('Scenario 2: User 1 Add liquidity, and then flash  using malicious flash swap contract', async () => {
//   beforeAll(async () => {
//     // Deploying Registry Contract
//     registryContract = await deployRegistryContract(
//       user1Provider,
//       wmasAddress,
//       0.05,
//     );

//     regisrtyAddress = registryContract.address;

//     // create new pool
//     await createNewPool(
//       registryContract,
//       aTokenAddress,
//       bTokenAddress,
//       poolFeeRate,
//     );

//     const pools = await getPools(registryContract);

//     expect(pools.length > 0, 'No pools found');

//     // get the last pool address
//     poolAddress = pools[pools.length - 1].poolAddress;

//     poolContract = new SmartContract(user1Provider, poolAddress);

//     // Deploy flash exemple Contract and transfer amount to it
//     flashSwapContract = await deployFlashMaliciousContract(
//       user1Provider,
//       poolAddress,
//       regisrtyAddress,
//     );

//     flashSwapContractAddress = flashSwapContract.address;
//   });

//   test('User 1 adds liquidity to the pool unisng native coin', async () => {
//     const [reserveA, reserveB] = await getPoolReserves(poolContract);

//     // Reserves should be empty
//     expect(reserveA, 'Reserve A should be 0').toBe(0n);
//     expect(reserveB, 'Reserve B should be 0').toBe(0n);

//     const aAmount = 5;
//     const bAmount = 1;

//     // increase allowance of both tokerns amoutns first before adding liquidity
//     await increaseAllownace(aTokenAddress, poolAddress, aAmount, user1Provider);

//     // add liquidity using native coin
//     await addLiquidityWithMAS(poolContract, aAmount, bAmount, 0, 0);

//     const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

//     expect(reserveAAfter, 'Reserve A should equals to aAmount').toBe(
//       parseUnits(aAmount.toString(), 9),
//     );

//     expect(reserveBAfter, 'Reserve B should be equals to bAmount').toBe(
//       parseUnits(bAmount.toString(), 9),
//     );
//   });

//   // should throw an error when user 2 uses flash swap contract to loan aTokens WRONG_RETURN_VALUE
//   test('User2 uses flash swap contract to loan aTokens', async () => {
//     // switch to user 2
//     flashSwapContract = new SmartContract(
//       user2Provider,
//       flashSwapContractAddress,
//     );

//     poolContract = new SmartContract(user2Provider, poolAddress);

//     const [reserveA, reserveB] = await getPoolReserves(poolContract);

//     console.log('Reserve A: ', reserveA);
//     console.log('Reserve B: ', reserveB);

//     const tokenA = new MRC20(user1Provider, aTokenAddress);
//     const tokenB = new MRC20(user1Provider, bTokenAddress);

//     // user 1 transfer 3 aTokens to teh flash swap contract for testign purpose
//     const trasnferOperation = await tokenA.transfer(
//       flashSwapContractAddress,
//       parseUnits('3', 9),
//     );

//     const status = await trasnferOperation.waitSpeculativeExecution();

//     if (status === OperationStatus.SpeculativeSuccess) {
//       console.log('Transfer To flash swap contract successful');
//     } else {
//       console.log('Status:', status);
//       throw new Error('Failed to transfer');
//     }

//     // Confirm that the flash swap contract a balance before flash swap is 3
//     const aFlashBalanceBefore = await tokenA.balanceOf(
//       flashSwapContractAddress,
//     );

//     expect(aFlashBalanceBefore, 'aFlashBalanceBefore should be 3').toBe(
//       parseUnits('3', 9),
//     );

//     console.log('A Flash Balance: ', aFlashBalanceBefore);

//     const aAmount = parseMas('2');
//     const bAmount = 0n;

//     // Get user2 aToken balance before flash swap
//     const aTokenBalanceBefore = await tokenA.balanceOf(user2Provider.address);
//     const bTokenBalanceBefore = await tokenB.balanceOf(user2Provider.address);

//     console.log(
//       'User2 A Token balance before: ',
//       formatUnits(aTokenBalanceBefore, 9),
//     );

//     console.log(
//       'User2 B Token balance before: ',
//       formatUnits(bTokenBalanceBefore, 9),
//     );

//     // Now user2 calls flash swap contract to loan aTokens
//     await expect(
//       await initFlash(
//         flashSwapContract,
//         aAmount,
//         bAmount,
//         user2Provider.address,
//         new Args().addU256(0n).serialize(),
//       ),
//       'should throw that error : Wrong return value',
//     ).rejects.toThrow();
//   });
// });

// describe('Scenario 2: Testing Flash for Reentrancy attack', async () => {
//   beforeAll(async () => {
//     // Deploying Registry Contract
//     registryContract = await deployRegistryContract(
//       user1Provider,
//       wmasAddress,
//       0.05,
//     );

//     regisrtyAddress = registryContract.address;

//     // create new pool
//     await createNewPool(
//       registryContract,
//       aTokenAddress,
//       bTokenAddress,
//       poolFeeRate,
//     );

//     const pools = await getPools(registryContract);

//     expect(pools.length > 0, 'No pools found');

//     // get the last pool address
//     poolAddress = pools[pools.length - 1].poolAddress;

//     poolContract = new SmartContract(user1Provider, poolAddress);

//     // Deploy flash exemple Contract and transfer amount to it
//     flashSwapContract = await deployFlashReentrancyContract(
//       user1Provider,
//       poolAddress,
//       regisrtyAddress,
//     );

//     flashSwapContractAddress = flashSwapContract.address;
//   });

//   test('User 1 adds liquidity to the pool unisng native coin', async () => {
//     const [reserveA, reserveB] = await getPoolReserves(poolContract);

//     // Reserves should be empty
//     expect(reserveA, 'Reserve A should be 0').toBe(0n);
//     expect(reserveB, 'Reserve B should be 0').toBe(0n);

//     const aAmount = 5;
//     const bAmount = 1;

//     // increase allowance of both tokerns amoutns first before adding liquidity
//     await increaseAllownace(aTokenAddress, poolAddress, aAmount, user1Provider);

//     // add liquidity using native coin
//     await addLiquidityWithMAS(poolContract, aAmount, bAmount, 0, 0);

//     const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

//     expect(reserveAAfter, 'Reserve A should equals to aAmount').toBe(
//       parseUnits(aAmount.toString(), 9),
//     );

//     expect(reserveBAfter, 'Reserve B should be equals to bAmount').toBe(
//       parseUnits(bAmount.toString(), 9),
//     );
//   });

//   // should throw an error when user 2 uses flash swap contract to loan aTokens WRONG_RETURN_VALUE
//   test('User2 uses flash swap contract to loan aTokens using ReentrancyFlash contract that will call the flash of poolContract again', async () => {
//     // switch to user 2
//     flashSwapContract = new SmartContract(
//       user2Provider,
//       flashSwapContractAddress,
//     );

//     poolContract = new SmartContract(user2Provider, poolAddress);

//     const [reserveA, reserveB] = await getPoolReserves(poolContract);

//     console.log('Reserve A: ', reserveA);
//     console.log('Reserve B: ', reserveB);

//     const tokenA = new MRC20(user1Provider, aTokenAddress);
//     const tokenB = new MRC20(user1Provider, bTokenAddress);

//     // user 1 transfer 3 aTokens to teh flash swap contract for testign purpose
//     const trasnferOperation = await tokenA.transfer(
//       flashSwapContractAddress,
//       parseUnits('3', 9),
//     );

//     const status = await trasnferOperation.waitSpeculativeExecution();

//     if (status === OperationStatus.SpeculativeSuccess) {
//       console.log('Transfer To flash swap contract successful');
//     } else {
//       console.log('Status:', status);
//       throw new Error('Failed to transfer');
//     }

//     // Confirm that the flash swap contract a balance before flash swap is 3
//     const aFlashBalanceBefore = await tokenA.balanceOf(
//       flashSwapContractAddress,
//     );

//     expect(aFlashBalanceBefore, 'aFlashBalanceBefore should be 3').toBe(
//       parseUnits('3', 9),
//     );

//     console.log('A Flash Balance: ', aFlashBalanceBefore);

//     const aAmount = parseMas('2');
//     const bAmount = 0n;

//     // Get user2 aToken balance before flash swap
//     const aTokenBalanceBefore = await tokenA.balanceOf(user2Provider.address);
//     const bTokenBalanceBefore = await tokenB.balanceOf(user2Provider.address);

//     console.log(
//       'User2 A Token balance before: ',
//       formatUnits(aTokenBalanceBefore, 9),
//     );

//     console.log(
//       'User2 B Token balance before: ',
//       formatUnits(bTokenBalanceBefore, 9),
//     );

//     // Now user2 calls flash swap contract to loan aTokens
//     await expect(
//       await initFlash(
//         flashSwapContract,
//         aAmount,
//         bAmount,
//         user2Provider.address,
//         new Args().addU256(0n).serialize(),
//       ),
//       'should throw that error : Wrong return value',
//     ).rejects.toThrow();
//   });

//   test('User2 uses flash swap contract to loan bTokens using ReentrancyFlash contract that will call the swap of poolContract', async () => {
//     const [reserveA, reserveB] = await getPoolReserves(poolContract);

//     console.log('Reserve A: ', reserveA);
//     console.log('Reserve B: ', reserveB);

//     const tokenA = new MRC20(user1Provider, aTokenAddress);
//     const tokenB = new MRC20(user1Provider, bTokenAddress);

//     // user 1 transfer 2 bTokens to the flash swap contract for testign purpose
//     const trasnferOperation = await tokenB.transfer(
//       flashSwapContractAddress,
//       parseUnits('2', 9),
//     );

//     const status = await trasnferOperation.waitSpeculativeExecution();

//     if (status === OperationStatus.SpeculativeSuccess) {
//       console.log('Transfer To flash swap contract successful');
//     } else {
//       console.log('Status:', status);
//       throw new Error('Failed to transfer');
//     }

//     // Confirm that the flash swap contract b balance before flash swap is 2
//     const bFlashBalanceBefore = await tokenB.balanceOf(
//       flashSwapContractAddress,
//     );

//     expect(bFlashBalanceBefore, 'bFlashBalanceBefore should be 2').toBe(
//       parseUnits('2', 9),
//     );

//     const user2BTokenBalanceBefore = await tokenB.balanceOf(
//       user2Provider.address,
//     );

//     console.log('User2 B Token balance before: ', user2BTokenBalanceBefore);

//     const flashSwapData = new Args().addU256(0n).serialize();

//     // user 2 calls the flash contract to loan bTokens
//     await expect(
//       await initFlash(
//         flashSwapContract,
//         0n,
//         parseUnits('1', 9),
//         user2Provider.address,
//         new Args().addU256(0n).serialize(),
//       ),
//     ).rejects.toThrow();
//   });
// });
