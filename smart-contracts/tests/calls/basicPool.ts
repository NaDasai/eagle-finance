import {
  Address,
  Args,
  formatMas,
  Mas,
  MRC20,
  OperationStatus,
  parseMas,
  parseUnits,
  Provider,
  SmartContract,
  U256,
  U64,
} from '@massalabs/massa-web3';
import { TOKEN_DEFAULT_DECIMALS, truncateDecimals } from '../utils';
import { Pool } from '../../src/builnet-tests/structs/pool';
import { SwapPath } from '../classes/swapPath';

export async function addLiquidity(
  poolContract: SmartContract,
  aAmount: number,
  bAmount: number,
  minAmountA: number,
  minAmountB: number,
  aDecimals: number = TOKEN_DEFAULT_DECIMALS,
  bDecimals: number = TOKEN_DEFAULT_DECIMALS,
) {
  console.log(
    `Add liquidity: ${aAmount} A, ${bAmount} B (min: ${minAmountA} A, ${minAmountB} B) to pool...`,
  );
  const operation = await poolContract.call(
    'addLiquidity',
    new Args()
      .addU256(parseUnits(truncateDecimals(aAmount, aDecimals), aDecimals))
      .addU256(parseUnits(truncateDecimals(bAmount, bDecimals), bDecimals))
      .addU256(parseUnits(minAmountA.toString(), aDecimals))
      .addU256(parseUnits(minAmountB.toString(), bDecimals))
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

  const coins =
    Mas.fromString(bAmount.toString()) + BigInt(storageCosts) + parseMas('0.1');

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

  const coins =
    Mas.fromString(amountIn.toString()) +
    BigInt(storageCosts) +
    parseMas('0.1');

  const coinsToSend = NativeIn ? coins : Mas.fromString('0.1');

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

export async function removeLiquidityUsingPercentage(
  poolContract: SmartContract,
  userProvider: Provider,
  percentage: number,
  minAmountA: number,
  minAmountB: number,
  aDecimals: number = TOKEN_DEFAULT_DECIMALS,
  bDecimals: number = TOKEN_DEFAULT_DECIMALS,
) {
  console.log(
    `Remove liquidity using percentage: ${percentage}% (min: ${minAmountA} A, ${minAmountB} B) from pool...`,
  );

  // get the user lpBalance
  const userLPBalance = await getLPBalance(poolContract, userProvider.address);

  console.log('User LP balance:', userLPBalance);

  const lpRemoveAmount = (userLPBalance * BigInt(percentage)) / 100n;

  console.log('LP amount:', lpRemoveAmount);

  const operation = await poolContract.call(
    'removeLiquidity',
    new Args()
      .addU256(lpRemoveAmount)
      .addU256(parseUnits(minAmountA.toString(), aDecimals))
      .addU256(parseUnits(minAmountB.toString(), bDecimals))
      .serialize(),
    {
      coins: Mas.fromString('0.1'),
    },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Liquidity removed');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to remove liquidity');
  }
}

export async function removeLiquidity(
  poolContract: SmartContract,
  lpAmount: number,
  minAmountA: number,
  minAmountB: number,
  aDecimals: number = TOKEN_DEFAULT_DECIMALS,
  bDecimals: number = TOKEN_DEFAULT_DECIMALS,
) {
  console.log(
    `Remove liquidity: ${lpAmount} LP (min: ${minAmountA} A, ${minAmountB} B) from pool...`,
  );

  const operation = await poolContract.call(
    'removeLiquidity',
    new Args()
      .addU256(parseUnits(lpAmount.toString(), TOKEN_DEFAULT_DECIMALS))
      .addU256(parseUnits(minAmountA.toString(), aDecimals))
      .addU256(parseUnits(minAmountB.toString(), bDecimals))
      .serialize(),
    {
      coins: Mas.fromString('0.1'),
    },
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

export async function getPoolLPTotalSupply(
  poolContract: SmartContract,
): Promise<bigint> {
  const result = await poolContract.read('getLPTotalSupply');

  const lpBalance = new Args(result.value).nextU256();

  return lpBalance;
}

export async function increaseAllownace(
  tokenAddress: string,
  spenderAddress: string,
  amount: number,
  provider: Provider,
  tokenDecimals: number = TOKEN_DEFAULT_DECIMALS,
): Promise<void> {
  const tokenContract = new MRC20(provider, tokenAddress);

  console.log(`Increase allowance of ${amount} to token ${tokenAddress}...`);

  const operation = await tokenContract.increaseAllowance(
    spenderAddress,
    parseUnits(truncateDecimals(amount, tokenDecimals), tokenDecimals),
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

export function computeMintStorageCost(receiver: string) {
  const STORAGE_BYTE_COST = 100_000;
  const STORAGE_PREFIX_LENGTH = 4;
  const BALANCE_KEY_PREFIX_LENGTH = 7;

  const baseLength = STORAGE_PREFIX_LENGTH;
  const keyLength = BALANCE_KEY_PREFIX_LENGTH + receiver.length;
  const valueLength = 4 * U64.SIZE_BYTE;

  return (baseLength + keyLength + valueLength) * STORAGE_BYTE_COST;
}

export async function getAPriceCumulativeLast(poolContract: SmartContract) {
  return new Args(
    (await poolContract.read('getAPriceCumulativeLast')).value,
  ).nextU256();
}

export async function getBPriceCumulativeLast(poolContract: SmartContract) {
  return new Args(
    (await poolContract.read('getBPriceCumulativeLast')).value,
  ).nextU256();
}

export async function flash(
  poolContract: SmartContract,
  flashContractAddress: string,
  flashSwapData: Uint8Array,
  aAmountOut: bigint,
  bAmountOut: bigint,
) {
  console.log(
    `Flash swap with epecting ${aAmountOut} A and ${bAmountOut} B...`,
  );

  const operation = await poolContract.call(
    'flashLoan',
    new Args()
      .addU256(aAmountOut)
      .addU256(bAmountOut)
      .addString(flashContractAddress)
      .addUint8Array(flashSwapData)
      .serialize(),
    { coins: Mas.fromString('0.1') },
  );

  const operationStatus = await operation.waitSpeculativeExecution();

  if (operationStatus === OperationStatus.SpeculativeSuccess) {
    console.log('Flash successful');
  } else {
    console.log('Flash  failed');
    throw new Error('Failed to execute flash');
  }
}

export async function getSwapOutEstimation(
  poolContract: SmartContract,
  amountIn: number,
  tokenInAddress: string,
  tokenInDecimals: number = TOKEN_DEFAULT_DECIMALS,
) {
  const operation = await poolContract.read(
    'getSwapOutEstimation',
    new Args()
      .addString(tokenInAddress)
      .addU256(parseUnits(amountIn.toString(), tokenInDecimals))
      .serialize(),
  );

  return new Args(operation.value).nextU256();
}

export async function claimeProtocolFees(poolContract: SmartContract) {
  const operation = await poolContract.call(
    'claimProtocolFees',
    new Args().serialize(),
    {
      coins: Mas.fromString('0.1'),
    },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Protocol fees claimed');
  } else {
    console.log('Status:', status);

    console.log('Error Events : ', await operation.getSpeculativeEvents());

    throw new Error('Failed to claim protocol fees');
  }
}

export async function getAClaimableProtocolFee(poolContract: SmartContract) {
  return new Args(
    (await poolContract.read('getAClaimableProtocolFee')).value,
  ).nextU256();
}

export async function getBClaimableProtocolFee(poolContract: SmartContract) {
  return new Args(
    (await poolContract.read('getBClaimableProtocolFee')).value,
  ).nextU256();
}

export async function syncReserves(poolContract: SmartContract) {
  const operation = await poolContract.call(
    'syncReserves',
    new Args().serialize(),
    {
      coins: Mas.fromString('0.1'),
    },
  );

  const status = await operation.waitSpeculativeExecution();

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Reserves synced');
  } else {
    console.log('Status:', status);

    console.log('Error Events : ', await operation.getSpeculativeEvents());

    throw new Error('Failed to sync reserves');
  }
}

export async function swap(
  swapContract: SmartContract,
  swapRoute: SwapPath[],
  coinsOnEachSwap: string = '0.01',
  coins: bigint = Mas.fromString('0.1'),
) {
  console.log(`swap ${swapRoute.length} times... : ${swapRoute}`);
  const operation = await swapContract.call(
    'swap',
    new Args()
      .addSerializableObjectArray<SwapPath>(swapRoute)
      .addU64(parseMas(coinsOnEachSwap))
      .serialize(),
    { coins },
  );

  const operationStatus = await operation.waitSpeculativeExecution();

  if (operationStatus === OperationStatus.SpeculativeSuccess) {
    console.log('Swap successful');
  } else {
    console.log('Status:', operationStatus);
    throw new Error('Failed to swap');
  }
}
