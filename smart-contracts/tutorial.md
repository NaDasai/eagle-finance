# Learn how to build massa smart contracts by exemples
This tutorial will guide you through the process of building smart contracts on the Massa blockchain by exemples. All the exemples are taken from our Eagle Finance DEX project. You can find the full code of the project on our [github](https://github.com/NaDasai/eagle-finance).

# Beginner : 

## 1. Initializing a Massa Smart Contract Project
To start a new Massa smart contract project, follow these steps:
1. Initialize a new project:
   ```bash
   npx @massalabs/sc-project-initializer init my-first-sc
   cd my-first-sc
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy .env.example to .env
   ```bash
   cp .env.example .env
   ```

4. Copy your private key to the .env file:
   ```bash
   PRIVATE_KEY=your_private_key
   ```
   


## 2. Reading Function User Input
In Massa smart contracts, function arguments are passed as serialized bytes (StaticArray<u8>). These bytes contain an array of serialized function arguments. To use these arguments in your contract, you'll need to deserialize them using the Args class. Here's an example from our `tokenDeployer.ts` at `createNewToken` function :
```typescript
import { Args } from "@massalabs/massa-as-sdk";
const args = new Args(binaryArgs);

const tokenName = args.nextString().expect('Invalid token name');
const tokenSymbol = args.nextString().expect('Invalid token symbol');
const decimals = args.nextU8().expect('Invalid decimals');
const totalSupply = args.nextU256().expect('Invalid total supply');
```

## 3. Get Contract MAS balance
```typescript
import { balance } from "@massalabs/massa-as-sdk";

const SCBalance = balance();
```

## 4. Get Caller Address
```typescript
import { Context } from "@massalabs/massa-as-sdk";

const callerAddress = Context.caller();
```

## 5. Get Current Contract Address
```typescript
import { Context } from "@massalabs/massa-as-sdk";

const contractAddress = Context.callee();
```

## 6. Global State Variables

Massa smart contracts can use global state variables that are stored as bytes. Here's an example from our `registry` contract that sets the swap router address:
```typescript
import { Storage, assertIsSmartContract} from "@massalabs/massa-as-sdk";

// Storage Key containning the address of the swap Router contract to be used on all the pools
export const swapRouterAddress = stringToBytes('swapRouterAddress');


export function setSwapRouterAddress(binaryArgs: StaticArray<u8>): void {
   const args = new Args(binaryArgs);

  // Get the swapRouterAddress input
  const swapRouterAddressInput = args
    .nextString()
    .expect('SwapRouterAddress is missing or invalid');

  // Assert that the swapRouterAddress is a smart contract 
  assertIsSmartContract(swapRouterAddressInput);

  // Set the swapRouterAddress Storage to the input value 
  Storage.set(swapRouterAddress, stringToBytes(swapRouterAddressInput));
}
```

Also Here's an example of how to retrieve the swap router address from the `registry` contract:
```typescript
import { Storage } from "@massalabs/massa-as-sdk";

export function getSwapRouterAddress(): StaticArray<u8> {  // Get the swapRouterAddress
  // Retrieve the swapRouterAddress from the storage
  const swapRouterAddressStored = Storage.get(swapRouterAddress);

  // Assert that the swapRouterAddress is set (Not empty storage)
  assert(swapRouterAddressStored.length > 0, 'Swap Router Address is not set');

  return swapRouterAddressStored;
}
```

# Advanced :

## 7. Interacting with Native MAS Coins

Here are examples of how to interact with native MAS coins:
1. To get the transferred coins in an operation. you can find an exemple in `tokenDeployer.ts` file at `L97`:

```typescript
import { Context } from "@massalabs/massa-as-sdk";

// Get the coins transferred to the smart contract
const sent = Context.transferredCoins(); 
```

2. To transfer coins to an address. you can find an exemple in `_transferRemaining` function inside `utils/index.ts` file:

```typescript
import { transferCoins } from "@massalabs/massa-as-sdk";

function _transferRemaining(to: Address, value: u64): void {
  // Transfer coins to the specified address
  transferCoins(to, value);
}
```

²

## 8. Create Your Custom MRC20 Token
To create your custom MRC20 token, First you need to install the `@massalabs/sc-standards` package:
```bash
npm install @massalabs/sc-standards
```

Then you build your custom token by extending the `MRC20` class from the `@massalabs/sc-standards` package. Here's examples from our `token.ts` file:

Export all the default functions from the MRC20 standard that you'll not update like we did at `L396` :
```typescript
export {
  VERSION,
  version,
  name,
  symbol,
  decimals,
  totalSupply,
  balanceOf,
  allowance,
  increaseAllowance,
  decreaseAllowance,
} from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20';
  ```

Import default storage keys from the MRC20 standard that you 'll need to use on you update vesion like `NAME_KEY`. :
```typescript
import {
  NAME_KEY,
  DECIMALS_KEY,
  SYMBOL_KEY,
  TOTAL_SUPPLY_KEY,
} from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20';
```

If you want to add another fields for token like description, image and website and make them optional, you need to

1. add their storage keys :
```typescript	
export const TOKEN_DESCRIPTION = stringToBytes('TOKEN_DESCRIPTION');
export const TOKEN_IMAGE = stringToBytes('TOKEN_IMAGE');
export const TOKEN_WEBSITE = stringToBytes('TOKEN_WEBSITE');
```

2. And set their values in the constructor :
```typescript
export function constructor(binaryArgs: StaticArray<u8>): void {
  assert(isDeployingContract());

  const args = new Args(binaryArgs);

  // Admin arg passed by the token deployer to specify the owner of the token
  const admin = args.nextString().expect('Invalid admin');
  const tokenName = args.nextString().expect('Invalid token name');
  const tokenSymbol = args.nextString().expect('Invalid token symbol');
  const decimals = args.nextU8().expect('Invalid decimals');
  const totalSupply = args.nextU256().expect('Invalid total supply');
  // optional parameter
  const image = args.nextString().unwrapOrDefault();
  // optional Parameter
  const website = args.nextString().unwrapOrDefault();
  // optional parameter
  const description = args.nextString().unwrapOrDefault();

  // ...

  // Set the token name, symbol, decimals, total supply, image, website and description in the storage
  Storage.set(NAME_KEY, stringToBytes(tokenName));
  Storage.set(SYMBOL_KEY, stringToBytes(tokenSymbol));
  Storage.set(DECIMALS_KEY, [decimals]);
  Storage.set(TOTAL_SUPPLY_KEY, u256ToBytes(totalSupply));
  Storage.set(TOKEN_IMAGE, stringToBytes(image));
  Storage.set(TOKEN_DESCRIPTION, stringToBytes(description));
  Storage.set(TOKEN_WEBSITE, stringToBytes(website));

  // ...
}
```

3. And their getter functions :
```typescript
export function image(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(TOKEN_IMAGE);
}

export function website(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(TOKEN_WEBSITE);
}

export function description(_: StaticArray<u8>): StaticArray<u8> {
  return Storage.get(TOKEN_DESCRIPTION);
}
```

## 9. Deploying another contract inside an operation

We use it to deploy a new pool contract inside the registry contract. You need to install first the `@massalabs/as-transformer` package, Create an interface for the contract which you want to deploy (look at `interfaces/basicPool.ts`), Then use the `createSC` function to deploy the contract and finally initialize it using its `init` function from the interface.Here's an exemple from our Registry contract at `_createNewPool` at `L618` function where we deploy a new pool contract and initialize it :
```typescript	
import { createSC, fileToByteArray } from "@massalabs/massa-as-sdk";

function _createNewPool(
  aTokenAddress: string,
  bTokenAddress: string,
  inputFeeRate: u64,
): CreateNewPoolData {
  // ...

  //  Deploy the pool contract
  const poolByteCode: StaticArray<u8> = fileToByteArray('build/basicPool.wasm');
  const poolAddress = createSC(poolByteCode);

  //  Init the pool contract
  const poolContract = new IBasicPool(poolAddress);

  poolContract.init(
    aTokenAddress,
    bTokenAddress,
    inputFeeRate,
    feeShareProtocolStored,
    flashLoanFeeStored,
    Context.callee().toString(), // registry address
  );

  // ...
}
```

## 10. Interacting with MRC20 Tokens
To interact with MRC20 tokens, you can use the `MRC20Wrapper` class from the Massa standards or if it is a custom contract you can did as we did by creating an interface called `IMRC20` that extends the `MRC20Wrapper` class:

```typescript	
import { MRC20Wrapper } from "@massalabs/sc-standards/assembly/contracts/MRC20/wrapper";

export class IMRC20 extends MRC20Wrapper implements Serializable {
   constructor(origin: Address = new Address()) {
    super(origin);
  }

  // Add you custom functions here, like image(), website(), description()
 image(): string {
    return bytesToString(call(this._origin, 'image', NoArg, 0));
  }

  website(): string {
    return bytesToString(call(this._origin, 'website', NoArg, 0));
  }

  description(): string {
    return bytesToString(call(this._origin, 'description', new Args(), 0));
  }

  // ...
}
```

To transfer tokens from User to the contract, you should use `transferFrom` function. But first you need to approve the contract to spend the tokens on behalf of You. So on the contract you could make those assertions to get cleaner errors.Alos, massa standars contains function called `getBalanceEntryCost` to get the cost of the balance entry.	You should always use it to estimate how much coins needed to be transferred with that external call. Here's an example at `swapRouter.ts` contract at `_swap` function:
```typescript
import { getBalanceEntryCost } from '@massalabs/sc-standards/assembly/contracts/MRC20/MRC20-external';
import { IMRC20 } from '../interfaces/IMRC20';

function _swap(
  swapPath: SwapPath,
  callerAddress: Address,
  contractAddress: Address,
  toAddress: Address,
  coinsOnEachSwap: u64,
): u256 {
  // ...

  const tokenIn = new IMRC20(swapPath.tokenInAddress);

  // ...

  // Check for balance
  const tokenInBalance = tokenIn.balanceOf(callerAddress);

  assert(tokenInBalance >= amountIn, 'INSUFFICIENT_TOKEN_IN_BALANCE');

  const tokenInAllownace = tokenIn.allowance(
    callerAddress,
    contractAddress,
  );

  // Check for allowance
  assert(tokenInAllownace >= amountIn, 'INSUFFICIENT_TOKEN_IN_ALLOWANCE');

  // Transfer amountIn from user to this contract
  tokenIn.transferFrom(
    callerAddress,
        contractAddress,
        amountIn,
        getBalanceEntryCost(tokenInAddress, contractAddress.toString()),
      );

  // ...

}
```


## 11. Serializable Objects

Massa supports passing complex objects as arguments to smart contract functions. To do this, you need to implement a custom Serializable class for your object. Here's an example of a serializable object from our `structs/swapPath.ts` file:

```typescript
import { Args, Result, Serializable } from '@massalabs/as-types';
import { Address } from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly';

export class SwapPath implements Serializable {
  constructor(
    public poolAddress: Address = new Address(),
    public tokenInAddress: Address = new Address(),
    public tokenOutAddress: Address = new Address(),
    public receiverAddress: Address = new Address(),
    public amountIn: u256 = u256.Zero,
    public minAmountOut: u256 = u256.Zero,
    public isTransferFrom: bool = false,
  ) {}

  serialize(): StaticArray<u8> {
    return new Args()
      .add(this.poolAddress)
      .add(this.tokenInAddress)
      .add(this.tokenOutAddress)
      .add(this.receiverAddress)
      .add(this.amountIn)
      .add(this.minAmountOut)
      .add(this.isTransferFrom)
      .serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);

    this.poolAddress = new Address(args.nextString().expect('Invalid address'));
    this.tokenInAddress = new Address(
      args.nextString().expect('Invalid address'),
    );
    this.tokenOutAddress = new Address(
      args.nextString().expect('Invalid address'),
    );
    this.receiverAddress = new Address(
      args.nextString().expect('Invalid address'),
    );
    this.amountIn = args.nextU256().expect('Invalid amount in');
    this.minAmountOut = args.nextU256().expect('Invalid min amount out');
    this.isTransferFrom = args.nextBool().expect('Invalid isTransferFrom');

    return new Result(args.offset);
  }

  toString(): string {
    return (
      `Pool Address: ${this.poolAddress.toString()}\n` +
      `Token In Address: ${this.tokenInAddress.toString()}\n` +
      `Token Out Address: ${this.tokenOutAddress.toString()}\n` +
      `Receiver Address: ${this.receiverAddress.toString()}\n` +
      `Amount In: ${this.amountIn.toString()}\n` +
      `Min Amount Out: ${this.minAmountOut.toString()} \n` +
      `Is Transfer From: ${this.isTransferFrom}`
    );
  }
}
```

and this is an exemple of how to deserialize and use it in the `swapRouter.ts` contract at `swap` function :
```typescript
import { SwapPath } from '../structs/swapPath';
import { Args } from '@massalabs/as-types';

export function swap(binaryArgs: StaticArray<u8>): void {
  // ... 

  const args = new Args(binaryArgs);

  // Read the swap Path array args
  let swapPathArray = args
    .nextSerializableObjectArray<SwapPath>()
    .expect('Invalid swap path array');

  // ...
}
```


## 12. Transfer remaining coins
This function goal is to transfer the remaining sent coins after the execution in the operation to the caller. Massa uses Mas coins to pay for storages costs and the one responsible of paying that cost is the operation caller. So at each operation user sends some extra MAS coins to cover storage costs. but what happens if the user sends too much, we need to implment a mechanism to transfer the remaining coins back to the caller. Here's the implementation of that function from our `utils/index.ts` file:
```typescript
/**
 * @notice Function to transfer remaining Massa coins to a recipient at the end of a call
 * @param balanceInit Initial balance of the SC (transferred coins + balance of the SC)
 * @param balanceFinal Balance of the SC at the end of the call
 * @param sent Number of coins sent to the SC
 * @param to Caller of the function to transfer the remaining coins to
 */
export function transferRemaining(
  balanceInit: u64,
  balanceFinal: u64,
  sent: u64,
  to: Address,
): void {
  if (balanceInit >= balanceFinal) {
    // Some operation might spend Massa by creating new storage space
    const spent = SafeMath.sub(balanceInit, balanceFinal);
    generateEvent(`Spent ${spent} coins`);
    assert(spent <= sent, 'SPENT_MORE_COINS_THAN_SENT');
    if (spent < sent) {
      // SafeMath not needed as spent is always less than sent
      const remaining: u64 = sent - spent;
      _transferRemaining(to, remaining);
    }
  } else {
    // Some operation might unlock Massa by deleting storage space
    const received = SafeMath.sub(balanceFinal, balanceInit);
    const totalToSend: u64 = SafeMath.add(sent, received);
    _transferRemaining(to, totalToSend);
  }
}

function _transferRemaining(to: Address, value: u64): void {
  transferCoins(to, value);
}
```

Now, To use it you need to get the balance of the contract at the start of the operation and at the end of the execution of the function and the number of coins sent to the contract by the caller. Here's this an exemple from our `basicPool.ts` contract at `syncReserves` function :
```typescript
import {
  transferRemaining
} from '../utils';
import {
  Context,
  balance,
} from '@massalabs/massa-as-sdk';

export function syncReserves(): void {
  // ...
  const SCBalance = balance();
  const sent = Context.transferredCoins();
  // ...
 
  // Transfer remaining coins to the caller
  transferRemaining(SCBalance, balance(), sent, Context.caller());
}
```

## 13. Reentrancy Guard Protection
Massa by default does not have built-in protection against reentrancy. So You can create you own reentrancy guard to protect your contract against reentrancy attacks. Here's an example from our `lib/ReentrancyGuard.ts` file that is inspired by OpenZeppelin implementation:

```typescript
import { Storage } from '@massalabs/massa-as-sdk';
import { byteToU8, stringToBytes, u8toByte } from '@massalabs/as-types';

export const STATUS = stringToBytes('STATUS');

const _NOT_ENTERED: u8 = 1;
const _ENTERED: u8 = 2;

/// @title Reentrancy Guard
/// @notice Contract module that helps prevent reentrant calls to a function
export class ReentrancyGuard {
  static __ReentrancyGuard_init(): void {
    assert(!Storage.has(STATUS), 'ReentrancyGuard already initialized');

    Storage.set(STATUS, u8toByte(_NOT_ENTERED));
  }

  /// @notice Prevents a contract from calling itself, directly or indirectly.
  /// Calling a `nonReentrant` function from another `nonReentrant`
  /// function is not supported. It is possible to prevent this from happening
  /// by making the `nonReentrant` function external, and making it call a
  /// `private` function that does the actual work
  static nonReentrant(): void {
    // On the first call to nonReentrant, _notEntered will be true

    assert(
      byteToU8(Storage.get(STATUS)) == _NOT_ENTERED,
      'ReentrancyGuard: calling nonReentrant while already in a call to nonReentrant',
    );

    // Any calls to nonReentrant after this point will fail
    Storage.set(STATUS, u8toByte(_ENTERED));
  }

  static endNonReentrant(): void {
    Storage.set(STATUS, u8toByte(_NOT_ENTERED));
  }
}
```

To use it, you need to initialize it in the constructor of your contract and call `nonReentrant` at the start of the function and `endNonReentrant` at the end of the function. 
Here's how you can initialize it in the constructor of your contract:
```typescript
import { ReentrancyGuard } from '../lib/ReentrancyGuard';

export function constructor(binaryArgs: StaticArray<u8>): void {
   // This line is important. It ensures that this function can't be called in the future.
  // If you remove this check, someone could call your constructor function and reset your smart contract.
  assert(Context.isDeployingContract());

  // ...

  // Initialize the reentrancy guard
  ReentrancyGuard.__ReentrancyGuard_init();
}
```

And here's an exemple of how to use it taken from our `registry.ts` contract at `setWmasTokenAddress` function :
```typescript
export function setWmasTokenAddress(binaryArgs: StaticArray<u8>): void {
  // start reentrancy guard
  ReentrancyGuard.nonReentrant();

  // Only owner of registery can set wmas token address
  onlyOwner();

  const args = new Args(binaryArgs);

  const wmasTokenAddressInput = args
    .nextString()
    .expect('WmasTokenAddress is missing or invalid');

  // Get the current balance of the smart contract
  const SCBalance = balance();
  // Get the coins transferred to the smart contract
  const sent = Context.transferredCoins();

  // Ensure taht the wmasTokenAddress is a smart contract address
  assertIsSmartContract(wmasTokenAddressInput);

  // Store wmasTokenAddress
  Storage.set(wmasTokenAddress, stringToBytes(wmasTokenAddressInput));

  // Emit an event
  generateEvent(
    createEvent('UPDATE_WMAS_TOKEN_ADDRESS', [
      Context.callee().toString(), // Smart contract address
      Context.caller().toString(), // Caller address
      wmasTokenAddressInput, // New wmas token address
    ]),
  );

  // Transfer the remaining coins back to the caller
  transferRemaining(SCBalance, balance(), sent, Context.caller());

  // End reentrancy guard
  ReentrancyGuard.endNonReentrant();
}
```

## 14. Wrap Native MAS Coins to wmas
To wrap native MAS coins to wmas, we've implmented a helper function called `wrapMasToWMAS` in our `utils/index.ts` file. Here's the implementation:
```typescript
/**
 * Wraps a specified amount of MAS coins into WMAS tokens.
 *
 * @param amount - The amount of MAS coins to be wrapped into WMAS tokens.
 * @param wmasAddress - The address of the WMAS token contract.
 * @throws Will throw an error if the transferred MAS coins are insufficient.
 */
export function wrapMasToWMAS(amount: u256, wmasAddress: Address): void {
  // Get the transferred coins from the operation
  const transferredCoins = Context.transferredCoins();

  // Get the wmas contract instance
  const wmasToken = new IWMAS(wmasAddress);

  const mintStorageCost = u256.fromU64(
    _computeMintStorageCost(Context.callee()),
  );

  const amountToWrap = SafeMath256.add(amount, mintStorageCost);

  // Ensure that transferred coins are greater than or equal to the amount to wrap
  assert(
    u256.fromU64(transferredCoins) >= amountToWrap,
    'INSUFFICIENT MAS COINS TRANSFERRED',
  );

  // Wrap MAS coins into WMAS
  wmasToken.deposit(amountToWrap.toU64());

  // Generate an event to indicate that MAS coins have been wrapped into WMAS
  generateEvent(`WRAP_MAS: ${amount.toString()} of MAS wrapped into WMAS`);
}
```

and here's an exemple of how to use it in the `swapRouter.ts` contract at `_swap` function :
```typescript
function _swap(
  swapPath: SwapPath,
  callerAddress: Address,
  contractAddress: Address,
  toAddress: Address,
  coinsOnEachSwap: u64,
): u256 {
  const poolAddress = swapPath.poolAddress;
  const tokenInAddress = swapPath.tokenInAddress.toString();
  const tokenOutAddress = swapPath.tokenOutAddress.toString();
  const amountIn = swapPath.amountIn;

  // ...


  // Wrap mas before swap and transfer wmas
  const registryContractAddressStored = bytesToString(
    Storage.get(registryContractAddress),
  );

  // Get the wmas token address
  const wmasTokenAddressStored = new Address(
    new IRegistery(
      new Address(registryContractAddressStored),
    ).getWmasTokenAddress(),
  );

  // Wrap Mas to WMAS
  wrapMasToWMAS(amountIn, wmasTokenAddressStored);
  
  // ...

}
```






























