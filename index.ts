/*
 * Create, claim and verify a Payment Channel.
 * Reference: https://xrpl.org/paychannel.html
 */
import { Client, Wallet, signPaymentChannelClaim } from "xrpl";
import fetch from "node-fetch";

// Import the request and response types for channel_verify
import type {
  ChannelVerifyRequest,
  ChannelVerifyResponse,
  PaymentChannelClaim,
  PaymentChannelCreate,
} from "xrpl";

// Use a direct HTTP endpoint for raw JSON-RPC calls
const TESTNET_URL = "https://s.altnet.rippletest.net:51234";
const client = new Client("wss://s.altnet.rippletest.net:51233");

// Main function to orchestrate the process
void main();

async function main(): Promise<void> {
  await client.connect();

  // Setup wallets
  const { wallet1, wallet2 } = await setupWallets();

  // Print initial balances
  console.log("Balances of wallets before Payment Channel is claimed:");
  await printAccountBalances(wallet1, wallet2);

  // Create payment channel
  const channelId = await createPaymentChannel({
    payerWallet: wallet1,
    payeeWallet: wallet2,
  });

  // Define payment amount in XRP and convert to drops
  const paymentAmountXRP = 0.4;
  const paymentAmountDrops = (paymentAmountXRP * 1000000).toString(); // 400000 drops
  let cumulativeAmountDrops = 0;
  let finalSignature = "";

  console.log(
    `Making 10 off-chain payments of ${paymentAmountXRP} XRP (${paymentAmountDrops} drops) each`
  );

  // Loop to simulate 10 off-chain payments
  for (let i = 0; i < 10; i++) {
    // Increase cumulative amount
    cumulativeAmountDrops += parseInt(paymentAmountDrops);
    const currentClaimAmount = cumulativeAmountDrops.toString();

    // 1. Payer: Create a claim for the current cumulative amount
    console.log(
      `Payer: Creating claim for payment ${
        i + 1
      } (${currentClaimAmount} drops)...`
    );

    finalSignature = await createPaymentChannelClaim({
      channelId,
      amount: currentClaimAmount,
      wallet: wallet1,
    });

    // 2. Payee: Verify the claim
    console.log(`Payee: Verifying claim for payment ${i + 1}...`);
    const isVerified = await verifyPaymentChannelClaim({
      channelId,
      signature: finalSignature,
      publicKey: wallet1.publicKey,
      amount: currentClaimAmount,
    });

    console.log(
      `Payment ${i + 1}: Verified claim for ${currentClaimAmount} drops (${
        parseFloat(currentClaimAmount) / 1000000
      } XRP)`
    );
    console.log(`Verification result: ${isVerified ? "Valid ✓" : "Invalid ✗"}`);
  }

  console.log(
    `\nCompleted 10 off-chain payments totaling ${cumulativeAmountDrops} drops (${
      cumulativeAmountDrops / 1000000
    } XRP)`
  );
  console.log(`Final signature: ${finalSignature}`);

  // Claim payment channel
  await claimPaymentChannel({
    payeeWallet: wallet2,
    payerWallet: wallet1,
    channelId,
    amount: cumulativeAmountDrops.toString(),
    signature: finalSignature,
  });

  // Check balances after claim
  console.log("Balances of wallets after Payment Channel is claimed:");
  await printAccountBalances(wallet1, wallet2);

  // Close the channel
  await closePaymentChannel({
    wallet: wallet2,
    channelId,
  });

  // Check final status
  await checkFinalStatus({
    payerWallet: wallet1,
    payeeWallet: wallet2,
    channelId,
  });

  await client.disconnect();
}

// Function to get account balance
async function getAccountBalance(address: string): Promise<string> {
  return (await client.getXrpBalance(address)).toString();
}

// Function to print account balances
async function printAccountBalances(
  wallet1: Wallet,
  wallet2: Wallet
): Promise<void> {
  console.log(
    `Balance of ${wallet1.address} is ${await getAccountBalance(
      wallet1.address
    )} XRP`
  );
  console.log(
    `Balance of ${wallet2.address} is ${await getAccountBalance(
      wallet2.address
    )} XRP`
  );
}

// Function to authorize payments for a channel
async function channelAuthorize(params: {
  channelId: string;
  amount: string;
  seed: string;
}): Promise<string> {
  const { channelId, amount, seed } = params;

  // Extract the private key from the seed
  const wallet = Wallet.fromSeed(seed);

  // Convert drops to XRP for the signPaymentChannelClaim function
  // signPaymentChannelClaim expects the amount in XRP, not drops
  const amountInXRP = (parseInt(amount) / 1000000).toString();

  // Use the signPaymentChannelClaim function from xrpl.js
  const signature = signPaymentChannelClaim(
    channelId,
    amountInXRP,
    wallet.privateKey
  );

  // Return in the same format as the original function
  return signature;
}

// Function to setup wallets
async function setupWallets(): Promise<{ wallet1: Wallet; wallet2: Wallet }> {
  const { wallet: wallet1 } = await client.fundWallet();
  const { wallet: wallet2 } = await client.fundWallet();

  return { wallet1, wallet2 };
}

// Function to create a payment channel
async function createPaymentChannel(params: {
  payerWallet: Wallet;
  payeeWallet: Wallet;
  amount?: string;
  settleDelay?: number;
}): Promise<string> {
  const {
    payerWallet,
    payeeWallet,
    amount = "10000000",
    settleDelay = 86400,
  } = params;

  console.log("Submitting a PaymentChannelCreate transaction...");
  const paymentChannelCreateTx: PaymentChannelCreate = {
    TransactionType: "PaymentChannelCreate",
    Account: payerWallet.classicAddress,
    Amount: amount,
    Destination: payeeWallet.classicAddress,
    SettleDelay: settleDelay,
    PublicKey: payerWallet.publicKey,
  };

  // const paymentChannelCreateResponse = await signAndSubmit(
  //   paymentChannelCreateTx,
  //   payerWallet
  // );

  const paymentChannelCreateResponse = await client.submitAndWait(
    paymentChannelCreateTx,
    {
      wallet: payerWallet,
      autofill: true,
    }
  );
  console.log("PaymentChannelCreate transaction response:");
  console.log(paymentChannelCreateResponse);

  // Get transaction hash from the response
  // const txHash = paymentChannelCreateResponse.result.hash;

  // Wait for transaction to be validated and get details
  // const txDetails = await waitForTransaction(txHash, 5000);
  // console.log("Transaction details:", txDetails);

  // Find the Channel ID from the transaction metadata
  let channelId = extractChannelIdFromMetadata(
    paymentChannelCreateResponse.result.meta
  );

  // TODO:
  // Payee should do the following checks:
  // 1. Confirm the destination_account field has the payee's correct address.

  // 2. Confirm the settle_delay field has a settlement delay in seconds that
  // provides enough time for the payee to redeem outstanding claims.

  // 3. Confirm the fields cancel_after (immutable expiration) and
  // expiration (mutable expiration), if they are present, are not too
  // soon. The payee should take note of these times so they can be sure to
  // redeem claims before then.

  // Take note of the public_key and channel_id fields. These are
  // necessary later to verify and redeem claims.

  console.log("Channel ID:", channelId);

  // check that the object was actually created using account_objects
  const accountObjectsResponse = await client.request({
    command: "account_objects",
    account: payerWallet.classicAddress,
    ledger_index: "validated",
  });

  console.log(
    "Account Objects:",
    accountObjectsResponse.result.account_objects
  );

  return channelId;
}

// Function to extract channel ID from transaction metadata
function extractChannelIdFromMetadata(metadata: any): string {
  let channelId;
  if (metadata && metadata.AffectedNodes) {
    for (const node of metadata.AffectedNodes) {
      if (
        node.CreatedNode &&
        node.CreatedNode.LedgerEntryType === "PayChannel"
      ) {
        channelId = node.CreatedNode.LedgerIndex;
        break;
      }
    }
  }
  return channelId;
}

// Function for payer to create a payment channel claim
async function createPaymentChannelClaim(params: {
  channelId: string;
  amount: string;
  wallet: Wallet;
}): Promise<string> {
  const { channelId, amount, wallet } = params;

  // Create a claim for the specified amount
  const signature = await channelAuthorize({
    channelId,
    amount,
    seed: wallet.seed || "",
  });

  // Make sure we have a signature
  if (!signature) {
    throw new Error(
      `Failed to get signature from channel_authorize for amount ${amount}`
    );
  }

  return signature;
}

// Function for payee to verify a payment channel claim
async function verifyPaymentChannelClaim(params: {
  channelId: string;
  signature: string;
  publicKey: string;
  amount: string;
}): Promise<boolean> {
  const { channelId, signature, publicKey, amount } = params;

  // Use the client's request method with the proper types for channel_verify
  // Todo: optimize to just verify that the channel has enough funds one time
  // If i verify one time, can payee trust on this information?
  const verifyRequest: ChannelVerifyRequest = {
    command: "channel_verify",
    channel_id: channelId,
    signature: signature,
    public_key: publicKey,
    amount: amount,
  };

  // Send the request and specify the response type
  const verifyResponse: ChannelVerifyResponse = await client.request(
    verifyRequest
  );

  // From the docs
  // If the response shows "signature_verified": true then the claim's signature is genuine.
  // The payee must also confirm that the channel has enough XRP available to honor the claim.
  // To do this, the payee uses the account_channels method to confirm the most recent
  // validated state of the payment channel.

  // Return the verification result
  return verifyResponse.result.signature_verified === true;
}

// Function to claim a payment channel
async function claimPaymentChannel(params: {
  payeeWallet: Wallet;
  payerWallet: Wallet;
  channelId: string;
  amount: string;
  signature: string;
}): Promise<void> {
  const { payeeWallet, payerWallet, channelId, amount, signature } = params;

  // Claim the total amount using the final signature
  const paymentChannelClaimTx: PaymentChannelClaim = {
    Account: payeeWallet.classicAddress,
    TransactionType: "PaymentChannelClaim",
    Channel: channelId,
    Amount: amount,
    Balance: amount,
    Signature: signature,
    PublicKey: payerWallet.publicKey,
  };

  const channelClaimResponse = await client.submitAndWait(
    paymentChannelClaimTx,
    {
      wallet: payeeWallet,
      autofill: true,
    }
  );

  console.log("PaymentChannelClaim transaction response:");
  console.log(channelClaimResponse);

  // Check channel status after claim
  const channelsResponse = await client.request({
    command: "account_channels",
    account: payerWallet.classicAddress,
    destination_account: payeeWallet.classicAddress,
    ledger_index: "validated",
  });

  console.log("Channel status after claim:", channelsResponse);
}

// Function to close a payment channel
async function closePaymentChannel(params: {
  wallet: Wallet;
  channelId: string;
}): Promise<void> {
  const { wallet, channelId } = params;

  // Request to close the channel immediately (from the destination/payee account)
  const closeChannelTx: PaymentChannelClaim = {
    Account: wallet.classicAddress,
    TransactionType: "PaymentChannelClaim",
    Channel: channelId,
    Flags: 2147614720, // tfClose flag
  };

  const closeChannelResponse = await client.submitAndWait(closeChannelTx, {
    wallet: wallet,
    autofill: true,
  });
  // const closeChannelResponse = await signAndSubmit(closeChannelTx, wallet);
  console.log("Close channel response:", closeChannelResponse);

  // Wait for transaction to be validated
  // const txHash = closeChannelResponse.result.hash
}

// Function to check final status
async function checkFinalStatus(params: {
  payerWallet: Wallet;
  payeeWallet: Wallet;
  channelId: string;
}): Promise<void> {
  const { payerWallet, payeeWallet, channelId } = params;

  // Check final balances after attempting to close the channel
  console.log("Final balances after channel close request:");
  console.log(
    `Final balance of ${
      payerWallet.address
    } (payer) is ${await getAccountBalance(payerWallet.address)} XRP`
  );
  console.log(
    `Final balance of ${
      payeeWallet.address
    } (payee) is ${await getAccountBalance(payeeWallet.address)} XRP`
  );

  // Check if channel still exists
  const finalChannelsResponse = await client.request({
    command: "account_channels",
    account: payerWallet.classicAddress,
    destination_account: payeeWallet.classicAddress,
    ledger_index: "validated",
  });

  console.log("Channel status after close request:");
  if (
    finalChannelsResponse.result.channels &&
    finalChannelsResponse.result.channels.length > 0
  ) {
    console.log(
      "Channel still exists with properties:",
      finalChannelsResponse.result.channels[0]
    );
    if (finalChannelsResponse.result.channels[0].expiration) {
      console.log(
        `Channel will expire at: ${new Date(
          (finalChannelsResponse.result.channels[0].expiration + 946684800) *
            1000
        ).toISOString()}`
      );
    }
  } else {
    console.log("Channel has been fully closed and removed from the ledger");
  }
}
