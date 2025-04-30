import type { Client, PaymentChannelClaim, Wallet } from "xrpl";

export async function claimPaymentChannel({
  payerPublicKey,
  channelId,
  amount,
  signature,
  wallet,
  client,
}: {
  payerClassicAddress: string;
  payerPublicKey: string;
  channelId: string;
  amount: string;
  signature: string;
  wallet: Wallet;
  client: Client;
}): Promise<void> {
  // Claim the total amount using the final signature

  // Mount the transaction
  const paymentChannelClaimTx: PaymentChannelClaim = {
    Account: wallet.classicAddress,
    TransactionType: "PaymentChannelClaim",
    Channel: channelId,
    Amount: amount,
    Balance: amount,
    Signature: signature,
    PublicKey: payerPublicKey,
  };

  // Submit the transaction
  const channelClaimResponse = await client.submitAndWait(
    paymentChannelClaimTx,
    {
      wallet: wallet,
      autofill: true,
    }
  );
}
