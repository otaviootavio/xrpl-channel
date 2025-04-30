import {
  rippleTimeToISOTime,
  rippleTimeToUnixTime,
  type Channel,
  type Client,
  type Wallet,
} from "xrpl";
import { getChannelStatus } from "../utils/getChannelStatus";

export async function validateChannel({
  channelId,
  payerClassicAddress,
  expectedAmount,
  minSettleDelay,
  client,
  wallet,
}: {
  channelId: string;
  payerClassicAddress: string;
  expectedAmount: string;
  minSettleDelay: number;
  client: Client;
  wallet: Wallet;
}): Promise<{
  isValid: boolean;
  errors: string[];
  channelInfo?: Channel;
}> {
  const errors: string[] = [];

  try {
    // Get channel information
    const channel = await getChannelStatus({
      channelId,
      payerClassicAddress,
      client,
      wallet,
    });

    // 1. Confirm the destination_account field has the payee's correct address
    if (channel.destination_account !== wallet.classicAddress) {
      errors.push(
        `Destination account mismatch: expected ${wallet.classicAddress}, got ${channel.destination_account}`
      );
    }

    // 2. Confirm the settle_delay field has a proper value
    if (channel.settle_delay < minSettleDelay) {
      errors.push(
        `Settle delay too short: ${channel.settle_delay} seconds (minimum required: ${minSettleDelay})`
      );
    }

    // 3. Check expiration times
    if (channel.cancel_after) {
      const cancelTime = new Date(rippleTimeToUnixTime(channel.cancel_after));
      if (cancelTime.getTime() < Date.now() + 3600000) {
        // Within the next hour
        errors.push(
          `Immutable expiration (cancel_after) is too soon: ${rippleTimeToISOTime(
            channel.cancel_after
          )}`
        );
      }
    }

    if (channel.expiration) {
      const expirationTime = new Date(rippleTimeToUnixTime(channel.expiration));
      if (expirationTime.getTime() < Date.now() + 3600000) {
        // Within the next hour
        errors.push(
          `Mutable expiration is too soon: ${rippleTimeToISOTime(
            channel.expiration
          )}`
        );
      }
    }

    // 4. Check amount
    if (channel.amount !== expectedAmount) {
      errors.push(
        `Channel amount mismatch: expected ${expectedAmount}, got ${channel.amount}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      channelInfo: channel,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
