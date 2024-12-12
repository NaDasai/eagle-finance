import { Args } from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';
import { mrc20Constructor } from '../lib/MRC20';
import { generateEvent } from '@massalabs/massa-as-sdk';
export * from '../lib/MRC20';

export function constructor(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const tokenName = args.nextString().expect('Invalid token name');
  const tokenSymbol = args.nextString().expect('Invalid token symbol');
  const decimals = args.nextU8().expect('Invalid decimals');
  const totalSupply = args.nextU256().expect('Invalid total supply');

  mrc20Constructor(tokenName, tokenSymbol, decimals, u256.from(totalSupply));

  generateEvent(`Token ${tokenName} deployed.`);
}
