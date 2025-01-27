import {
  Address,
  Args,
  CallSCOptions,
  ReadSCOptions,
  SmartContract,
} from '@massalabs/massa-web3';

/**
 * @class EagleCall
 */
export class EagleCall extends SmartContract {
  async eagleCall(
    caller: Address,
    aAmount: bigint,
    bAmount: bigint,
    callData: Uint8Array,
    options?: CallSCOptions,
  ) {
    return this.call(
      'eagleCall',
      new Args()
        .addString(caller.toString())
        .addU256(aAmount)
        .addU256(bAmount)
        .addUint8Array(callData),
      options,
    );
  }
}
