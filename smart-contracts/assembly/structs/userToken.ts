import { Args, Result, Serializable } from '@massalabs/as-types';
import { Address } from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';

export class UserToken implements Serializable {
  constructor(
    public userAddress: Address = new Address(),
    public tokenAddress: Address = new Address(),
    public balance: u256 = u256.Zero,
  ) {}

  serialize(): StaticArray<u8> {
    return new Args()
      .add(this.userAddress)
      .add(this.tokenAddress)
      .add(this.balance)
      .serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);

    this.userAddress = new Address(args.nextString().expect('Invalid address'));
    this.tokenAddress = new Address(
      args.nextString().expect('Invalid address'),
    );
    this.balance = args.nextU256().expect('Invalid balance');

    return new Result(args.offset);
  }
}
