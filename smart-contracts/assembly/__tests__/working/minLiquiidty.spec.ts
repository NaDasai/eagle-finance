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
import { parseMas } from '../utils';
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

function resetPoolContract(): void {
  resetStorage();
  addAddressToLedger(aTokenAddress);
  addAddressToLedger(bTokenAddress);
  addAddressToLedger(registeryContractAddr);

  setDeployContext(user1Address);

  const args = new Args()
    .add(aTokenAddress) // token a address
    .add(bTokenAddress) // token b address
    .add(u64(0.3 * 1000)) // fee rate
    .add(u64(25 * 1000)) // fee share protocol
    .add(u64(0.3 * 1000)) // flash loan fee
    .add(registeryContractAddr); // registery address

  mockScCall(new Args().add(900000).serialize());
  mockScCall(new Args().add(18).serialize());
  mockScCall(new Args().add(9).serialize());

  constructor(args.serialize());
}

beforeAll(() => resetPoolContract());
