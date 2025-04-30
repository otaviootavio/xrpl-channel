import { rippleTimeToISOTime, rippleTimeToUnixTime } from "xrpl";

import type {
  ChannelVerifyRequest,
  ChannelVerifyResponse,
  Client,
  Wallet,
} from "xrpl";
import { getChannelStatus } from "../utils/getChannelStatus";

export async function verifyPaymentChannelClaim({
  channelId,
  signature,
  publicKey,
  xrpAmount,
  payerClassicAddress,
  client,
  wallet,
}: {
  channelId: string;
  signature: string;
  publicKey: string;
  xrpAmount: string;
  payerClassicAddress: string;
  client: Client;
  wallet: Wallet;
}): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // 1. Verify the signature using channel_verify
    const verifyRequest: ChannelVerifyRequest = {
      command: "channel_verify",
      channel_id: channelId,
      signature: signature,
      public_key: publicKey,
      amount: xrpAmount,
    };

    const verifyResponse: ChannelVerifyResponse = await client.request(
      verifyRequest
    );

    if (!verifyResponse.result.signature_verified) {
      errors.push("Signature verification failed");
      return { isValid: false, errors };
    }

    // 2. Check if the channel has enough XRP available
    // Always fetch fresh channel data for each verification
    const channel = await getChannelStatus({
      channelId,
      payerClassicAddress,
      client,
      wallet,
    });

    // Check if claim amount exceeds channel capacity
    const amountValue = parseInt(xrpAmount);
    if (amountValue > parseInt(channel.amount)) {
      errors.push(
        `Claim amount ${xrpAmount} exceeds channel capacity ${channel.amount}`
      );
    }

    // Check if channel is expired
    if (channel.expiration) {
      const expirationTime = new Date(rippleTimeToUnixTime(channel.expiration));
      if (expirationTime.getTime() < Date.now()) {
        errors.push(
          `Channel has already expired at ${rippleTimeToISOTime(
            channel.expiration
          )}`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
