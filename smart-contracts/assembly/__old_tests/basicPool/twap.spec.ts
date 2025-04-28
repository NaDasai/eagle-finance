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
//   flashSwap,
//   getAPriceCumulativeLast,
//   getBPriceCumulativeLast,
//   getLocalReserveA,
//   getLocalReserveB,
//   getLPBalance,
//   swap,
// } from '../../contracts/basicPool';
// import { Args, bytesToU256 } from '@massalabs/as-types';
// import { u256 } from 'as-bignum/assembly';
// import { parseMas } from '../utils';

// // addres of contract in @massalabs/massa-as-sdk/vm-mock/vm.js
// const contractAddr = 'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT';

// // user 1 address
// const user1Address = 'AU12Yd4kCcsizeeTEK9AZyBnuJNZ1cpp99XfCZgzS77ZKnwTFMpVE';
// // user 2 address
// const user2Address = 'AU1aC6g4NpkLQrhp6mVC1ugaDrAEdPGUyVk57xPmEZgF6bh6dTUf';
// // user 3 address
// const user3Address = 'AU12jojWJf8LRGpWUZoA5CjSVEGHzNnpck1ktbnvP9Ttw7i16avMF';

// const aTokenAddress = 'AS12mGPKTyQYC5FwJG5wHQFwmtbzhQTvvoGLBVvSgLCGtUhpDeGSb';
// const bTokenAddress = 'AS126PjhhpC2aYhPcCh5DgJFQjEkPtts5fnqktu1hPJdcLdV5RXXs';
// const registeryContractAddr =
//   'AS1FUB799cR9KYhyjfJRowWnZCuXe2h4Eb8V71Cmn9tsAr6HHuUU';

// const TOKENS_DEFAULT_DECIMALS = 9;

// function switchUser(user: string): void {
//   changeCallStack(user + ' , ' + contractAddr);
// }

// beforeAll(() => {
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
// });

// describe('twap tests', () => {
//   test('Reserves should be 0', () => {
//     expect(bytesToU256(getLocalReserveA())).toBe(u256.Zero);
//     expect(bytesToU256(getLocalReserveB())).toBe(u256.Zero);
//   });

//   test('pricess accumulative should be 0', () => {
//     expect(bytesToU256(getAPriceCumulativeLast())).toBe(u256.Zero);
//     expect(bytesToU256(getBPriceCumulativeLast())).toBe(u256.Zero);
//   });

//   test('add lqiuidity', () => {
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
//       bytesToU256(getLPBalance(new Args().add(user1Address).serialize())),
//     ).toStrictEqual(expectedLPBalance);
//   });

//   test('Comulative prices should be 0 after adding liquidity', () => {
//     expect(bytesToU256(getAPriceCumulativeLast())).toBe(u256.Zero);
//     expect(bytesToU256(getBPriceCumulativeLast())).toBe(u256.Zero);
//   });

//   test('swap', () => {
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

//   test('Comulative prices should be > 0 after swap', () => {
//     print(
//       `aPriceCumulativeLast: ${bytesToU256(
//         getAPriceCumulativeLast(),
//       ).toString()}`,
//     );
//     print(
//       `bPriceCumulativeLast: ${bytesToU256(
//         getBPriceCumulativeLast(),
//       ).toString()}`,
//     );

//     expect(bytesToU256(getAPriceCumulativeLast())).toBeGreaterThan(u256.Zero);
//     expect(bytesToU256(getBPriceCumulativeLast())).toBeGreaterThan(u256.Zero);
//   });
// });
