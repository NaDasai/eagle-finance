// import {
//   Address,
//   changeCallStack,
//   print,
//   resetStorage,
//   setDeployContext,
// } from '@massalabs/massa-as-sdk';
// import { u256 } from 'as-bignum/assembly';
// import {
//   allowance,
//   balanceOf,
//   burn,
//   burnFrom,
//   decimals,
//   decreaseAllowance,
//   description,
//   increaseAllowance,
//   mint,
//   name,
//   pausable,
//   pause,
//   paused,
//   symbol,
//   constructor as TokenConstructor,
//   totalSupply,
//   transfer,
//   transferFrom,
//   unpause,
//   url,
//   VERSION,
//   version,
// } from '../../contracts/token';
// import {
//   Args,
//   boolToByte,
//   bytesToU256,
//   byteToBool,
//   stringToBytes,
//   u256ToBytes,
//   u8toByte,
// } from '@massalabs/as-types';

// // addres of contract in @massalabs/massa-as-sdk/vm-mock/vm.js
// const contractAddr = 'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT';

// // user 1 address
// const user1Address = 'AU12Yd4kCcsizeeTEK9AZyBnuJNZ1cpp99XfCZgzS77ZKnwTFMpVE';
// // user 2 address
// const user2Address = 'AU1aC6g4NpkLQrhp6mVC1ugaDrAEdPGUyVk57xPmEZgF6bh6dTUf';
// // user 3 address
// const user3Address = 'AU12jojWJf8LRGpWUZoA5CjSVEGHzNnpck1ktbnvP9Ttw7i16avMF';

// function switchUser(user: string): void {
//   changeCallStack(user + ' , ' + contractAddr);
// }

// const TOKEN_NAME = 'Buoya Token';
// const TOKEN_SYMBOL = 'BKN';
// const DECIMALS: u8 = 9;
// const TOTAL_SUPPLY = new u256(100, 100, 100, 100);
// const TOKEN_URL =
//   'https://img-cdn.pixlr.com/image-generator/history/65bb506dcb310754719cf81f/ede935de-1138-4f66-8ed7-44bd16efc709/medium.webp';

// const TOKEN_DESCRIPTION = 'feedsfnsfnfsnfs';

// beforeAll(() => {
//   resetStorage();
//   setDeployContext(user1Address);
//   TokenConstructor(
//     new Args()
//       .add(user1Address)
//       .add(TOKEN_NAME)
//       .add(TOKEN_SYMBOL)
//       .add(DECIMALS)
//       .add(TOTAL_SUPPLY)
//       .add(TOKEN_URL)
//       .add(TOKEN_DESCRIPTION)
//       .serialize(),
//   );
// });

// describe('Initialization', () => {
//   test('total supply is properly initialized', () => {
//     expect(totalSupply([])).toStrictEqual(u256ToBytes(TOTAL_SUPPLY));
//   });

//   test('token name is properly initialized', () =>
//     expect(name([])).toStrictEqual(stringToBytes(TOKEN_NAME)));

//   test('symbol is properly initialized', () =>
//     expect(symbol([])).toStrictEqual(stringToBytes(TOKEN_SYMBOL)));

//   test('decimals is properly initialized', () =>
//     expect(decimals([])).toStrictEqual(u8toByte(DECIMALS)));

//   test('version is properly initialized', () =>
//     expect(version([])).toStrictEqual(VERSION));

//   test('url is properly initialized', () =>
//     expect(url([])).toStrictEqual(stringToBytes(TOKEN_URL)));

//   test('description is properly initialized', () =>
//     expect(description([])).toStrictEqual(stringToBytes(TOKEN_DESCRIPTION)));
// });

// describe('BalanceOf', () => {
//   test('Check an empty balance', () =>
//     expect(balanceOf(new Args().add(contractAddr).serialize())).toStrictEqual(
//       u256ToBytes(u256.Zero),
//     ));

//   test('Check a non empty balance', () =>
//     expect(
//       bytesToU256(balanceOf(new Args().add(user1Address).serialize())),
//     ).toBe(TOTAL_SUPPLY));

//   test('Check balance of invalid address', () => {
//     const invalidAddress = new Address('A12AZDefef');
//     expect(
//       balanceOf(new Args().add(invalidAddress.toString()).serialize()),
//     ).toStrictEqual(u256ToBytes(u256.Zero));
//   });
// });

// describe('Transfer', () => {
//   test('Transfer from U1 => U2', () => {
//     const transferAmount = new u256(10, 10);

//     transfer(new Args().add(user2Address).add(transferAmount).serialize());

//     // Check user1 balance
//     expect(
//       balanceOf(new Args().add(user1Address).serialize()),
//       // @ts-ignore
//     ).toStrictEqual(u256ToBytes(TOTAL_SUPPLY - transferAmount));

//     // Check user2 balance
//     expect(balanceOf(new Args().add(user2Address).serialize())).toStrictEqual(
//       u256ToBytes(transferAmount),
//     );
//   });

//   throws('Insuficient balance to transfer from U1 => U2', () => {
//     // @ts-ignore
//     const invalidAmount = TOTAL_SUPPLY + u256.One;
//     transfer(new Args().add(user2Address).add(invalidAmount).serialize());
//   });

//   throws('Overflow', () =>
//     transfer(new Args().add(user2Address).add(u256.Max).serialize()),
//   );

//   throws('Self transfer', () =>
//     transfer(new Args().add(user1Address).serialize()),
//   );
// });

// let u1u2AllowAmount = new u256(20, 20);

// describe('Allowance', () => {
//   test('Increase user1 allowance for user2 to spend', () => {
//     increaseAllowance(
//       new Args().add(user2Address).add(u1u2AllowAmount).serialize(),
//     );

//     // check new allowance
//     expect(
//       allowance(new Args().add(user1Address).add(user2Address).serialize()),
//     ).toStrictEqual(u256ToBytes(u1u2AllowAmount));
//   });

//   test('Increase user1 allowance to max amount for user2 to spend', () => {
//     increaseAllowance(new Args().add(user2Address).add(u256.Max).serialize());

//     // check new allowance
//     expect(
//       allowance(new Args().add(user1Address).add(user2Address).serialize()),
//     ).toStrictEqual(u256ToBytes(u256.Max));
//   });

//   test('Decreases allowance U1 => U2', () => {
//     const decreaseAmount = u256.fromU64(666);
//     decreaseAllowance(
//       new Args().add(user2Address).add(decreaseAmount).serialize(),
//     );

//     // check new allowance
//     expect(
//       allowance(new Args().add(user1Address).add(user2Address).serialize()),
//       // @ts-ignore
//     ).toStrictEqual(u256ToBytes(u256.Max - decreaseAmount));
//   });

//   test('Decrease user1 allowance to 0 for user2', () =>
//     decreaseAllowance(new Args().add(user2Address).add(u256.Max).serialize()));

//   test('check allowance is set to 0', () =>
//     expect(
//       allowance(new Args().add(user1Address).add(user2Address).serialize()),
//     ).toStrictEqual(u256ToBytes(u256.Zero)));
// });

// let allowAmount = new u256(6000);

// describe('transferFrom', () => {
//   beforeAll(() => {
//     switchUser(user3Address);

//     // Increase allowance for U1 to spend U3 tokens
//     increaseAllowance(
//       new Args().add(user1Address).add(allowAmount).serialize(),
//     );

//     switchUser(user1Address);
//   });

//   throws('Fails because not enough allowance U3 => U1 ', () => {
//     transferFrom(
//       new Args()
//         .add(user3Address)
//         .add(user2Address)
//         // @ts-ignore
//         .add(allowAmount + u256.One)
//         .serialize(),
//     );
//   });

//   throws('Fails because not enough token on U3', () =>
//     transferFrom(
//       new Args()
//         .add(user3Address)
//         .add(user2Address)
//         .add(allowAmount)
//         .serialize(),
//     ),
//   );

//   test('u1  send tokens to u3 then transfer tokens from u3 to u2 ', () => {
//     const u1balanceBefore = balanceOf(new Args().add(user1Address).serialize());
//     const u2balanceBefore = balanceOf(new Args().add(user2Address).serialize());
//     const u3balanceBefore = balanceOf(new Args().add(user3Address).serialize());

//     transfer(new Args().add(user3Address).add(allowAmount).serialize());

//     transferFrom(
//       new Args()
//         .add(user3Address)
//         .add(user2Address)
//         .add(allowAmount)
//         .serialize(),
//     );

//     // Check balance changes
//     expect(balanceOf(new Args().add(user1Address).serialize())).toStrictEqual(
//       // @ts-ignore
//       u256ToBytes(bytesToU256(u1balanceBefore) - allowAmount),
//     );

//     expect(balanceOf(new Args().add(user2Address).serialize())).toStrictEqual(
//       // @ts-ignore

//       u256ToBytes(bytesToU256(u2balanceBefore) + allowAmount),
//     );
//     expect(balanceOf(new Args().add(user3Address).serialize())).toStrictEqual(
//       u3balanceBefore,
//     );

//     // Verify allowances after transferFrom
//     expect(
//       allowance(new Args().add(user1Address).add(user3Address).serialize()),
//     ).toStrictEqual(u256ToBytes(u256.Zero));
//   });
// });

// let pausableToken = true;
// let mintaableToken = true;
// let bururnableToken = true;

// describe('Pausable token', () => {
//   beforeAll(() => {
//     switchUser(user1Address);
//     resetStorage();
//     setDeployContext(user1Address);
//     TokenConstructor(
//       new Args()
//         .add(user1Address)
//         .add(TOKEN_NAME)
//         .add(TOKEN_SYMBOL)
//         .add(DECIMALS)
//         .add(TOTAL_SUPPLY)
//         .add(TOKEN_URL)
//         .add(TOKEN_DESCRIPTION)
//         .add(pausableToken)
//         .add(mintaableToken)
//         .add(bururnableToken)
//         .serialize(),
//     );
//   });

//   test('pausable should return true', () => {
//     expect(pausable([])).toStrictEqual(boolToByte(pausableToken));
//   });

//   test('paused should by default return false', () => {
//     expect(paused([])).toStrictEqual(boolToByte(false));
//   });

//   test('Paused should return true after pause', () => {
//     pause([]);

//     expect(paused([])).toStrictEqual(boolToByte(true));
//   });

//   throws('Should throw error when trying to transfer when paused', () => {
//     transfer(new Args().add(user2Address).add(u256.One).serialize());
//   });

//   throws('Should throw error when trying to transferFrom when paused', () => {
//     transferFrom(
//       new Args().add(user1Address).add(user2Address).add(u256.One).serialize(),
//     );
//   });

//   test('Paused should return false after unpause', () => {
//     unpause([]);

//     expect(paused([])).toStrictEqual(boolToByte(false));
//   });

//   test('Should be able to transfer after unpause', () => {
//     const u1balanceBefore = balanceOf(new Args().add(user1Address).serialize());

//     transfer(new Args().add(user2Address).add(u256.One).serialize());

//     expect(balanceOf(new Args().add(user1Address).serialize())).toStrictEqual(
//       // @ts-ignore
//       u256ToBytes(bytesToU256(u1balanceBefore) - u256.One),
//     );

//     expect(balanceOf(new Args().add(user2Address).serialize())).toStrictEqual(
//       // @ts-ignore
//       u256ToBytes(u256.One),
//     );
//   });

//   test('should not be able to mint when paused', () => {
//     pause([]);

//     expect(() =>
//       mint(new Args().add(user2Address).add(u256.One).serialize()),
//     ).toThrow('TOKEN_PAUSED');
//   });

//   test('should not be able to burn when paused', () => {
//     expect(() => burn(new Args().add(u256.One).serialize())).toThrow(
//       'TOKEN_PAUSED',
//     );
//   });

//   test('should not be able to burnFrom when paused', () => {
//     expect(() =>
//       burnFrom(new Args().add(user2Address).add(u256.One).serialize()),
//     ).toThrow('TOKEN_PAUSED');
//   });
// });

// const mintAmount = new u256(5000, 33);

// describe('Mint ERC20 to U2', () => {
//   beforeAll(() => {
//     switchUser(user1Address);
//     resetStorage();
//     setDeployContext(user1Address);
//     TokenConstructor(
//       new Args()
//         .add(user1Address)
//         .add(TOKEN_NAME)
//         .add(TOKEN_SYMBOL)
//         .add(DECIMALS)
//         .add(TOTAL_SUPPLY)
//         .add(TOKEN_URL)
//         .add(TOKEN_DESCRIPTION)
//         .add(pausableToken)
//         .add(mintaableToken)
//         .add(bururnableToken)
//         .serialize(),
//     );
//   });

//   test('Should mint ERC20', () => {
//     mint(new Args().add(user2Address).add(mintAmount).serialize());
//     // check balance of U2
//     expect(balanceOf(new Args().add(user2Address).serialize())).toStrictEqual(
//       u256ToBytes(mintAmount),
//     );

//     // check totalSupply update
//     expect(totalSupply([])).toStrictEqual(
//       // @ts-ignore
//       u256ToBytes(mintAmount + TOTAL_SUPPLY),
//     );
//   });
// });

// describe('Fails mint ERC20', () => {
//   beforeAll(() => {
//     switchUser(user1Address);
//     resetStorage();
//     setDeployContext(user1Address);
//     TokenConstructor(
//       new Args()
//         .add(user1Address)
//         .add(TOKEN_NAME)
//         .add(TOKEN_SYMBOL)
//         .add(DECIMALS)
//         .add(TOTAL_SUPPLY)
//         .add(TOKEN_URL)
//         .add(TOKEN_DESCRIPTION)
//         .add(pausableToken)
//         .add(mintaableToken)
//         .add(bururnableToken)
//         .serialize(),
//     );
//   });

//   throws('Should overflow ERC20', () =>
//     mint(new Args().add(user2Address).add(u256.Max).serialize()),
//   );

//   throws('Should fail because the owner is not the tx emitter', () => {
//     switchUser(user2Address);

//     mint(new Args().add(user1Address).add(u256.fromU64(5000)).serialize());
//   });

//   test("Should check totalSupply didn't change", () => {
//     expect(totalSupply([])).toStrictEqual(
//       // @ts-ignore
//       u256ToBytes(TOTAL_SUPPLY),
//     );
//   });
// });

// describe('Mintable MRC20 tests', () => {
//   beforeAll(() => {
//     resetStorage();
//     switchUser(user1Address);
//     setDeployContext(user1Address);
//     TokenConstructor(
//       new Args()
//         .add(user1Address)
//         .add(TOKEN_NAME)
//         .add(TOKEN_SYMBOL)
//         .add(DECIMALS)
//         .add(TOTAL_SUPPLY)
//         .add(TOKEN_URL)
//         .add(TOKEN_DESCRIPTION)
//         .add(pausableToken) // pausable
//         .add(false) // mintable
//         .add(bururnableToken) // bururnable
//         .serialize(),
//     );
//   });

//   test('Should fails to mint MRC20 when not mintable', () => {
//     expect(() =>
//       mint(new Args().add(user2Address).add(mintAmount).serialize()),
//     ).toThrow('TOKEN_NOT_MINTABLE');
//   });
// });

// const burnAmount = new u256(5000, 0, 1);

// describe('Burn ERC20 to U1', () => {
//   beforeAll(() => {
//     switchUser(user1Address);
//     resetStorage();
//     setDeployContext(user1Address);
//     TokenConstructor(
//       new Args()
//         .add(user1Address)
//         .add(TOKEN_NAME)
//         .add(TOKEN_SYMBOL)
//         .add(DECIMALS)
//         .add(TOTAL_SUPPLY)
//         .add(TOKEN_URL)
//         .add(TOKEN_DESCRIPTION)
//         .add(pausableToken)
//         .add(mintaableToken)
//         .add(bururnableToken)
//         .serialize(),
//     );
//   });

//   test('Should burn ERC20', () => {
//     burn(new Args().add(burnAmount).serialize());

//     // check balance of U1
//     expect(
//       bytesToU256(balanceOf(new Args().add(user1Address).serialize())),
//       // @ts-ignore
//     ).toBe(TOTAL_SUPPLY - burnAmount);

//     // check totalSupply update
//     expect(totalSupply([])).toStrictEqual(
//       // @ts-ignore
//       u256ToBytes(TOTAL_SUPPLY - burnAmount),
//     );
//   });
// });

// describe('Fails burn ERC20', () => {
//   throws('Fails to burn because of underflow ', () =>
//     burn(new Args().add(u256.Max).serialize()),
//   );
// });

// allowAmount = new u256(1, 1, 1, 1);

// describe('burnFrom', () => {
//   beforeAll(() => {
//     switchUser(user1Address);
//     resetStorage();
//     setDeployContext(user1Address);
//     TokenConstructor(
//       new Args()
//         .add(user1Address)
//         .add(TOKEN_NAME)
//         .add(TOKEN_SYMBOL)
//         .add(DECIMALS)
//         .add(TOTAL_SUPPLY)
//         .add(TOKEN_URL)
//         .add(TOKEN_DESCRIPTION)
//         .add(pausableToken)
//         .add(mintaableToken)
//         .add(bururnableToken)
//         .serialize(),
//     );

//     switchUser(user3Address);

//     // Increase allowance for U1 to spend U3 tokens
//     increaseAllowance(
//       new Args().add(user1Address).add(allowAmount).serialize(),
//     );
//     switchUser(user1Address);
//   });

//   throws('on insufficient allowance', () => {
//     burnFrom(
//       new Args()
//         .add(user3Address)
//         // @ts-ignore
//         .add(allowAmount + u256.One)
//         .serialize(),
//     );
//   });

//   throws('on insufficient balance', () =>
//     burnFrom(new Args().add(user3Address).add(allowAmount).serialize()),
//   );

//   test('should burn tokens from an other address', () => {
//     const u1balanceBefore = balanceOf(new Args().add(user1Address).serialize());
//     const u3balanceBefore = balanceOf(new Args().add(user3Address).serialize());

//     transfer(new Args().add(user3Address).add(allowAmount).serialize());

//     burnFrom(new Args().add(user3Address).add(allowAmount).serialize());

//     // Check balance changes
//     expect(balanceOf(new Args().add(user1Address).serialize())).toStrictEqual(
//       // @ts-ignore
//       u256ToBytes(bytesToU256(u1balanceBefore) - allowAmount),
//     );

//     expect(balanceOf(new Args().add(user3Address).serialize())).toStrictEqual(
//       u3balanceBefore,
//     );

//     // Verify allowances after transferFrom
//     expect(
//       allowance(new Args().add(user1Address).add(user3Address).serialize()),
//     ).toStrictEqual(u256ToBytes(u256.Zero));
//   });
// });

// describe('should not allow burn hen burnable is false', () => {
//   beforeAll(() => {
//     switchUser(user1Address);
//     resetStorage();
//     setDeployContext(user1Address);
//     TokenConstructor(
//       new Args()
//         .add(user1Address)
//         .add(TOKEN_NAME)
//         .add(TOKEN_SYMBOL)
//         .add(DECIMALS)
//         .add(TOTAL_SUPPLY)
//         .add(TOKEN_URL)
//         .add(TOKEN_DESCRIPTION)
//         .add(pausableToken)
//         .add(mintaableToken)
//         .add(false)
//         .serialize(),
//     );
//   });

//   throws('on burn', () => burn(new Args().add(burnAmount).serialize()));

//   throws('on burnFrom', () =>
//     burnFrom(new Args().add(user3Address).add(burnAmount).serialize()),
//   );
// });
