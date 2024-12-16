import {
  addAddressToLedger,
  changeCallStack,
  mockScCall,
  print,
  resetStorage,
  setDeployContext,
} from '@massalabs/massa-as-sdk';
import { addLiquidity, constructor, getLPBalance } from '../contracts/pool';
import { Args, bytesToU64 } from '@massalabs/as-types';
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
  'AS125BAcgd4n6U7nEY9an6DnHFRBFgfyUq82bN9GpYQEbuiSVvt4x';

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
    .add(aTokenAddress)
    .add(bTokenAddress)
    .add(0.5)
    .add(0.05)
    .add(registeryContractAddr);

  mockScCall(new Args().add(user1Address).serialize());

  constructor(args.serialize());
});

describe('Scenario 1: Add liquidity, Swap, Remove liquidity', () => {
  test('Liquidity Added the first time', () => {
    const aAmount = u256.fromU64(100);
    const bAmount = u256.fromU64(100);

    // get the LP balance of the user
    const lpBalance = bytesToU64(
      getLPBalance(new Args().add(user1Address).serialize()),
    );

    expect(lpBalance).toStrictEqual(0);

    print(`Adding liquidity...`);

    mockScCall(new Args().serialize());
    mockScCall(new Args().serialize());

    addLiquidity(new Args().add(aAmount).add(bAmount).serialize());

    const lpBalance2 = bytesToU64(
      getLPBalance(new Args().add(user1Address).serialize()),
    );
    expect(lpBalance2).toStrictEqual(100);
  });
});
