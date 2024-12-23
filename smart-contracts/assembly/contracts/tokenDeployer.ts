import { Args, stringToBytes } from '@massalabs/as-types';
import {
  createSC,
  fileToByteArray,
  generateEvent,
  generateRawEvent,
  Storage,
} from '@massalabs/massa-as-sdk';
import { IMRC20 } from '../interfaces/IMRC20';
import { deserializeStringArray, serializeStringArray } from '../utils';

// Array of all tokens addresses deployed
export const tokenAddresses: StaticArray<u8> = stringToBytes('tokensAddresses');

/**
 * Constructor for the token deployer contract.
 * @returns void
 */
export function constructor(_: StaticArray<u8>): void {
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
  const coinsToUseOnDeployIn = args.nextU64();
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
  new IMRC20(tokenAddress).initExtended(
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
  generateEvent(`New Token ${tokenName} deployed at ${tokenAddress}.`);

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
