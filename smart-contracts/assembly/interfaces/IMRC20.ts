import { Args, Result, Serializable } from '@massalabs/as-types';
import { Address, Context, call } from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';
import { MRC20Wrapper } from '@massalabs/sc-standards/assembly/contracts/MRC20/wrapper';

export class IMRC20 extends MRC20Wrapper implements Serializable {
  constructor(origin: Address = new Address()) {
    super(origin);
  }

  serialize(): StaticArray<u8> {
    return this._origin.serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    return this._origin.deserialize(data, offset);
  }
}
