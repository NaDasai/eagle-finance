import { Args, Result, Serializable } from '@massalabs/as-types';
import { Address } from '@massalabs/massa-as-sdk';

export class Pool implements Serializable {
  constructor(
    public poolAddress: Address = new Address(),
    public aAddress: Address = new Address(),
    public bAddress: Address = new Address(),
    public inputFeeRate: f64 = f64(0),
    public feeShareProtocol: f64 = f64(0),
  ) {}

  serialize(): StaticArray<u8> {
    return new Args()
      .add(this.poolAddress)
      .add(this.aAddress)
      .add(this.bAddress)
      .add(this.inputFeeRate)
      .add(this.feeShareProtocol)
      .serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);

    this.poolAddress = new Address(args.nextString().expect('Invalid address'));
    this.aAddress = new Address(args.nextString().expect('Invalid address'));
    this.bAddress = new Address(args.nextString().expect('Invalid address'));
    this.inputFeeRate = args.nextF64().expect('Invalid input fee rate');
    this.feeShareProtocol = args.nextF64().expect('Invalid fee share protocol');

    return new Result(args.offset);
  }
}
