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
import { parseMas } from '../utils';

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

beforeAll(() => {
  resetStorage();
  addAddressToLedger(aTokenAddress);
  addAddressToLedger(bTokenAddress);
  addAddressToLedger(registeryContractAddr);

  setDeployContext(user1Address);

  const args = new Args()
    .add(aTokenAddress) // token a address
    .add(bTokenAddress) // token b address
    .add(0.3 * 1000) // fee rate
    .add(0.05 * 1000) // fee share protocol
    .add(registeryContractAddr); // registery address

  mockScCall(new Args().add(user1Address).serialize());

  constructor(args.serialize());
});

test('Test Case 1: Adding Liquidity while both Reserves are 0', () => {
  switchUser(user2Address);

  // Both Reserves should be 0 before adding liquidity
  expect(bytesToU256(getLocalReserveA())).toStrictEqual(u256.Zero);
  expect(bytesToU256(getLocalReserveB())).toStrictEqual(u256.Zero);

  const aAmount = parseMas(1);
  const bAmount = parseMas(100);
  const minAmountA = parseMas(0);
  const minAmountB = parseMas(0);

  print(`aAmount: ${aAmount.toString()}`);
  print(`bAmount: ${bAmount.toString()}`);

  const addLiquidityArgs = new Args()
    .add(aAmount)
    .add(bAmount)
    .add(minAmountA)
    .add(minAmountB)
    .serialize();

  // There is 2 transferFrom calls in addLiquidity which will be mocked
  mockScCall(new Args().serialize());
  mockScCall(new Args().serialize());

  addLiquidity(addLiquidityArgs);

  // Both Reserves should be equal to the amount added
  expect(bytesToU256(getLocalReserveA())).toStrictEqual(aAmount);
  expect(bytesToU256(getLocalReserveB())).toStrictEqual(bAmount);

  // LP balance should be equal to sqrt(aAmount * bAmount)
  const expectedLPBalance = parseMas(10);

  expect(
    bytesToU256(getLPBalance(new Args().add(user2Address).serialize())),
  ).toStrictEqual(expectedLPBalance);
});
