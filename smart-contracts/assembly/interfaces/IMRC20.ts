import {
  Args,
  bytesToString,
  NoArg,
  Result,
  Serializable,
} from '@massalabs/as-types';
import { Address, call } from '@massalabs/massa-as-sdk';
import { MRC20Wrapper } from '@massalabs/sc-standards/assembly/contracts/MRC20/wrapper';

export class IMRC20 extends MRC20Wrapper implements Serializable {
  constructor(origin: Address = new Address()) {
    super(origin);
  }

  url(): StaticArray<u8> {
    bytesToString(call(this._origin, 'url', NoArg, 0));
  }

  description(): StaticArray<u8> {
    bytesToString(call(this._origin, 'description', new Args(), 0));
  }

  serialize(): StaticArray<u8> {
    return this._origin.serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    return this._origin.deserialize(data, offset);
  }
}
