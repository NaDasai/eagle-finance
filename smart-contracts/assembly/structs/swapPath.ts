import { Args, Result, Serializable } from '@massalabs/as-types';
import { Address } from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';

export class SwapPath implements Serializable {
  constructor(
    public poolAddress: Address = new Address(),
    public tokenInAddress: Address = new Address(),
    public tokenOutAddress: Address = new Address(),
    public amountIn: u256 = u256.Zero,
    public minAmountOut: u256 = u256.Zero,
  ) {}

  serialize(): StaticArray<u8> {
    return new Args()
      .add(this.poolAddress)
      .add(this.tokenInAddress)
      .add(this.tokenOutAddress)
      .add(this.amountIn)
      .add(this.minAmountOut)
      .serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);

    this.poolAddress = new Address(args.nextString().expect('Invalid address'));
    this.tokenInAddress = new Address(
      args.nextString().expect('Invalid address'),
    );
    this.tokenOutAddress = new Address(
      args.nextString().expect('Invalid address'),
    );
    this.amountIn = args.nextU256().expect('Invalid amount in');
    this.minAmountOut = args.nextU256().expect('Invalid min amount out');

    return new Result(args.offset);
  }

  toString(): string {
    return (
      `Pool Address: ${this.poolAddress.toString()}\n` +
      `Token In Address: ${this.tokenInAddress.toString()}\n` +
      `Token Out Address: ${this.tokenOutAddress.toString()}\n` +
      `Amount In: ${this.amountIn.toString()}\n` +
      `Min Amount Out: ${this.minAmountOut.toString()}`
    );
  }
}
