import {
  MRC20,
  OperationStatus,
  parseUnits,
  SmartContract,
} from '@massalabs/massa-web3';
import { TOKEN_DEFAULT_DECIMALS } from '../utils';

export async function mrc20TransferTo(
  mrc20Contract: MRC20,
  to: string,
  amount: number,
  decimals: number = TOKEN_DEFAULT_DECIMALS,
) {
  const op = await mrc20Contract.transfer(
    to,
    parseUnits(amount.toString(), decimals),
  );

  const status = await op.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Transfer successful');
  } else {
    console.log('Transfer failed');
    throw new Error('Failed to transfer');
  }
}
