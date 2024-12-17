import { Args, stringToBytes } from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';
import { generateEvent, Storage } from '@massalabs/massa-as-sdk';
import { mrc20Constructor } from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20';
export * from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20';

export const TOKEN_URL = stringToBytes('TOKEN_URL');
const TOKEN_DESCRIPTION = stringToBytes('TOKEN_DESCRIPTION');

export function constructor(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const tokenName = args.nextString().expect('Invalid token name');
  const tokenSymbol = args.nextString().expect('Invalid token symbol');
  const decimals = args.nextU8().expect('Invalid decimals');
  const totalSupply = args.nextU256().expect('Invalid total supply');
  const url = args.nextString().expect('Invalid url');
  // optional parameter
  const description = args.nextString().unwrapOrDefault();

  Storage.set(TOKEN_URL, stringToBytes(url));
  Storage.set(TOKEN_DESCRIPTION, stringToBytes(description));

  mrc20Constructor(tokenName, tokenSymbol, decimals, u256.from(totalSupply));

  generateEvent(`Token ${tokenName} deployed.`);
}

export function url(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(TOKEN_URL);
}

export function description(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(TOKEN_DESCRIPTION);
}
