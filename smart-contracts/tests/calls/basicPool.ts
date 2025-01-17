import {
  Address,
  Args,
  formatMas,
  Mas,
  MRC20,
  OperationStatus,
  parseUnits,
  Provider,
  SmartContract,
  U256,
  U64,
} from '@massalabs/massa-web3';
import { TOKEN_DEFAULT_DECIMALS } from '../utils';
import { Pool } from '../../src/builnet-tests/structs/pool';

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

export async function addLiquidityWithMAS(
  poolContract: SmartContract,
  aAmount: number,
  bAmount: number,
  minAmountA: number,
  minAmountB: number,
) {
  console.log(
    `Add liquidity with MAS: ${aAmount} A, ${bAmount} B (min: ${minAmountA} A, ${minAmountB} B) to pool...`,
  );

  const storageCosts = computeMintStorageCost(poolContract.address);

  const coins = Mas.fromString(bAmount.toString()) + BigInt(storageCosts);

  console.log('Coins To send: ', coins);

  const operation = await poolContract.call(
    'addLiquidityWithMas',
    new Args()
      .addU256(parseUnits(aAmount.toString(), TOKEN_DEFAULT_DECIMALS))
      .addU256(parseUnits(bAmount.toString(), TOKEN_DEFAULT_DECIMALS))
      .addU256(parseUnits(minAmountA.toString(), TOKEN_DEFAULT_DECIMALS))
      .addU256(parseUnits(minAmountB.toString(), TOKEN_DEFAULT_DECIMALS))
      .serialize(),
    { coins },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Liquidity added with MAS');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to add liquidity');
  }

  return coins;
}

export async function swapWithMAS(
  poolContract: SmartContract,
  tokenInAddress: string,
  amountIn: number,
  minAmountOut: number,
  NativeIn: boolean = true,
) {
  console.log(`Swap with MAS ${amountIn} MAS to pool...`);

  const storageCosts = computeMintStorageCost(poolContract.address);

  const coins = Mas.fromString(amountIn.toString()) + BigInt(storageCosts);

  const coinsToSend = NativeIn ? coins : Mas.fromString('0');

  console.log('Coins to send:', coinsToSend);

  const operation = await poolContract.call(
    'swapWithMas',
    new Args()
      .addString(tokenInAddress)
      .addU256(parseUnits(amountIn.toString(), TOKEN_DEFAULT_DECIMALS))
      .addU256(parseUnits(minAmountOut.toString(), TOKEN_DEFAULT_DECIMALS))
      .serialize(),
    { coins: coinsToSend },
  );

  const operationStatus = await operation.waitSpeculativeExecution();

  if (operationStatus === OperationStatus.SpeculativeSuccess) {
    console.log('Swap with MAS successful');
  } else {
    console.log('Status:', operationStatus);

    // get speculative events from the pool contract
    const events = await operation.getSpeculativeEvents();

    console.error('Swap with MAS failed : ');
    console.error(events);

    throw new Error('Failed to swap');
  }

  return coinsToSend;
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
): Promise<bigint> {
  const tokenContract = new MRC20(provider, tokenAddress);

  const balance = new Args(
    (
      await tokenContract.read(
        'balanceOf',
        new Args().addString(userAddress).serialize(),
      )
    ).value,
  ).nextU256();

  return balance;
}

export async function getLPBalance(
  poolContract: SmartContract,
  userAddress: string,
): Promise<bigint> {
  const lpBalance = new Args(
    (
      await poolContract.read(
        'getLPBalance',
        new Args().addString(userAddress).serialize(),
      )
    ).value,
  ).nextU256();

  return lpBalance;
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
): Promise<[bigint, bigint]> {
  const reserveA = new Args(
    (await poolContract.read('getLocalReserveA')).value,
  ).nextU256();
  const reserveB = new Args(
    (await poolContract.read('getLocalReserveB')).value,
  ).nextU256();

  return [reserveA, reserveB];
}

export async function getPoolTWAP(
  poolContract: SmartContract,
  tokenAddress: string,
): Promise<number> {
  const twap = (
    await poolContract.read(
      'getTWAP',
      new Args().addString(tokenAddress).addU64(0n).serialize(),
    )
  ).value;

  const desTwap = new Args(twap).nextU256();
  return Number(formatMas(desTwap));
}

export function computeMintStorageCost(receiver: string) {
  const STORAGE_BYTE_COST = 100_000;
  const STORAGE_PREFIX_LENGTH = 4;
  const BALANCE_KEY_PREFIX_LENGTH = 7;

  const baseLength = STORAGE_PREFIX_LENGTH;
  const keyLength = BALANCE_KEY_PREFIX_LENGTH + receiver.length;
  const valueLength = 4 * U64.SIZE_BYTE;

  return (baseLength + keyLength + valueLength) * STORAGE_BYTE_COST;
}

export async function getPools(registryContract: SmartContract) {
  // get pools from registry
  const poolsRes = await registryContract.read('getPools');

  const pools = new Args(poolsRes.value).nextSerializableObjectArray<Pool>(
    Pool,
  );

  console.log('Pools: ', pools);

  return pools;
}
