import {
  Args,
  bytesToStr,
  byteToBool,
  Mas,
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

export async function mint(
  mrc20Contract: MRC20,
  to: string,
  amount: number,
  decimals: number = TOKEN_DEFAULT_DECIMALS,
) {
  const args = new Args()
    .addString(to)
    .addU256(parseUnits(amount.toString(), decimals));

  const op = await mrc20Contract.call('mint', args.serialize(), {
    coins: Mas.fromString('0.01'),
  });

  const status = await op.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Mint successful');
  } else {
    console.log('Mint failed');
    console.log('Error events: ', await op.getSpeculativeEvents());
    throw new Error('Failed to mint');
  }
}

export async function getPausableStatus(
  mrc20Contract: MRC20,
): Promise<boolean> {
  const rsult = await mrc20Contract.read('pausable');

  return byteToBool(rsult.value);
}

export async function getMintableStatus(
  mrc20Contract: MRC20,
): Promise<boolean> {
  const rsult = await mrc20Contract.read('mintable');

  return byteToBool(rsult.value);
}

export async function getBurnableStatus(
  mrc20Contract: MRC20,
): Promise<boolean> {
  const rsult = await mrc20Contract.read('burnable');

  return byteToBool(rsult.value);
}

export async function getPausedStatus(mrc20Contract: MRC20): Promise<boolean> {
  const rsult = await mrc20Contract.read('paused');

  return byteToBool(rsult.value);
}

export async function pauseToken(mrc20Contract: MRC20) {
  const op = await mrc20Contract.call('pause');

  const status = await op.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Token paused successfully');
  } else {
    console.log('Token pause failed');
    console.log('Error events: ', await op.getSpeculativeEvents());
    throw new Error('Token pause failed');
  }
}

export async function unpauseToken(mrc20Contract: MRC20) {
  const op = await mrc20Contract.call('unpause');

  const status = await op.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Token unpaused successfully');
  } else {
    console.log('Token unpause failed');
    console.log('Error events: ', await op.getSpeculativeEvents());
    throw new Error('Token unpause failed');
  }
}
