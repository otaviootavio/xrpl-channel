import { createPayer } from "./src/createPayer";
import { createPayee } from "./src/createPayee";
import { setupWallets } from "./src/utils/setupWallets";
import { printAccountBalances } from "./src/utils/printAccountBalances";
import { Client, unixTimeToRippleTime } from "xrpl";
import { checkFinalStatus } from "./src/utils/checkFinalStatus";

const remoteClient = new Client("wss://s.altnet.rippletest.net:51233");

// Main function to orchestrate the process
void main();

async function main(): Promise<void> {
  await remoteClient.connect();

  // Setup wallets
  const { wallet1, wallet2 } = await setupWallets(remoteClient);

  // Create payer and payee objects
  const payer = createPayer(remoteClient, wallet1);
  const payee = createPayee(remoteClient, wallet2);

  // Print initial balances
  console.log("Balances of wallets before Payment Channel is claimed:");
  await printAccountBalances({
    wallet1,
    wallet2,
    client: remoteClient,
  });

  // #1. The payer creates a payment channel to a particular recipient.
  // Also setup the imutable expiration
  console.log("Creating payment channel...");
  const channelId = await payer.createPaymentChannel({
    payeeClassicAddress: wallet2.classicAddress,
    amount: "10000000",
    settleDelay: 60 * 60, // 1 hour
    cancelAfter: unixTimeToRippleTime(Date.now() + 3 * 60 * 60 * 1000), // within the next 3 hours
  });
  console.log("Payment channel created:", channelId);

  // For some reason the Payer can add more funds and
  // set the Expiration time just after the channel creation
  // This is the *mutable* expiration
  // This must be later than either the current time plus the
  // SettleDelay of the channel, or the existing Expiration of the channel

  console.log("Creating payment channel fund...");
  const paymentChannelFundResponse = await payer.createPaymentChannelFund({
    channelId,
    amount: "69420",
    expiration: unixTimeToRippleTime(Date.now() + 2 * 60 * 60 * 1000), // within the next 2 hours
  });

  console.log(
    "Payment channel fund response:",
    paymentChannelFundResponse.result.hash
  );

  const channelStatus = await payee.validateChannel({
    channelId,
    payerClassicAddress: wallet1.classicAddress,
    expectedAmount: `${10000000 + 69420}`, // some how the payee must know the total amount after the payer fund it (websocket?)
    minSettleDelay: 60 * 60,
    minCancelAfter: unixTimeToRippleTime(Date.now() + 3 * 60 * 60 * 1000), // within the next hour
    minExpiration: unixTimeToRippleTime(Date.now() + 2 * 60 * 60 * 1000), // within the next 2 hours
  });

  if (!channelStatus.isValid) {
    console.error("Channel validation failed:", channelStatus.errors);
    await remoteClient.disconnect();
    return;
  }

  // Define payment amount in XRP and convert to drops
  const paymentAmountXRP = 0.04;
  const paymentAmountDrops = (paymentAmountXRP * 1000000).toString(); // 400000 drops
  let cumulativeAmountDrops = 0;
  let finalSignature = "";

  console.log(
    `Making 100 off-chain payments of ${paymentAmountXRP} XRP (${paymentAmountDrops} drops) each`
  );

  // Loop to simulate 100 off-chain payments
  for (let i = 0; i < 100; i++) {
    // Increase cumulative amount
    cumulativeAmountDrops += parseInt(paymentAmountDrops);
    const currentClaimAmount = cumulativeAmountDrops.toString();

    console.log(
      `Payer: Creating claim for payment ${
        i + 1
      } (${currentClaimAmount} drops)...`
    );

    // #3. The payer creates one or more signed claims for the XRP in the channel.
    finalSignature = await payer.createPaymentChannelClaim({
      channelId,
      amount: currentClaimAmount,
    });

    // #4. The payer sends a claim to the payee as payment for goods or services.

    // #5. The payee verifies the claim
    console.log(`Payee: Verifying claim for payment ${i + 1}...`);
    const verificationResult = await payee.verifyPaymentChannelClaim({
      channelId,
      signature: finalSignature,
      publicKey: wallet1.publicKey,
      amount: currentClaimAmount,
      payerClassicAddress: wallet1.classicAddress,
    });

    // #6. Payee provides goods or services.
    // #7. Repeat steps 3-6 as desired.

    console.log(
      `Payment ${i + 1}: Verified claim for ${currentClaimAmount} drops (${
        parseFloat(currentClaimAmount) / 1000000
      } XRP)`
    );
    console.log(
      `Verification result: ${
        verificationResult.isValid ? "Valid ✓" : "Invalid ✗"
      }`
    );

    if (!verificationResult.isValid) {
      console.error("Verification failed:", verificationResult.errors);
      break;
    }
  }

  console.log(
    `\nCompleted 10 off-chain payments totaling ${cumulativeAmountDrops} drops (${
      cumulativeAmountDrops / 1000000
    } XRP)`
  );
  console.log(`Final signature: ${finalSignature}`);

  // 8. PAYEE: Redeem claim
  // (PaymentChannelClaim transaction)
  // PAYEE receives XRP if channel isn't expired.
  //
  // 8a PAYEE's PaymentChannelClaim transaction did not use tfClose flag
  // -->
  // CAN GO BACK TO 3-6
  //
  // 8b PAYEE's PaymentChannelClaim transaction used tfClose flag
  // -->
  // Channel is closed and removed from ledger.
  // Unclaimed XRP is returned to payer

  // 9a PAYER: request to close channel
  // (PaymentChannelClaim transaction with tfClose flag)

  // 9a.1 Channel has XRP left; sets Expiration
  // -->
  // Mutable Expiration ("Expiration" field)
  // -->
  // Channel is expired
  // -->
  // 10. Anyone: close channel
  // (PaymentChannelClose or PaymentChannelFund transaction)
  // Channel is closed and removed from ledger.
  // Unclaimed XRP is returned to payer
  // -->

  // 9a.2 Channel has no XRP left; closes immediately
  // -->
  // Channel is closed and removed from ledger.
  // Unclaimed XRP is returned to payer

  // 9b. PAYEE: request to close channel
  // (PaymentChannelClaim transaction with tfClose flag)
  // -->
  // Channel is closed and removed from ledger.
  // Unclaimed XRP is returned to payer

  // #8 When ready, the payee redeems a claim for the authorized amount
  await payee.claimPaymentChannel({
    payerClassicAddress: wallet1.classicAddress,
    payerPublicKey: wallet1.publicKey,
    channelId,
    amount: cumulativeAmountDrops.toString(),
    signature: finalSignature,
  });

  // Check balances after claim
  console.log("Balances of wallets after Payment Channel is claimed:");
  await printAccountBalances({
    wallet1,
    wallet2,
    client: remoteClient,
  });

  // #9. When the payer and payee are done doing business,
  // the payee requests for the channel to be closed.
  await payee.closePaymentChannel({
    channelId,
  });

  // Check final status
  await checkFinalStatus({
    payerWallet: wallet1,
    payeeWallet: wallet2,
    client: remoteClient,
  });

  await remoteClient.disconnect();
}
