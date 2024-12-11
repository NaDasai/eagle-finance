import { Args, Result, Serializable } from '@massalabs/as-types';
import { Address } from '@massalabs/massa-as-sdk';

export class Pool implements Serializable {
  constructor(
    public addressA: Address = new Address(),
    public addressB: Address = new Address(),
    public inputFeeRate: u16 = u16(0),
    public feeShareProtocol: u16 = u16(0),
    public lpManagerToken: Address = new Address(),
  ) {}

  serialize(): StaticArray<u8> {
    return new Args()
      .add(this.addressA)
      .add(this.addressB)
      .add(this.inputFeeRate)
      .add(this.feeShareProtocol)
      .add(this.lpManagerToken)
      .serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);

    this.addressA = new Address(args.nextString().expect('Invalid address'));
    this.addressB = new Address(args.nextString().expect('Invalid address'));
    this.inputFeeRate = args.nextU16().expect('Invalid input fee rate');
    this.feeShareProtocol = args.nextU16().expect('Invalid fee share protocol');
    this.lpManagerToken = new Address(
      args.nextString().expect('Invalid lpManagerToken'),
    );

    return new Result(args.offset);
  }
}
