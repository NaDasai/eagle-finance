import {
  Args,
  bytesToString,
  NoArg,
  Result,
  Serializable,
} from '@massalabs/as-types';
import { Address, call } from '@massalabs/massa-as-sdk';
import { MRC20Wrapper } from '@massalabs/sc-standards/assembly/contracts/MRC20/wrapper';
import { u256 } from 'as-bignum/assembly';

export class IMRC20 extends MRC20Wrapper implements Serializable {
  constructor(origin: Address = new Address()) {
    super(origin);
  }

  /**
   * Initializes the smart contract.
   *
   * @param name - Name of the token.
   * @param symbol - Symbol of the token.
   * @param decimals - Number of decimals of the token.
   * @param supply - Initial supply of the token.
   * @param url - URL of the token.
   * @param description - Description of the token.
   * @param coins - Number of coins to send to the smart contract.
   */
  initExtended(
    name: string,
    symbol: string,
    decimals: u8,
    supply: u256,
    url: string,
    description: string,
    coins: u64 = 0,
  ): void {
    const args = new Args()
      .add(name)
      .add(symbol)
      .add(decimals)
      .add(supply)
      .add(url)
      .add(description);

    call(this._origin, 'constructor', args, coins);
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
