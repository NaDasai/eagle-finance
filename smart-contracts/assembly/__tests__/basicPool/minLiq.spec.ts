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
  removeLiquidity,
  swap,
} from '../../contracts/basicPool';
import { Args, bytesToU256 } from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';
import { parseUnits } from '../utils';
import { SafeMath256 } from '../../lib/safeMath';

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

function switchUser(user: string): void {
  changeCallStack(user + ' , ' + contractAddr);
}

export function initializeNewPool(aDecimals: u32, bDecimals: u32): void {
  resetStorage();
  addAddressToLedger(aTokenAddress);
  addAddressToLedger(bTokenAddress);
  addAddressToLedger(registeryContractAddr);

  setDeployContext(user1Address);

  const args = new Args()
    .add(aTokenAddress) // token a address
    .add(bTokenAddress) // token b address
    .add(u64(0.3 * 10000)) // fee rate
    .add(u64(25 * 10000)) // fee share protocol
    .add(u64(0.05 * 10000)) // flash loan fee
    .add(registeryContractAddr); // registery address

  //   mockScCall(new Args().add(user1Address).serialize());

  mockScCall(new Args().add(aDecimals).serialize());
  mockScCall(new Args().add(bDecimals).serialize());

  constructor(args.serialize());
}

beforeEach(() => {
  print(
    `--------------------------------------------------------------------------------------------------------`,
  );
});

describe('Min Liquidity dec 18 -6 ', () => {
  const aDecimals = 18;
  const bDecimals = 6;

  beforeEach(() => {
    initializeNewPool(aDecimals, bDecimals);
  });

  test('Amounts 10 - 10', () => {
    const aAmount = parseUnits(10, aDecimals);
    const bAmount = parseUnits(10, bDecimals);
    print('aAmount: ' + aAmount.toString());
    print('bAmount: ' + bAmount.toString());
    print('aDecimals: ' + aDecimals.toString());
    print('bDecimals: ' + bDecimals.toString());

    const addLiqArgs = new Args()
      .add(aAmount)
      .add(bAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    addLiquidity(addLiqArgs);

    const user1LPBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalance: ' + user1LPBalance.toString());

    const lpAmount = user1LPBalance;

    const removeLiqArgs = new Args()
      .add(lpAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    removeLiquidity(removeLiqArgs);

    const user1LPBalanceAfter = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalanceAfter: ' + user1LPBalanceAfter.toString());
  });

  test('Amounts 8 - 4', () => {
    const aAmount = parseUnits(8, aDecimals);
    const bAmount = parseUnits(4, bDecimals);
    print('aAmount: ' + aAmount.toString());
    print('bAmount: ' + bAmount.toString());
    print('aDecimals: ' + aDecimals.toString());
    print('bDecimals: ' + bDecimals.toString());

    const addLiqArgs = new Args()
      .add(aAmount)
      .add(bAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    addLiquidity(addLiqArgs);

    const user1LPBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalance: ' + user1LPBalance.toString());

    const lpAmount = user1LPBalance;

    const removeLiqArgs = new Args()
      .add(lpAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    removeLiquidity(removeLiqArgs);

    const user1LPBalanceAfter = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalanceAfter: ' + user1LPBalanceAfter.toString());
  });

  test('Amounts 4 - 8', () => {
    const aAmount = parseUnits(4, aDecimals);
    const bAmount = parseUnits(8, bDecimals);
    print('aAmount: ' + aAmount.toString());
    print('bAmount: ' + bAmount.toString());
    print('aDecimals: ' + aDecimals.toString());
    print('bDecimals: ' + bDecimals.toString());

    const addLiqArgs = new Args()
      .add(aAmount)
      .add(bAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    addLiquidity(addLiqArgs);

    const user1LPBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalance: ' + user1LPBalance.toString());

    const lpAmount = user1LPBalance;

    const removeLiqArgs = new Args()
      .add(lpAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    removeLiquidity(removeLiqArgs);

    const user1LPBalanceAfter = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalanceAfter: ' + user1LPBalanceAfter.toString());
  });
});

describe('Min Liquidity dec 18 - 18 ', () => {
  const aDecimals = 18;
  const bDecimals = 18;

  beforeEach(() => {
    print(
      '*******************************************************************************',
    );
    initializeNewPool(aDecimals, bDecimals);
  });

  test('Amounts 10 - 10', () => {
    const aAmount = parseUnits(10, aDecimals);
    const bAmount = parseUnits(10, bDecimals);
    print('aAmount: ' + aAmount.toString());
    print('bAmount: ' + bAmount.toString());
    print('aDecimals: ' + aDecimals.toString());
    print('bDecimals: ' + bDecimals.toString());

    const addLiqArgs = new Args()
      .add(aAmount)
      .add(bAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    addLiquidity(addLiqArgs);

    const user1LPBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalance: ' + user1LPBalance.toString());

    const lpAmount = user1LPBalance;

    const removeLiqArgs = new Args()
      .add(lpAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    removeLiquidity(removeLiqArgs);

    const user1LPBalanceAfter = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalanceAfter: ' + user1LPBalanceAfter.toString());
  });

  test('Amounts 8 - 4', () => {
    const aAmount = parseUnits(8, aDecimals);
    const bAmount = parseUnits(4, bDecimals);
    print('aAmount: ' + aAmount.toString());
    print('bAmount: ' + bAmount.toString());
    print('aDecimals: ' + aDecimals.toString());
    print('bDecimals: ' + bDecimals.toString());

    const addLiqArgs = new Args()
      .add(aAmount)
      .add(bAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    addLiquidity(addLiqArgs);

    const user1LPBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalance: ' + user1LPBalance.toString());

    const lpAmount = user1LPBalance;

    const removeLiqArgs = new Args()
      .add(lpAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    removeLiquidity(removeLiqArgs);

    const user1LPBalanceAfter = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalanceAfter: ' + user1LPBalanceAfter.toString());
  });

  test('Amounts 4 - 8', () => {
    const aAmount = parseUnits(4, aDecimals);
    const bAmount = parseUnits(8, bDecimals);
    print('aAmount: ' + aAmount.toString());
    print('bAmount: ' + bAmount.toString());
    print('aDecimals: ' + aDecimals.toString());
    print('bDecimals: ' + bDecimals.toString());

    const addLiqArgs = new Args()
      .add(aAmount)
      .add(bAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    addLiquidity(addLiqArgs);

    const user1LPBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalance: ' + user1LPBalance.toString());

    const lpAmount = user1LPBalance;

    const removeLiqArgs = new Args()
      .add(lpAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    removeLiquidity(removeLiqArgs);

    const user1LPBalanceAfter = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalanceAfter: ' + user1LPBalanceAfter.toString());
  });
});

describe('Min Liquidity dec 18 - 9 ', () => {
  const aDecimals = 18;
  const bDecimals = 9;

  beforeEach(() => {
    print(
      '*******************************************************************************',
    );
    initializeNewPool(aDecimals, bDecimals);
  });

  // test('Amounts 10 - 10', () => {
  //   const aAmount = parseUnits(10, aDecimals);
  //   const bAmount = parseUnits(10, bDecimals);
  //   print('aAmount: ' + aAmount.toString());
  //   print('bAmount: ' + bAmount.toString());
  //   print('aDecimals: ' + aDecimals.toString());
  //   print('bDecimals: ' + bDecimals.toString());

  //   const addLiqArgs = new Args()
  //     .add(aAmount)
  //     .add(bAmount)
  //     .add(u256.Zero)
  //     .add(u256.Zero)
  //     .serialize();

  //   addLiquidity(addLiqArgs);

  //   const user1LPBalance = bytesToU256(
  //     getLPBalance(new Args().add(user1Address).serialize()),
  //   );

  //   print('user1LPBalance: ' + user1LPBalance.toString());

  //   const lpAmount = user1LPBalance;

  //   const removeLiqArgs = new Args()
  //     .add(lpAmount)
  //     .add(u256.Zero)
  //     .add(u256.Zero)
  //     .serialize();

  //   removeLiquidity(removeLiqArgs);

  //   const user1LPBalanceAfter = bytesToU256(
  //     getLPBalance(new Args().add(user1Address).serialize()),
  //   );

  //   print('user1LPBalanceAfter: ' + user1LPBalanceAfter.toString());
  // });

  // test('Amounts 8 - 4', () => {
  //   const aAmount = parseUnits(8, aDecimals);
  //   const bAmount = parseUnits(4, bDecimals);
  //   print('aAmount: ' + aAmount.toString());
  //   print('bAmount: ' + bAmount.toString());
  //   print('aDecimals: ' + aDecimals.toString());
  //   print('bDecimals: ' + bDecimals.toString());

  //   const addLiqArgs = new Args()
  //     .add(aAmount)
  //     .add(bAmount)
  //     .add(u256.Zero)
  //     .add(u256.Zero)
  //     .serialize();

  //   addLiquidity(addLiqArgs);

  //   const user1LPBalance = bytesToU256(
  //     getLPBalance(new Args().add(user1Address).serialize()),
  //   );

  //   print('user1LPBalance: ' + user1LPBalance.toString());

  //   const lpAmount = user1LPBalance;

  //   const removeLiqArgs = new Args()
  //     .add(lpAmount)
  //     .add(u256.Zero)
  //     .add(u256.Zero)
  //     .serialize();

  //   removeLiquidity(removeLiqArgs);

  //   const user1LPBalanceAfter = bytesToU256(
  //     getLPBalance(new Args().add(user1Address).serialize()),
  //   );

  //   print('user1LPBalanceAfter: ' + user1LPBalanceAfter.toString());
  // });

  test('Amounts 0.000000000000000001 - 0.000000001', () => {
    const aAmount = parseUnits(0.000000000000001, aDecimals);
    const bAmount = parseUnits(0.0000001, bDecimals);
    print('aAmount: ' + aAmount.toString());
    print('bAmount: ' + bAmount.toString());
    print('aDecimals: ' + aDecimals.toString());
    print('bDecimals: ' + bDecimals.toString());
    const addLiqArgs = new Args()
      .add(aAmount)
      .add(bAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();
    addLiquidity(addLiqArgs);
    const user1LPBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );
    print('user1LPBalance: ' + user1LPBalance.toString());
    const lpAmount = user1LPBalance;
    const removeLiqArgs = new Args()
      .add(lpAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();
    removeLiquidity(removeLiqArgs);
    const user1LPBalanceAfter = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );
    print('user1LPBalanceAfter: ' + user1LPBalanceAfter.toString());
  });

  // test('Amounts 4 - 4', () => {
  //   const aAmount = parseUnits(4, aDecimals);
  //   const bAmount = parseUnits(4, bDecimals);
  //   print('aAmount: ' + aAmount.toString());
  //   print('bAmount: ' + bAmount.toString());
  //   print('aDecimals: ' + aDecimals.toString());
  //   print('bDecimals: ' + bDecimals.toString());

  //   const addLiqArgs = new Args()
  //     .add(aAmount)
  //     .add(bAmount)
  //     .add(u256.Zero)
  //     .add(u256.Zero)
  //     .serialize();

  //   addLiquidity(addLiqArgs);

  //   const user1LPBalance = bytesToU256(
  //     getLPBalance(new Args().add(user1Address).serialize()),
  //   );

  //   print('user1LPBalance: ' + user1LPBalance.toString());

  //   const lpAmount = user1LPBalance;

  //   const removeLiqArgs = new Args()
  //     .add(lpAmount)
  //     .add(u256.Zero)
  //     .add(u256.Zero)
  //     .serialize();

  //   removeLiquidity(removeLiqArgs);

  //   const user1LPBalanceAfter = bytesToU256(
  //     getLPBalance(new Args().add(user1Address).serialize()),
  //   );
  // });

  // test('Amounts 4 - 8', () => {
  //   const aAmount = parseUnits(4, aDecimals);
  //   const bAmount = parseUnits(8, bDecimals);
  //   print('aAmount: ' + aAmount.toString());
  //   print('bAmount: ' + bAmount.toString());
  //   print('aDecimals: ' + aDecimals.toString());
  //   print('bDecimals: ' + bDecimals.toString());

  //   const addLiqArgs = new Args()
  //     .add(aAmount)
  //     .add(bAmount)
  //     .add(u256.Zero)
  //     .add(u256.Zero)
  //     .serialize();

  //   addLiquidity(addLiqArgs);

  //   const user1LPBalance = bytesToU256(
  //     getLPBalance(new Args().add(user1Address).serialize()),
  //   );

  //   print('user1LPBalance: ' + user1LPBalance.toString());

  //   const lpAmount = user1LPBalance;

  //   const removeLiqArgs = new Args()
  //     .add(lpAmount)
  //     .add(u256.Zero)
  //     .add(u256.Zero)
  //     .serialize();

  //   removeLiquidity(removeLiqArgs);

  //   const user1LPBalanceAfter = bytesToU256(
  //     getLPBalance(new Args().add(user1Address).serialize()),
  //   );

  //   print('user1LPBalanceAfter: ' + user1LPBalanceAfter.toString());
  // });
});

describe('Min Liquidity dec 9 - 9 ', () => {
  const aDecimals = 9;
  const bDecimals = 9;

  beforeEach(() => {
    print(
      '*******************************************************************************',
    );
    initializeNewPool(aDecimals, bDecimals);
  });

  test('Amounts 10 - 10', () => {
    const aAmount = parseUnits(10, aDecimals);
    const bAmount = parseUnits(10, bDecimals);
    print('aAmount: ' + aAmount.toString());
    print('bAmount: ' + bAmount.toString());
    print('aDecimals: ' + aDecimals.toString());
    print('bDecimals: ' + bDecimals.toString());

    const addLiqArgs = new Args()
      .add(aAmount)
      .add(bAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    addLiquidity(addLiqArgs);

    const user1LPBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalance: ' + user1LPBalance.toString());

    const lpAmount = user1LPBalance;

    const removeLiqArgs = new Args()
      .add(lpAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    removeLiquidity(removeLiqArgs);

    const user1LPBalanceAfter = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalanceAfter: ' + user1LPBalanceAfter.toString());
  });

  test('Amounts 8 - 4', () => {
    const aAmount = parseUnits(8, aDecimals);
    const bAmount = parseUnits(4, bDecimals);
    print('aAmount: ' + aAmount.toString());
    print('bAmount: ' + bAmount.toString());
    print('aDecimals: ' + aDecimals.toString());
    print('bDecimals: ' + bDecimals.toString());

    const addLiqArgs = new Args()
      .add(aAmount)
      .add(bAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    addLiquidity(addLiqArgs);

    const user1LPBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalance: ' + user1LPBalance.toString());

    const lpAmount = user1LPBalance;

    const removeLiqArgs = new Args()
      .add(lpAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    removeLiquidity(removeLiqArgs);

    const user1LPBalanceAfter = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalanceAfter: ' + user1LPBalanceAfter.toString());
  });

  test('Amounts 4 - 8', () => {
    const aAmount = parseUnits(4, aDecimals);
    const bAmount = parseUnits(8, bDecimals);
    print('aAmount: ' + aAmount.toString());
    print('bAmount: ' + bAmount.toString());
    print('aDecimals: ' + aDecimals.toString());
    print('bDecimals: ' + bDecimals.toString());

    const addLiqArgs = new Args()
      .add(aAmount)
      .add(bAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    addLiquidity(addLiqArgs);

    const user1LPBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalance: ' + user1LPBalance.toString());

    const lpAmount = user1LPBalance;

    const removeLiqArgs = new Args()
      .add(lpAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    removeLiquidity(removeLiqArgs);

    const user1LPBalanceAfter = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalanceAfter: ' + user1LPBalanceAfter.toString());
  });
});

describe('Min Liquidity dec 9 - 6 ', () => {
  const aDecimals = 9;
  const bDecimals = 6;

  beforeEach(() => {
    initializeNewPool(aDecimals, bDecimals);
  });

  test('Amounts 10 - 10', () => {
    const aAmount = parseUnits(10, aDecimals);
    const bAmount = parseUnits(10, bDecimals);
    print('aAmount: ' + aAmount.toString());
    print('bAmount: ' + bAmount.toString());
    print('aDecimals: ' + aDecimals.toString());
    print('bDecimals: ' + bDecimals.toString());

    const addLiqArgs = new Args()
      .add(aAmount)
      .add(bAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    addLiquidity(addLiqArgs);

    const user1LPBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalance: ' + user1LPBalance.toString());

    const lpAmount = user1LPBalance;

    const removeLiqArgs = new Args()
      .add(lpAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    removeLiquidity(removeLiqArgs);

    const user1LPBalanceAfter = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalanceAfter: ' + user1LPBalanceAfter.toString());
  });

  test('Amounts 8 - 4', () => {
    const aAmount = parseUnits(8, aDecimals);
    const bAmount = parseUnits(4, bDecimals);
    print('aAmount: ' + aAmount.toString());
    print('bAmount: ' + bAmount.toString());
    print('aDecimals: ' + aDecimals.toString());
    print('bDecimals: ' + bDecimals.toString());

    const addLiqArgs = new Args()
      .add(aAmount)
      .add(bAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    addLiquidity(addLiqArgs);

    const user1LPBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalance: ' + user1LPBalance.toString());

    const lpAmount = user1LPBalance;

    const removeLiqArgs = new Args()
      .add(lpAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    removeLiquidity(removeLiqArgs);

    const user1LPBalanceAfter = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );
  });

  test('Amounts 4 - 8', () => {
    const aAmount = parseUnits(4, aDecimals);
    const bAmount = parseUnits(8, bDecimals);
    print('aAmount: ' + aAmount.toString());
    print('bAmount: ' + bAmount.toString());
    print('aDecimals: ' + aDecimals.toString());
    print('bDecimals: ' + bDecimals.toString());

    const addLiqArgs = new Args()
      .add(aAmount)
      .add(bAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    addLiquidity(addLiqArgs);

    const user1LPBalance = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    print('user1LPBalance: ' + user1LPBalance.toString());

    const lpAmount = user1LPBalance;

    const removeLiqArgs = new Args()
      .add(lpAmount)
      .add(u256.Zero)
      .add(u256.Zero)
      .serialize();

    removeLiquidity(removeLiqArgs);

    const user1LPBalanceAfter = bytesToU256(
      getLPBalance(new Args().add(user1Address).serialize()),
    );
  });
});
