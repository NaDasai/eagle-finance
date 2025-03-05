import { Args, DeserializedResult, Serializable } from '@massalabs/massa-web3';

export class SwapPath implements Serializable<SwapPath> {
  constructor(
    public poolAddress: string = '',
    public tokenInAddress: string = '',
    public tokenOutAddress: string = '',
    public amountIn: bigint = 0n,
    public minAmountOut: bigint = 0n,
  ) {}

  serialize(): Uint8Array {
    const args = new Args()
      .addString(this.poolAddress)
      .addString(this.tokenInAddress)
      .addString(this.tokenOutAddress)
      .addU256(this.amountIn)
      .addU256(this.minAmountOut)
      .serialize();

    return new Uint8Array(args);
  }

  deserialize(data: Uint8Array, offset: number): DeserializedResult<SwapPath> {
    const args = new Args(data, offset);

    this.poolAddress = args.nextString();
    this.tokenInAddress = args.nextString();
    this.tokenOutAddress = args.nextString();
    this.amountIn = args.nextU256();
    this.minAmountOut = args.nextU256();

    return { instance: this, offset: args.getOffset() };
  }
}
