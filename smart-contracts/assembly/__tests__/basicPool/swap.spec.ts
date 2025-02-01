import {
  addAddressToLedger,
  changeCallStack,
  mockScCall,
  print,
  resetStorage,
  setDeployContext,
} from '@massalabs/massa-as-sdk';
import {
  addLiquidity,
  constructor,
  getLocalReserveA,
  getLocalReserveB,
  getLPBalance,
  swap,
} from '../../contracts/basicPool';
import { Args, bytesToU256 } from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';

// addres of contract in @massalabs/massa-as-sdk/vm-mock/vm.js
const contractAddr = 'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT';

// user 1 address
const user1Address = 'AU12Yd4kCcsizeeTEK9AZyBnuJNZ1cpp99XfCZgzS77ZKnwTFMpVE';
// user 2 address
const user2Address = 'AU1aC6g4NpkLQrhp6mVC1ugaDrAEdPGUyVk57xPmEZgF6bh6dTUf';
// user 3 address
const user3Address = 'AU12jojWJf8LRGpWUZoA5CjSVEGHzNnpck1ktbnvP9Ttw7i16avMF';

const aTokenAddress = 'AS12V58y942EBAexRzU3bGVb7Fxoduba4UxfLAQCbSeKNVamDCHfL';
const bTokenAddress = 'AS1mb6djKDu2LnhQtajuLPGX1J2PNYgCY2LoUxQxa69ABUgedJXN';
const registeryContractAddr =
  'AS1nifpyaSFvYtqZF9bzba8uJnt7SMFzsqTd3deCGodhLrP4FfCQ';

const TOKENS_DEFAULT_DECIMALS = 9;

beforeAll(() => {
  resetStorage();
  addAddressToLedger(aTokenAddress);
  addAddressToLedger(bTokenAddress);
  addAddressToLedger(registeryContractAddr);

  setDeployContext(user1Address);

  const args = new Args()
    .add(aTokenAddress) // token a address
    .add(bTokenAddress) // token b address
    .add(0.3 * 10000) // fee rate
    .add(0.05 * 10000) // fee share protocol
    .add(registeryContractAddr); // registery address

  mockScCall(new Args().add(user1Address).serialize());

  constructor(args.serialize());
});

function switchUser(user: string): void {
  changeCallStack(user + ' , ' + contractAddr);
}

describe('Scenario 1: Add liquidity, Swap', () => {
  test('add liquidity for first time', () => {
    // Initialize 100 tokens of A and B
    // In blockchain smart contracts, token amounts are typically represented in their smallest units (also called "base units").
    // To convert from human-readable token values (e.g., 100 tokens) to the base units that the smart contract expects,
    // we multiply the value by 10^TOKENS_DEFAULT_DECIMALS, where TOKENS_DEFAULT_DECIMALS represents the number of decimal places
    // the token supports. Commonly, TOKENS_DEFAULT_DECIMALS is 9 (e.g., for Massa Blockchain) or 18 (e.g., for most ERC-20 tokens).
    const aAmount = u256.fromU64(100 * 10 ** TOKENS_DEFAULT_DECIMALS); // 100 tokens of A in base units
    const bAmount = u256.fromU64(100 * 10 ** TOKENS_DEFAULT_DECIMALS); // 100 tokens of B in base units
    const minAAmount = u256.Zero; // 0
    const minBAmount = u256.Zero; // 0

    // get the LP balance of the user
    const lpBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    expect(lpBalance).toStrictEqual(u256.from(0));

    print(`Adding liquidity...`);

    mockScCall(new Args().serialize());
    mockScCall(new Args().serialize());

    addLiquidity(
      new Args()
        .add(aAmount)
        .add(bAmount)
        .add(minAAmount)
        .add(minBAmount)
        .serialize(),
    );

    const lpBalance2 = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    expect(lpBalance2).toStrictEqual(
      u256.fromU64(100 * 10 ** TOKENS_DEFAULT_DECIMALS),
    );
  });

  test('swap tokens', () => {
    mockScCall(new Args().serialize());

    switchUser(user2Address);

    let resA = bytesToU256(getLocalReserveA());
    let resB = bytesToU256(getLocalReserveB());

    print(`Reserve A: ${resA.toString()}`);
    print(`Reserve B: ${resB.toString()}`);

    expect(resA).toStrictEqual(
      u256.fromU64(100 * 10 ** TOKENS_DEFAULT_DECIMALS),
    );
    expect(resB).toStrictEqual(
      u256.fromU64(100 * 10 ** TOKENS_DEFAULT_DECIMALS),
    );

    mockScCall(new Args().serialize());
    mockScCall(new Args().serialize());

    swap(
      new Args()
        .add(aTokenAddress)
        .add(u256.fromU64(100 * 10 ** TOKENS_DEFAULT_DECIMALS))
        .add(u256.fromU64(1 * 10 ** TOKENS_DEFAULT_DECIMALS))
        .serialize(),
    );

    resA = bytesToU256(getLocalReserveA());
    resB = bytesToU256(getLocalReserveB());

    print(`Reserve A After Swap: ${resA.toString()}`);
    print(`Reserve B After Swap: ${resB.toString()}`);

    expect(resA).toStrictEqual(
      u256.fromF64(199.7 * 10 ** TOKENS_DEFAULT_DECIMALS),
    );

    // convert teh resA(9 decimals) to normal number
    const resANumber = u256.div(
      resA,
      u256.fromU64(10 ** TOKENS_DEFAULT_DECIMALS),
    );

    const resBNumber = u256.div(
      resB,
      u256.fromU64(10 ** TOKENS_DEFAULT_DECIMALS),
    );

    print(`Reserve A Number: ${resANumber.toString()}`);
    print(`Reserve B Number: ${resBNumber.toString()}`);
  });
});

describe('Scenario 2: Add liquidity, Swap with little amount', () => {
  beforeAll(() => {
    resetStorage();
    addAddressToLedger(aTokenAddress);
    addAddressToLedger(bTokenAddress);
    addAddressToLedger(registeryContractAddr);

    setDeployContext(user1Address);

    const args = new Args()
      .add(aTokenAddress) // token a address
      .add(bTokenAddress) // token b address
      .add(0.3 * 10000) // fee rate
      .add(0.05 * 10000) // fee share protocol
      .add(registeryContractAddr); // registery address

    mockScCall(new Args().add(user1Address).serialize());

    constructor(args.serialize());
  });
  test('add liquidity for first time', () => {
    // Initialize 100 tokens of A and B
    // In blockchain smart contracts, token amounts are typically represented in their smallest units (also called "base units").
    // To convert from human-readable token values (e.g., 100 tokens) to the base units that the smart contract expects,
    // we multiply the value by 10^TOKENS_DEFAULT_DECIMALS, where TOKENS_DEFAULT_DECIMALS represents the number of decimal places
    // the token supports. Commonly, TOKENS_DEFAULT_DECIMALS is 9 (e.g., for Massa Blockchain) or 18 (e.g., for most ERC-20 tokens).
    const aAmount = u256.fromU64(10 * 10 ** TOKENS_DEFAULT_DECIMALS); // 100 tokens of A in base units
    const bAmount = u256.fromU64(10 * 10 ** TOKENS_DEFAULT_DECIMALS); // 100 tokens of B in base units
    const minAAmount = u256.Zero; // 0
    const minBAmount = u256.Zero; // 0

    // get the LP balance of the user
    const lpBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    expect(lpBalance).toStrictEqual(u256.from(0));

    print(`Adding liquidity...`);

    mockScCall(new Args().serialize());
    mockScCall(new Args().serialize());

    addLiquidity(
      new Args()
        .add(aAmount)
        .add(bAmount)
        .add(minAAmount)
        .add(minBAmount)
        .serialize(),
    );

    const lpBalance2 = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    expect(lpBalance2).toStrictEqual(
      u256.fromU64(10 * 10 ** TOKENS_DEFAULT_DECIMALS),
    );
  });

  test('swap tokens', () => {
    mockScCall(new Args().serialize());

    switchUser(user2Address);

    let resA = bytesToU256(getLocalReserveA());
    let resB = bytesToU256(getLocalReserveB());

    print(`Reserve A: ${resA.toString()}`);
    print(`Reserve B: ${resB.toString()}`);

    expect(resA).toStrictEqual(
      u256.fromU64(10 * 10 ** TOKENS_DEFAULT_DECIMALS),
    );
    expect(resB).toStrictEqual(
      u256.fromU64(10 * 10 ** TOKENS_DEFAULT_DECIMALS),
    );

    mockScCall(new Args().serialize());
    mockScCall(new Args().serialize());

    swap(
      new Args()
        .add(aTokenAddress)
        .add(u256.fromU64(5 * 10 ** TOKENS_DEFAULT_DECIMALS))
        .add(u256.fromU64(1 * 10 ** TOKENS_DEFAULT_DECIMALS))
        .serialize(),
    );

    resA = bytesToU256(getLocalReserveA());
    resB = bytesToU256(getLocalReserveB());

    print(`Reserve A After Swap: ${resA.toString()}`);
    print(`Reserve B After Swap: ${resB.toString()}`);

    // expect(resA).toStrictEqual(
    //   u256.fromF64(199.7 * 10 ** TOKENS_DEFAULT_DECIMALS),
    // );

    // convert teh resA(9 decimals) to normal number
    const resANumber = u256.div(
      resA,
      u256.fromU64(10 ** TOKENS_DEFAULT_DECIMALS),
    );

    const resBNumber = u256.div(
      resB,
      u256.fromU64(10 ** TOKENS_DEFAULT_DECIMALS),
    );

    print(`Reserve A Number: ${resANumber.toString()}`);
    print(`Reserve B Number: ${resBNumber.toString()}`);
  });
});
