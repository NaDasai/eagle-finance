import {
  Args,
  Result,
  serializableObjectsArrayToBytes,
  stringToBytes,
} from '@massalabs/as-types';
import {
  Address,
  Context,
  createEvent,
  createSC,
  fileToByteArray,
  generateEvent,
  generateRawEvent,
  isDeployingContract,
  Storage,
  validateAddress,
} from '@massalabs/massa-as-sdk';
import { IMRC20 } from '../interfaces/IMRC20';
import { deserializeStringArray, serializeStringArray } from '../utils';
import { UserToken } from '../structs/userToken';
import { u256 } from 'as-bignum/assembly';

// Array of all tokens addresses deployed
export const tokenAddresses: StaticArray<u8> = stringToBytes('tokensAddresses');

/**
 * Constructor for the token deployer contract.
 * @returns void
 */
export function constructor(_: StaticArray<u8>): void {
  // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  assert(isDeployingContract());

  // Initialize the token addresses array
  Storage.set(tokenAddresses, serializeStringArray([]));

  generateEvent(`Token Deployer deployed.`);
}

/**
 * Create a new token and deploy it on the blockchain.
 * @param binaryArgs - The binary arguments for creating the token.(tokenName, tokenSymbol, decimals, totalSupply, url, description)
 * @returns void
 */
export function createNewToken(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const tokenName = args.nextString().expect('Invalid token name');
  const tokenSymbol = args.nextString().expect('Invalid token symbol');
  const decimals = args.nextU8().expect('Invalid decimals');
  const totalSupply = args.nextU256().expect('Invalid total supply');
  // Optional parameter
  const url = args.nextString().unwrapOrDefault();
  // Optional parameter
  const description = args.nextString().unwrapOrDefault();
  // Optional parameter that specifies the coins to use on deploy the new token.
  // Default value is 0.005 MAS, which is the minimum required to deploy a token contract.
  // Check storage costs documentation for more details at https://docs.massa.net/docs/learn/storage-costs
  const coinsToUseOnDeployIn: Result<u64> = args.nextU64();
  let coinsToUseOnDeploy: u64;

  // IsErr() returns true, if coinsToUseOnDeployIn is not passed or some error occurs
  if (coinsToUseOnDeployIn.isErr()) {
    // default value
    coinsToUseOnDeploy = u64(5 * 10 ** 7);
  } else {
    coinsToUseOnDeploy = coinsToUseOnDeployIn.unwrap();
  }

  // Get the token bytecode
  const tokenByteCode: StaticArray<u8> = fileToByteArray('build/token.wasm');

  // Deploy the token contract
  const tokenAddress = createSC(tokenByteCode);

  // Init the token contract
  const tokenContract = new IMRC20(tokenAddress);

  tokenContract.initExtended(
    Context.caller(),
    tokenName,
    tokenSymbol,
    decimals,
    totalSupply,
    url,
    description,
    coinsToUseOnDeploy,
  );

  // Get the tokens array stored in storage
  const tokensStored = Storage.get(tokenAddresses);

  // Deserialize the tokens array to string array
  const deserializedTokens = deserializeStringArray(tokensStored);

  // Add the token address to the array of tokens
  deserializedTokens.push(tokenAddress.toString());

  // Serialize the array of tokens
  Storage.set(tokenAddresses, serializeStringArray(deserializedTokens));

  // Emit an event
  generateEvent(
    `CREATE_NEW_TOKEN:${Context.callee().toString()}||${Context.caller().toString()}||${tokenAddress.toString()}||${tokenName}||${tokenSymbol}||${decimals.toString()}||${totalSupply.toString()}||${url}||${description}||${coinsToUseOnDeploy.toString()}`,
  );

  // Raw event to be able to get the token address at the frotnend by using operation.getDeployedAddress(true)
  generateRawEvent(new Args().add(tokenAddress).serialize());
}

/**
 * Retrieves all tokens deployed on the blockchain.
 * @returns The array of tokens.
 */
export function getTokens(): StaticArray<u8> {
  return Storage.get(tokenAddresses);
}

/**
 * Retrieves the token balances for a user based on the provided binary arguments.
 *
 * @param binaryArgs - A serialized array of bytes representing the user's address.
 * - userAddress: The user's address.
 * @returns A serialized array of bytes containing the user's token balances.
 *
 * @throws Will throw an error if the user address is invalid.
 *
 * @remarks
 * This function deserializes the user address from the binary arguments, validates it,
 * and retrieves the stored token addresses from storage. It then iterates over each token,
 * checks the user's balance, and collects non-zero balances into a UserToken array.
 * The resulting array is serialized and returned.
 */
export function getUserTokenBalances(
  binaryArgs: StaticArray<u8>,
): StaticArray<u8> {
  const args = new Args(binaryArgs);

  const userAddress = args.nextString().expect('Invalid user address');

  assert(validateAddress(userAddress), 'Invalid user address');

  // Get the tokens array stored in storage
  const tokensStored = deserializeStringArray(Storage.get(tokenAddresses));

  const userTokens: UserToken[] = [];

  // loop on the tokens array and get the user token balance for each token
  for (let i = 0; i < tokensStored.length; i++) {
    const tokenAddress = new Address(tokensStored[i]);

    const tokenContract = new IMRC20(tokenAddress);

    const userTokenBalance = tokenContract.balanceOf(new Address(userAddress));

    // Store only the user token if it's greater than 0
    if (userTokenBalance > u256.Zero) {
      userTokens.push(
        new UserToken(new Address(userAddress), tokenAddress, userTokenBalance),
      );
    }
  }

  // Serialize the user tokens array
  return serializableObjectsArrayToBytes(userTokens);
}

// Export ownership functions
export * from '../utils/ownership';
