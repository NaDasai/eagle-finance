import { Address, Context } from '@massalabs/massa-as-sdk';
import { IMRC20 } from '../interfaces/IMRC20';
import { u256 } from 'as-bignum/assembly';

export function getTokenBalance(address: Address): u256 {
  const token = new IMRC20(address);
  return token.balanceOf(Context.callee());
}
