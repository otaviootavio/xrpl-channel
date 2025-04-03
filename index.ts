/*
 * Create, claim and verify a Payment Channel.
 * Reference: https://xrpl.org/paychannel.html
 */
import {
  Client,
  Wallet,
  signPaymentChannelClaim,
} from "xrpl";
import fetch from "node-fetch";
import * as crypto from "crypto";

// Import the request and response types for channel_verify
import type { ChannelVerifyRequest, ChannelVerifyResponse } from "xrpl";

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
    payeeWallet: wallet2
  });
  
  // Perform off-chain transactions
  const { cumulativeAmountDrops, finalSignature } = await performOffChainTransactions({
    channelId,
    wallet: wallet1
  });
  
  // Claim payment channel
  await claimPaymentChannel({
    payeeWallet: wallet2,
    payerWallet: wallet1,
    channelId,
    amount: cumulativeAmountDrops,
    signature: finalSignature
  });
  
  // Check balances after claim
  console.log("Balances of wallets after Payment Channel is claimed:");
  await printAccountBalances(wallet1, wallet2);
  
  // Close the channel
  await closePaymentChannel({
    wallet: wallet2,
    channelId
  });
  
  // Check final status
  await checkFinalStatus({
    payerWallet: wallet1,
    payeeWallet: wallet2,
    channelId
  });
  
  await client.disconnect();
}

// Function to make raw JSON-RPC calls
async function sendJsonRpc(method: string, params: any): Promise<any> {
  const response = await fetch(TESTNET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method,
      params: [params],
    }),
  });

  return response.json();
}

// Function to sign and submit a transaction
async function signAndSubmit(tx: any, wallet: Wallet): Promise<any> {
  // Prepare transaction with auto-fillable fields
  const prepared = await client.autofill(tx);

  // Sign the transaction locally
  const signed = wallet.sign(prepared);

  // Submit the signed transaction blob
  return sendJsonRpc("submit", {
    tx_blob: signed.tx_blob,
  });
}

// Function to wait for transaction confirmation
async function waitForTransaction(txHash: string, timeoutMs: number = 10000): Promise<any> {
  console.log(`Waiting for transaction ${txHash} to be validated...`);
  await new Promise((resolve) => setTimeout(resolve, timeoutMs));
  
  const txDetails = await sendJsonRpc("tx", {
    transaction: txHash,
  });
  
  return txDetails;
}

// Function to get account balance
async function getAccountBalance(address: string): Promise<string> {
  return (await client.getXrpBalance(address)).toString();
}

// Function to print account balances
async function printAccountBalances(wallet1: Wallet, wallet2: Wallet): Promise<void> {
  console.log(`Balance of ${wallet1.address} is ${await getAccountBalance(wallet1.address)} XRP`);
  console.log(`Balance of ${wallet2.address} is ${await getAccountBalance(wallet2.address)} XRP`);
}

// Function to authorize payments for a channel
async function channelAuthorize(
  params: {
    channelId: string;
    amount: string;
    seed: string;
  }
): Promise<any> {
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
  return {
    result: {
      signature: signature
    }
  };
}

// Function to setup wallets
async function setupWallets(): Promise<{ wallet1: Wallet; wallet2: Wallet }> {
  const { wallet: wallet1 } = await client.fundWallet();
  const { wallet: wallet2 } = await client.fundWallet();
  
  return { wallet1, wallet2 };
}

// Function to create a payment channel
async function createPaymentChannel(
  params: {
    payerWallet: Wallet;
    payeeWallet: Wallet;
    amount?: string;
    settleDelay?: number;
  }
): Promise<string> {
  const { payerWallet, payeeWallet, amount = "10000000", settleDelay = 86400 } = params;
  
  console.log("Submitting a PaymentChannelCreate transaction...");
  const paymentChannelCreateTx = {
    TransactionType: "PaymentChannelCreate",
    Account: payerWallet.classicAddress,
    Amount: amount,
    Destination: payeeWallet.classicAddress,
    SettleDelay: settleDelay,
    PublicKey: payerWallet.publicKey,
  };

  const paymentChannelCreateResponse = await signAndSubmit(
    paymentChannelCreateTx,
    payerWallet
  );
  console.log("PaymentChannelCreate transaction response:");
  console.log(paymentChannelCreateResponse);

  // Get transaction hash from the response
  const txHash = paymentChannelCreateResponse.result.tx_blob
    ? paymentChannelCreateResponse.result.tx_json.hash
    : paymentChannelCreateResponse.result.hash;

  // Wait for transaction to be validated and get details
  const txDetails = await waitForTransaction(txHash, 5000);
  console.log("Transaction details:", txDetails);

  // Find the Channel ID from the transaction metadata
  let channelId = extractChannelIdFromMetadata(txDetails);
  console.log("Channel ID:", channelId);

  // check that the object was actually created using account_objects
  const accountObjectsResponse = await sendJsonRpc("account_objects", {
    account: payerWallet.classicAddress,
  });

  console.log(
    "Account Objects:",
    accountObjectsResponse.result.account_objects
  );
  
  return channelId;
}

// Function to extract channel ID from transaction metadata
function extractChannelIdFromMetadata(txDetails: any): string {
  let channelId;
  if (txDetails.result.meta && txDetails.result.meta.AffectedNodes) {
    for (const node of txDetails.result.meta.AffectedNodes) {
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

// Function to verify a payment channel claim
async function verifyPaymentChannelClaim(
  params: {
    channelId: string;
    signature: string;
    publicKey: string;
    amount: string;
  }
): Promise<boolean> {
  const { channelId, signature, publicKey, amount } = params;
  
  // Use the client's request method with the proper types for channel_verify
  const verifyRequest: ChannelVerifyRequest = {
    command: 'channel_verify',
    channel_id: channelId,
    signature: signature,
    public_key: publicKey,
    amount: amount,
  };
  
  // Send the request and specify the response type
  const verifyResponse = await client.request(verifyRequest) as ChannelVerifyResponse;
  
  // Return the verification result
  return verifyResponse.result.signature_verified === true;
}

// Function to perform off-chain transactions
async function performOffChainTransactions(
  params: {
    channelId: string;
    wallet: Wallet;
  }
): Promise<{ cumulativeAmountDrops: string; finalSignature: string }> {
  const { channelId, wallet } = params;
  
  // Define payment amount in XRP and convert to drops
  const paymentAmountXRP = 0.4;
  const paymentAmountDrops = (paymentAmountXRP * 1000000).toString(); // 400000 drops
  let cumulativeAmountDrops = 0;
  let finalSignature = "";

  console.log(
    `Making 100 off-chain payments of ${paymentAmountXRP} XRP (${paymentAmountDrops} drops) each`
  );

  // Loop to simulate 100 off-chain payments
  for (let i = 0; i < 10; i++) {
    // Increase cumulative amount
    cumulativeAmountDrops += parseInt(paymentAmountDrops);
    const currentClaimAmount = cumulativeAmountDrops.toString();

    // Create a claim for the current cumulative amount
    const authorizeResponse = await channelAuthorize({
      channelId,
      amount: currentClaimAmount,
      seed: wallet.seed || "",
    });

    // Make sure we have a signature
    if (!authorizeResponse.result || !authorizeResponse.result.signature) {
      throw new Error(
        `Failed to get signature from channel_authorize for payment ${i + 1}`
      );
    }

    // Store the signature
    finalSignature = authorizeResponse.result.signature;

    // Verify the claim
    const isVerified = await verifyPaymentChannelClaim({
      channelId,
      signature: finalSignature,
      publicKey: wallet.publicKey,
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
    `\nCompleted 100 off-chain payments totaling ${cumulativeAmountDrops} drops (${
      cumulativeAmountDrops / 1000000
    } XRP)`
  );
  console.log(`Final signature: ${finalSignature}`);
  
  return { cumulativeAmountDrops: cumulativeAmountDrops.toString(), finalSignature };
}

// Function to claim a payment channel
async function claimPaymentChannel(
  params: {
    payeeWallet: Wallet;
    payerWallet: Wallet; 
    channelId: string;
    amount: string;
    signature: string;
  }
): Promise<void> {
  const { payeeWallet, payerWallet, channelId, amount, signature } = params;
  
  // Claim the total amount using the final signature
  const paymentChannelClaimTx = {
    Account: payeeWallet.classicAddress,
    TransactionType: "PaymentChannelClaim",
    Channel: channelId,
    Amount: amount,
    Balance: amount,
    Signature: signature,
    PublicKey: payerWallet.publicKey,
  };

  const channelClaimResponse = await signAndSubmit(
    paymentChannelClaimTx,
    payeeWallet
  );
  console.log("PaymentChannelClaim transaction response:");
  console.log(channelClaimResponse);

  // Wait for transaction to be validated
  const txHash = channelClaimResponse.result.tx_blob
    ? channelClaimResponse.result.tx_json.hash
    : channelClaimResponse.result.hash;
  
  await waitForTransaction(txHash);

  // Check channel status after claim
  const channelsResponse = await sendJsonRpc("account_channels", {
    account: payerWallet.classicAddress,
    destination_account: payeeWallet.classicAddress,
    ledger_index: "validated",
  });

  console.log("Channel status after claim:", channelsResponse);
}

// Function to close a payment channel
async function closePaymentChannel(
  params: {
    wallet: Wallet;
    channelId: string;
  }
): Promise<void> {
  const { wallet, channelId } = params;
  
  // Request to close the channel immediately (from the destination/payee account)
  const closeChannelTx = {
    Account: wallet.classicAddress,
    TransactionType: "PaymentChannelClaim",
    Channel: channelId,
    Flags: 2147614720, // tfClose flag
  };

  const closeChannelResponse = await signAndSubmit(closeChannelTx, wallet);
  console.log("Close channel response:", closeChannelResponse);
  
  // Wait for transaction to be validated
  const txHash = closeChannelResponse.result.tx_blob
    ? closeChannelResponse.result.tx_json.hash
    : closeChannelResponse.result.hash;
  
  await waitForTransaction(txHash, 5000);
}

// Function to check final status
async function checkFinalStatus(
  params: {
    payerWallet: Wallet;
    payeeWallet: Wallet;
    channelId: string;
  }
): Promise<void> {
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
  const finalChannelsResponse = await sendJsonRpc("account_channels", {
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
