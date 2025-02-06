import { Args, DeserializedResult, Serializable } from '@massalabs/massa-web3';

export class Pool implements Serializable<Pool> {
  constructor(
    public poolAddress: string = '',
    public aTokenddress: string = '',
    public bTokenAddress: string = '',
    public inputFeeRate: number = 0,
  ) {}

  serialize(): Uint8Array {
    const args = new Args()
      .addString(this.poolAddress)
      .addString(this.aTokenddress)
      .addString(this.bTokenAddress)
      .addU64(BigInt(this.inputFeeRate))
      .serialize();

    return new Uint8Array(args);
  }

  deserialize(data: Uint8Array, offset: number): DeserializedResult<Pool> {
    const args = new Args(data, offset);

    this.poolAddress = args.nextString();
    this.aTokenddress = args.nextString();
    this.bTokenAddress = args.nextString();
    this.inputFeeRate = Number(args.nextU64());

    return { instance: this, offset: args.getOffset() };
  }
}
