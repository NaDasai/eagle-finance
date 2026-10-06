/**
 * Sync the reserves of the pools drained by the WMAS -> NATIVE_COIN exploit (2026-09-27).
 *
 * The exploit left these pools with recorded WMAS reserves far above the WMAS they really
 * hold, which blocks every WMAS-in swap and almost every removeLiquidity. `syncReserves`
 * resets the recorded reserves to the real token balances.
 *
 * Protocol fees are claimed BEFORE the sync: claimProtocolFees doesn't touch the reserves,
 * so claiming after the sync would recreate a reserve > balance gap.
 *
 * Usage:
 *   npm run sync-drained-pools              -> dry run, only reads and prints the pools state
 *   npm run sync-drained-pools -- --execute -> per pool: claimProtocolFees (when possible) then syncReserves
 *
 * Requirements:
 *   - PRIVATE_KEY in .env must be the owner of the registry (syncReserves is owner only).
 *   - Patch or pause the swap router BEFORE executing, otherwise the synced pools can be
 *     drained again as soon as WMAS is added back.
 */
import {
  Account,
  bytesToStr,
  formatUnits,
  MRC20,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import {
  claimeProtocolFees,
  getAClaimableProtocolFee,
  getBClaimableProtocolFee,
  getPoolReserves,
  syncReserves,
} from '../tests/calls/basicPool';
import * as dotenv from 'dotenv';

// Load PRIVATE_KEY from .env, Account.fromEnv only reads process.env
dotenv.config();

// Pools listed in the exploit report
const DRAINED_POOLS = [
  'AS126PmvRK8NuSmVW3LRTgUuUw4csPW76bS9DZzn8bsGJCkhqySiz', // WMAS/WETH.e
  'AS1TYA6pT2KJ7EtN1XCxYuhKtau8Zfuk9p7zq7kzfjqXmxd7r5FQ',
  'AS12gcV6XBDFdfp7h4v7iditb4GrwYjoUqE8NoVHToQmiGNxLst8y',
  'AS12GHDPYmo1tkPeqFYqxhn18JpS2zEdCZHvDFZkeZXKovjJ2Daku',
  'AS1X7YfpaiKRSFFxzDyWGHAPZerosTxEzmdcsN48KZpbudmdcHEb',
  'AS12b3iWUVe24PGpgFcwehFyVs17sRcuug72mybDgjapi3rzKunUc',
  'AS12rutCxhy8s6yyrsryhCGtRKhkEJUKep2DK13KRsSJxBPEigwkc',
  'AS12ND28VfJQvmf75EbvKpno1K9jhfPXu4GCUZ7MpyUwdjxeCDBU',
  'AS174QXyeHBRF5fu7pMP7E38PzbBb1PyZD91euAYrLZqxFWwpqWo',
];

// Storage key where the pool keeps its registry address (see basicPool.ts `registryContractAddress`)
const POOL_REGISTRY_STORAGE_KEY = 'registry';

const shouldExecute = process.argv.includes('--execute');

const account = await Account.fromEnv();
const provider = Web3Provider.mainnet(account);

console.log(`Mode: ${shouldExecute ? 'EXECUTE' : 'DRY RUN (no tx sent)'}`);
console.log(`Caller: ${account.address.toString()}\n`);

type PoolTokens = {
  aAddress: string;
  bAddress: string;
  aDecimals: number;
  bDecimals: number;
};

async function getPoolTokens(pool: SmartContract): Promise<PoolTokens> {
  const aAddress = bytesToStr((await pool.read('getATokenAddress')).value);
  const bAddress = bytesToStr((await pool.read('getBTokenAddress')).value);

  return {
    aAddress,
    bAddress,
    aDecimals: Number(await new MRC20(provider, aAddress).decimals()),
    bDecimals: Number(await new MRC20(provider, bAddress).decimals()),
  };
}

type PoolState = {
  balanceA: bigint;
  balanceB: bigint;
  feeA: bigint;
  feeB: bigint;
};

// Prints recorded reserves vs real balances so we can see the gap before/after the sync.
// Returns balances and fees so the caller can decide whether the claim can succeed.
async function printPoolState(
  pool: SmartContract,
  tokens: PoolTokens,
): Promise<PoolState> {
  const [reserveA, reserveB] = await getPoolReserves(pool);

  const balanceA = await new MRC20(provider, tokens.aAddress).balanceOf(
    pool.address,
  );
  const balanceB = await new MRC20(provider, tokens.bAddress).balanceOf(
    pool.address,
  );

  const feeA = await getAClaimableProtocolFee(pool);
  const feeB = await getBClaimableProtocolFee(pool);

  const fmtA = (v: bigint) => formatUnits(v, tokens.aDecimals);
  const fmtB = (v: bigint) => formatUnits(v, tokens.bDecimals);

  console.log(`  Token A ${tokens.aAddress}`);
  console.log(
    `    recorded: ${fmtA(reserveA)} | real: ${fmtA(balanceA)} | gap: ${fmtA(
      reserveA - balanceA,
    )} | protocol fee: ${fmtA(feeA)}`,
  );
  console.log(`  Token B ${tokens.bAddress}`);
  console.log(
    `    recorded: ${fmtB(reserveB)} | real: ${fmtB(balanceB)} | gap: ${fmtB(
      reserveB - balanceB,
    )} | protocol fee: ${fmtB(feeB)}`,
  );

  // syncReserves sets reserves to the full balance, protocol fees included.
  // If the fee is above the real balance, claimProtocolFees will revert, and claiming it
  // after the sync would recreate a reserve > balance gap. Flag it so it's not missed.
  if (feeA > balanceA || feeB > balanceB) {
    console.log(
      '  ⚠️ Protocol fee is above the real balance: claim is not possible, do NOT claim protocol fees on this pool after the sync.',
    );
  }

  return { balanceA, balanceB, feeA, feeB };
}

// Claims protocol fees only when the tx can succeed, otherwise logs why it's skipped.
async function claimFeesIfPossible(
  pool: SmartContract,
  state: PoolState,
): Promise<void> {
  // claimProtocolFees asserts 'No accumulated fees' when both are 0
  if (state.feeA === 0n && state.feeB === 0n) {
    console.log('  No protocol fees to claim');
    return;
  }

  // A and B are claimed in the same tx: if one transfer can't be covered, the whole
  // claim reverts. Skip it and still sync, so the pool gets unblocked (fee stays recorded).
  if (state.feeA > state.balanceA || state.feeB > state.balanceB) {
    console.log('  ⚠️ Skipping claim: protocol fee is above the real balance');
    return;
  }

  // Helper waits for speculative success and throws (with events logged) on failure.
  // A throw here skips the sync for this pool on purpose: syncing with fees still
  // inside the balance is what we want to avoid.
  await claimeProtocolFees(pool);
}

// syncReserves is restricted to the registry owner, so check it once before sending
// 9 txs that would all revert with CALLER_IS_NOT_REGISTRY_OWNER.
async function assertCallerIsRegistryOwner(poolAddress: string): Promise<void> {
  const [registryBytes] = await provider.readStorage(poolAddress, [
    POOL_REGISTRY_STORAGE_KEY,
  ]);
  const registryAddress = bytesToStr(registryBytes);

  const registry = new SmartContract(provider, registryAddress);
  const owner = bytesToStr((await registry.read('ownerAddress')).value);

  console.log(`Registry: ${registryAddress}`);
  console.log(`Registry owner: ${owner}\n`);

  if (owner !== account.address.toString()) {
    throw new Error(
      `Caller ${account.address.toString()} is not the registry owner ${owner}. Aborting.`,
    );
  }
}

if (shouldExecute) {
  await assertCallerIsRegistryOwner(DRAINED_POOLS[0]);
}

const succeeded: string[] = [];
const failed: string[] = [];

for (const poolAddress of DRAINED_POOLS) {
  console.log(`=== Pool ${poolAddress} ===`);

  // One pool failing must not stop the others, so each pool is handled on its own
  try {
    const pool = new SmartContract(provider, poolAddress);
    const tokens = await getPoolTokens(pool);

    console.log('Before:');
    const stateBefore = await printPoolState(pool, tokens);

    if (shouldExecute) {
      // Claim must happen before the sync (see header comment)
      await claimFeesIfPossible(pool, stateBefore);

      // Helper waits for speculative success and throws (with events logged) on failure
      await syncReserves(pool);

      console.log('After:');
      await printPoolState(pool, tokens);
    }

    succeeded.push(poolAddress);
  } catch (error) {
    console.error(`  ❌ Failed: ${(error as Error).message}`);
    failed.push(poolAddress);
  }

  console.log('');
}

console.log('=== Summary ===');
console.log(
  `${shouldExecute ? 'Synced' : 'Read'}: ${succeeded.length}/${
    DRAINED_POOLS.length
  }`,
);
if (failed.length > 0) {
  console.log('Failed pools:');
  failed.forEach((address) => console.log(`  - ${address}`));
  process.exitCode = 1;
}
