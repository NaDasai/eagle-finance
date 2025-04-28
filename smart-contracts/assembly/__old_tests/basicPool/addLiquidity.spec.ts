// import {
//   addAddressToLedger,
//   changeCallStack,
//   mockScCall,
//   print,
//   resetStorage,
//   setDeployContext,
// } from '@massalabs/massa-as-sdk';
// import {
//   addLiquidity,
//   constructor,
//   getLocalReserveA,
//   getLocalReserveB,
//   getLPBalance,
//   removeLiquidity,
//   swap,
// } from '../../contracts/basicPool';
// import { Args, bytesToU256 } from '@massalabs/as-types';
// import { u256 } from 'as-bignum/assembly';
// import { parseMas } from '../utils';
// import { SafeMath256 } from '../../lib/safeMath';

// // addres of contract in @massalabs/massa-as-sdk/vm-mock/vm.js
// const contractAddr = 'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT';

// // user 1 address
// const user1Address = 'AU12Yd4kCcsizeeTEK9AZyBnuJNZ1cpp99XfCZgzS77ZKnwTFMpVE';
// // user 2 address
// const user2Address = 'AU1aC6g4NpkLQrhp6mVC1ugaDrAEdPGUyVk57xPmEZgF6bh6dTUf';
// // user 3 address
// const user3Address = 'AU12jojWJf8LRGpWUZoA5CjSVEGHzNnpck1ktbnvP9Ttw7i16avMF';

// const aTokenAddress = 'AS12V58y942EBAexRzU3bGVb7Fxoduba4UxfLAQCbSeKNVamDCHfL';
// const bTokenAddress = 'AS1mb6djKDu2LnhQtajuLPGX1J2PNYgCY2LoUxQxa69ABUgedJXN';
// const registeryContractAddr =
//   'AS1nifpyaSFvYtqZF9bzba8uJnt7SMFzsqTd3deCGodhLrP4FfCQ';

// function switchUser(user: string): void {
//   changeCallStack(user + ' , ' + contractAddr);
// }

// function resetPoolContract(): void {
//   resetStorage();
//   addAddressToLedger(aTokenAddress);
//   addAddressToLedger(bTokenAddress);
//   addAddressToLedger(registeryContractAddr);

//   setDeployContext(user1Address);

//   const args = new Args()
//     .add(aTokenAddress) // token a address
//     .add(bTokenAddress) // token b address
//     .add(0.3 * 1000) // fee rate
//     .add(0.05 * 1000) // fee share protocol
//     .add(registeryContractAddr); // registery address

//   mockScCall(new Args().add(user1Address).serialize());

//   constructor(args.serialize());
// }

// beforeAll(() => resetPoolContract());

// describe('User 3 and User 2 add, remove and swap liquidity.', () => {
//   test('User 2 adds liquidity while both Reserves are 0', () => {
//     switchUser(user2Address);

//     // Both Reserves should be 0 before adding liquidity
//     expect(bytesToU256(getLocalReserveA())).toStrictEqual(u256.Zero);
//     expect(bytesToU256(getLocalReserveB())).toStrictEqual(u256.Zero);

//     const aAmount = parseMas(1);
//     const bAmount = parseMas(100);
//     const minAmountA = parseMas(0);
//     const minAmountB = parseMas(0);

//     print(`aAmount: ${aAmount.toString()}`);
//     print(`bAmount: ${bAmount.toString()}`);

//     const addLiquidityArgs = new Args()
//       .add(aAmount)
//       .add(bAmount)
//       .add(minAmountA)
//       .add(minAmountB)
//       .serialize();

//     // There is 2 transferFrom calls in addLiquidity which will be mocked
//     mockScCall(new Args().serialize());
//     mockScCall(new Args().serialize());

//     addLiquidity(addLiquidityArgs);

//     // Both Reserves should be equal to the amount added
//     const aRes = bytesToU256(getLocalReserveA());
//     const bRes = bytesToU256(getLocalReserveB());

//     expect(aRes).toStrictEqual(aAmount);
//     expect(bRes).toStrictEqual(bAmount);

//     // LP balance should be equal to sqrt(aAmount * bAmount)
//     const expectedLPBalance = parseMas(10);

//     expect(
//       bytesToU256(getLPBalance(new Args().add(user2Address).serialize())),
//     ).toStrictEqual(expectedLPBalance);
//   });

//   test('User 3 adds liquidity while both Reserves are not 0', () => {
//     switchUser(user3Address);

//     const aRes = bytesToU256(getLocalReserveA());
//     const bRes = bytesToU256(getLocalReserveB());

//     // expect pool reserve to be equals to 1 and 100 MAS
//     expect(aRes).toStrictEqual(parseMas(1));
//     expect(bRes).toStrictEqual(parseMas(100));

//     // update initial k
//     const initialK = SafeMath256.mul(aRes, bRes);

//     print(`initialK: ${initialK.toString()}`);

//     // expect k to equal 100 * 1
//     expect(initialK).toStrictEqual(SafeMath256.mul(parseMas(1), parseMas(100)));

//     const aAmount = parseMas(2);
//     const bAmount = parseMas(200);
//     const minAmountA = parseMas(0);
//     const minAmountB = parseMas(0);

//     print(`aAmount: ${aAmount.toString()}`);
//     print(`bAmount: ${bAmount.toString()}`);

//     const addLiquidityArgs = new Args()
//       .add(aAmount)
//       .add(bAmount)
//       .add(minAmountA)
//       .add(minAmountB)
//       .serialize();

//     // There is 2 transferFrom calls in addLiquidity which will be mocked
//     mockScCall(new Args().serialize());
//     mockScCall(new Args().serialize());

//     addLiquidity(addLiquidityArgs);

//     const aResAfter = bytesToU256(getLocalReserveA());
//     const bResAfter = bytesToU256(getLocalReserveB());

//     print(`aResAfter: ${aResAfter.toString()}`);
//     print(`bResAfter: ${bResAfter.toString()}`);

//     // Both Reserves should be equal to the amount added
//     expect(aResAfter).toStrictEqual(SafeMath256.add(aAmount, aRes));
//     expect(bResAfter).toStrictEqual(SafeMath256.add(bAmount, bRes));

//     // LP balance should be equal to 20
//     const expectedLPBalance = parseMas(20);

//     print(`expectedLPBalance: ${expectedLPBalance.toString()}`);

//     expect(
//       bytesToU256(getLPBalance(new Args().add(user3Address).serialize())),
//     ).toStrictEqual(expectedLPBalance);
//   });

//   test('User 2 remove half of its liquidity', () => {
//     switchUser(user2Address);

//     const aRes = bytesToU256(getLocalReserveA());
//     const bRes = bytesToU256(getLocalReserveB());

//     print(`aRes: ${aRes.toString()}`);
//     print(`bRes: ${bRes.toString()}`);

//     expect(aRes).toStrictEqual(parseMas(3));
//     expect(bRes).toStrictEqual(parseMas(300));

//     const lpBalanceBefore = bytesToU256(
//       getLPBalance(new Args().add(user2Address).serialize()),
//     );

//     print(`lpBalanceBefore: ${lpBalanceBefore.toString()}`);

//     const lpAmount = parseMas(5);

//     const minAAmountOut = parseMas(0);
//     const minBAmountOut = parseMas(0);

//     const removeLiquidityArgs = new Args()
//       .add(lpAmount)
//       .add(minAAmountOut)
//       .add(minBAmountOut)
//       .serialize();

//     // There is 2 transferFrom calls in removeLiquidity which will be mocked
//     mockScCall(new Args().serialize());
//     mockScCall(new Args().serialize());

//     removeLiquidity(removeLiquidityArgs);

//     const aResAfter = bytesToU256(getLocalReserveA());
//     const bResAfter = bytesToU256(getLocalReserveB());

//     print(`aResAfter: ${aResAfter.toString()}`);
//     print(`bResAfter: ${bResAfter.toString()}`);

//     expect(aResAfter).toStrictEqual(parseMas(2.5));
//     expect(bResAfter).toStrictEqual(parseMas(250));

//     const lpBalanceAfter = bytesToU256(
//       getLPBalance(new Args().add(user2Address).serialize()),
//     );

//     print(`lpBalanceAfter: ${lpBalanceAfter.toString()}`);

//     expect(lpBalanceAfter).toStrictEqual(
//       SafeMath256.sub(lpBalanceBefore, lpAmount),
//     );
//   });

//   test('User 2 swap 0.5 of token a for  token b', () => {
//     switchUser(user2Address);

//     const aResBefore = bytesToU256(getLocalReserveA());
//     const bResBefore = bytesToU256(getLocalReserveB());

//     print(`aResBefore: ${aResBefore.toString()}`);
//     print(`bResBefore: ${bResBefore.toString()}`);

//     // user 2 swaps 0.5 of token a for token b
//     const tokenInAddress = aTokenAddress;
//     const amountIn = parseMas(0.5);
//     const minAmountOut = parseMas(0.4);

//     const swapArgs = new Args()
//       .add(tokenInAddress)
//       .add(amountIn)
//       .add(minAmountOut)
//       .serialize();

//     // There is 2 transferFrom calls in swap which will be mocked
//     mockScCall(new Args().serialize());
//     mockScCall(new Args().serialize());

//     // user 2 swaps 0.5 of token a for token b
//     swap(swapArgs);

//     const aResAfter = bytesToU256(getLocalReserveA());
//     const bResAfter = bytesToU256(getLocalReserveB());

//     print(`aResAfter: ${aResAfter.toString()}`);
//     print(`bResAfter: ${bResAfter.toString()}`);
//   });

//   test('User 2 removes the rest of its liquidity', () => {
//     switchUser(user2Address);

//     const aResBefore = bytesToU256(getLocalReserveA());
//     const bResBefore = bytesToU256(getLocalReserveB());

//     print(`aResBefore: ${aResBefore.toString()}`);
//     print(`bResBefore: ${bResBefore.toString()}`);

//     const lpBalanceBefore = bytesToU256(
//       getLPBalance(new Args().add(user2Address).serialize()),
//     );

//     expect(lpBalanceBefore).toStrictEqual(parseMas(5));

//     const minAAmountOut = parseMas(0);
//     const minBAmountOut = parseMas(0);

//     // There is 2 transferFrom calls in removeLiquidity which will be mocked
//     mockScCall(new Args().serialize());
//     mockScCall(new Args().serialize());

//     const removeLiquidityArgs = new Args()
//       .add(lpBalanceBefore)
//       .add(minAAmountOut)
//       .add(minBAmountOut)
//       .serialize();

//     removeLiquidity(removeLiquidityArgs);

//     const aResAfter = bytesToU256(getLocalReserveA());
//     const bResAfter = bytesToU256(getLocalReserveB());

//     print(`aResAfter: ${aResAfter.toString()}`);
//     print(`bResAfter: ${bResAfter.toString()}`);

//     const lpBalanceAfter = bytesToU256(
//       getLPBalance(new Args().add(user2Address).serialize()),
//     );

//     expect(lpBalanceAfter).toStrictEqual(u256.Zero);
//   });
// });
