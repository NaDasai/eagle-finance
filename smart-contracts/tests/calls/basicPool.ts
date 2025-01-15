import {
  Args,
  formatMas,
  Mas,
  MRC20,
  OperationStatus,
  parseUnits,
  Provider,
  SmartContract,
} from '@massalabs/massa-web3';
import { TOKEN_DEFAULT_DECIMALS } from '../utils';

export async function addLiquidity(
  poolContract: SmartContract,
  aAmount: number,
  bAmount: number,
  minAmountA: number,
  minAmountB: number,
) {
  console.log(
    `Add liquidity: ${aAmount} A, ${bAmount} B (min: ${minAmountA} A, ${minAmountB} B) to pool...`,
  );
  const operation = await poolContract.call(
    'addLiquidity',
    new Args()
      .addU256(parseUnits(aAmount.toString(), TOKEN_DEFAULT_DECIMALS))
      .addU256(parseUnits(bAmount.toString(), TOKEN_DEFAULT_DECIMALS))
      .addU256(parseUnits(minAmountA.toString(), TOKEN_DEFAULT_DECIMALS))
      .addU256(parseUnits(minAmountB.toString(), TOKEN_DEFAULT_DECIMALS))
      .serialize(),
    { coins: Mas.fromString('0.1') },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Liquidity added');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to add liquidity');
  }
}

export async function swap(
  poolContract: SmartContract,
  tokenInAddress: string,
  amountIn: number,
  minAmountOut: number,
) {
  console.log(`Swap ${amountIn} ${tokenInAddress} to pool...`);
  const operation = await poolContract.call(
    'swap',
    new Args()
      .addString(tokenInAddress)
      .addU256(parseUnits(amountIn.toString(), TOKEN_DEFAULT_DECIMALS))
      .addU256(parseUnits(minAmountOut.toString(), TOKEN_DEFAULT_DECIMALS))
      .serialize(),
    { coins: Mas.fromString('0.1') },
  );

  const operationStatus = await operation.waitSpeculativeExecution();

  if (operationStatus === OperationStatus.SpeculativeSuccess) {
    console.log('Swap successful');
  } else {
    console.log('Status:', operationStatus);
    throw new Error('Failed to swap');
  }
}

export async function removeLiquidity(
  poolContract: SmartContract,
  lpAmount: number,
  minAmountA: number,
  minAmountB: number,
) {
  console.log(
    `Remove liquidity: ${lpAmount} LP (min: ${minAmountA} A, ${minAmountB} B) from pool...`,
  );

  const operation = await poolContract.call(
    'removeLiquidity',
    new Args()
      .addU256(parseUnits(lpAmount.toString(), TOKEN_DEFAULT_DECIMALS))
      .addU256(parseUnits(minAmountA.toString(), TOKEN_DEFAULT_DECIMALS))
      .addU256(parseUnits(minAmountB.toString(), TOKEN_DEFAULT_DECIMALS))
      .serialize(),
    { coins: Mas.fromString('0.1') },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Liquidity removed');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to remove liquidity');
  }
}

export async function getTokenBalance(
  tokenAddress: string,
  userAddress: string,
  provider: Provider,
): Promise<number> {
  const tokenContract = new MRC20(provider, tokenAddress);

  const balance = new Args(
    (
      await tokenContract.read(
        'balanceOf',
        new Args().addString(userAddress).serialize(),
      )
    ).value,
  ).nextU256();

  return Number(formatMas(balance));
}

export async function getLPBalance(
  poolContract: SmartContract,
  userAddress: string,
): Promise<number> {
  const lpBalance = new Args(
    (
      await poolContract.read(
        'getLPBalance',
        new Args().addString(userAddress).serialize(),
      )
    ).value,
  ).nextU256();

  return Number(formatMas(lpBalance));
}

export async function increaseAllownace(
  tokenAddress: string,
  spenderAddress: string,
  amount: number,
  provider: Provider,
): Promise<void> {
  const tokenContract = new MRC20(provider, tokenAddress);

  console.log(`Increase allowance of ${amount} to token ${tokenAddress}...`);

  const operation = await tokenContract.increaseAllowance(
    spenderAddress,
    parseUnits(amount.toString(), TOKEN_DEFAULT_DECIMALS),
    { coins: Mas.fromString('0.1') },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Allowance increased Successfully');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to increase allowance');
  }
}

export async function getPoolReserves(
  poolContract: SmartContract,
): Promise<[number, number]> {
  const reserveA = new Args(
    (await poolContract.read('getLocalReserveA')).value,
  ).nextU256();
  const reserveB = new Args(
    (await poolContract.read('getLocalReserveB')).value,
  ).nextU256();

  return [Number(formatMas(reserveA)), Number(formatMas(reserveB))];
}
