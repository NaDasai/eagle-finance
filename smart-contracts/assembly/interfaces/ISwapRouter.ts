import {
  Args,
  bytesToU64,
  bytesToString,
  byteToBool,
  u256ToBytes,
} from '@massalabs/as-types';
import { Address, call } from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';
import { SwapPath } from '../structs/swapPath';

export class ISwapRouter {
  _origin: Address;

  constructor(origin: Address) {
    this._origin = origin;
  }

  swap(swapPathArray: SwapPath[], coinsOnEachSwap: u64, coins: u64 = 0): void {
    const args = new Args()
      .addSerializableObjectArray(swapPathArray)
      .add(coinsOnEachSwap);

    call(this._origin, 'swap', args, coins);
  }
}
