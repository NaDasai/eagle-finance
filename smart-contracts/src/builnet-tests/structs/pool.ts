import { Args, DeserializedResult, Serializable } from '@massalabs/massa-web3';

export class Pool implements Serializable<Pool> {
  constructor(
    public poolAddress: string = '',
    public aTokenddress: string = '',
    public bTokenAddress: string = '',
    public inputFeeRate: number = 0,
    public feeShareProtocol: number = 0,
    public lpTokenAddress: string = '',
  ) {}

  serialize(): Uint8Array {
    const args = new Args()
      .addString(this.poolAddress)
      .addString(this.aTokenddress)
      .addString(this.bTokenAddress)
      .addF64(this.inputFeeRate)
      .addF64(this.feeShareProtocol)
      .addString(this.lpTokenAddress)
      .serialize();

    return new Uint8Array(args);
  }

  deserialize(data: Uint8Array, offset: number): DeserializedResult<Pool> {
    const args = new Args(data, offset);

    this.poolAddress = args.nextString();
    this.aTokenddress = args.nextString();
    this.bTokenAddress = args.nextString();
    this.inputFeeRate = args.nextF64();
    this.feeShareProtocol = args.nextF64();
    this.lpTokenAddress = args.nextString();

    return { instance: this, offset: args.getOffset() };
  }
}
