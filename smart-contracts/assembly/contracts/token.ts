import { Args, stringToBytes, u256ToBytes } from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';
import {
  Address,
  Context,
  generateEvent,
  isDeployingContract,
  Storage,
} from '@massalabs/massa-as-sdk';
import {
  _allowance,
  _approve,
  _balance,
  _setBalance,
} from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20-internals';
import { setOwner } from '@massalabs/sc-standards/assembly/contracts/utils/ownership';
import {
  NAME_KEY,
  DECIMALS_KEY,
  SYMBOL_KEY,
  TOTAL_SUPPLY_KEY,
} from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20';

export const TOKEN_URL = stringToBytes('TOKEN_URL');
export const TOKEN_DESCRIPTION = stringToBytes('TOKEN_DESCRIPTION');

export function constructor(binaryArgs: StaticArray<u8>): void {
  assert(isDeployingContract());

  const args = new Args(binaryArgs);

  // Admin arg passed by the token deployer to specify the owner of the token
  const admin = args.nextString().expect('Invalid admin');
  const tokenName = args.nextString().expect('Invalid token name');
  const tokenSymbol = args.nextString().expect('Invalid token symbol');
  const decimals = args.nextU8().expect('Invalid decimals');
  const totalSupply = args.nextU256().expect('Invalid total supply');
  // optional parameter
  const url = args.nextString().unwrapOrDefault();
  // optional parameter
  const description = args.nextString().unwrapOrDefault();

  Storage.set(NAME_KEY, stringToBytes(tokenName));
  Storage.set(SYMBOL_KEY, stringToBytes(tokenSymbol));
  Storage.set(DECIMALS_KEY, [decimals]);
  Storage.set(TOTAL_SUPPLY_KEY, u256ToBytes(totalSupply));
  Storage.set(TOKEN_URL, stringToBytes(url));
  Storage.set(TOKEN_DESCRIPTION, stringToBytes(description));

  setOwner(new Args().add(admin).serialize());

  _setBalance(new Address(admin), totalSupply);

  generateEvent(`Token ${tokenName} deployed.`);
}

export function url(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(TOKEN_URL);
}

export function description(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(TOKEN_DESCRIPTION);
}

export {
  version,
  name,
  symbol,
  decimals,
  totalSupply,
  transfer,
  transferFrom,
  balanceOf,
  allowance,
  increaseAllowance,
  decreaseAllowance,
} from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20';

export { mint } from '@massalabs/sc-standards/assembly/contracts/MRC20/mintable';
export {
  burn,
  burnFrom,
} from '@massalabs/sc-standards/assembly/contracts/MRC20/burnable';
export { setOwner, onlyOwner, isOwner } from '../utils/ownership';
