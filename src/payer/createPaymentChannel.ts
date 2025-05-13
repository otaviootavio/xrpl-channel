import {
  hashes,
  type Client,
  type PaymentChannelCreate,
  type Wallet,
} from "xrpl";

/**
 * Creates a payment channel on the XRP Ledger.
 *
 * @param payeeClassicAddress - The classic address of the payment channel recipient
 * @param amount - The amount of XRP to fund the channel with (in drops)
 * @param settleDelay - The time in seconds that the recipient must wait before closing the channel
 *                      after requesting to close it. This gives the sender time to dispute or
 *                      provide another claim if necessary.
 * @param client - An XRPL client instance
 * @param wallet - The sender's wallet that will fund the payment channel
 * @returns A Promise that resolves to the channel ID as a string
 */

export async function createPaymentChannel({
  payeeClassicAddress,
  amount,
  settleDelay,
  client,
  payerWallet,
  cancelAfter,
}: {
  payeeClassicAddress: string;
  amount: string;
  settleDelay: number;
  client: Client;
  payerWallet: Wallet;
  cancelAfter?: number;
}): Promise<string> {

  const paymentChannelCreateTx: PaymentChannelCreate = {
    TransactionType: "PaymentChannelCreate",
    Account: payerWallet.classicAddress,
    Amount: amount,
    Destination: payeeClassicAddress,
    SettleDelay: settleDelay,
    PublicKey: payerWallet.publicKey,
    CancelAfter: cancelAfter,
  };

  const paymentChannelCreateResponse = await client.submitAndWait(
    paymentChannelCreateTx,
    {
      wallet: payerWallet,
      autofill: true,
    }
  );

  // Get the sequence number from the validated transaction
  const sequence = paymentChannelCreateResponse.result.tx_json.Sequence;

  if (typeof sequence !== "number") {
    throw new Error(
      "No sequence number found in PaymentChannelCreate response"
    );
  }

  // Compute the channel ID
  const channelId = hashes.hashPaymentChannel(
    payerWallet.classicAddress,
    payeeClassicAddress,
    sequence
  );

  return channelId;
}
