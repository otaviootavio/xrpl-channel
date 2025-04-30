import type {
  AccountChannelsRequest,
  AccountChannelsResponse,
  Client,
  Wallet,
} from "xrpl";

export async function getChannelStatus({
  channelId,
  payerClassicAddress,
  client,
  wallet,
}: {
  channelId: string;
  payerClassicAddress: string;
  client: Client;
  wallet: Wallet;
}) {
  const channelsRequest: AccountChannelsRequest = {
    command: "account_channels",
    account: payerClassicAddress,
    destination_account: wallet.classicAddress,
    ledger_index: "validated",
  };

  const channelsResponse: AccountChannelsResponse = await client.request(
    channelsRequest
  );

  if (
    !channelsResponse.result.channels ||
    channelsResponse.result.channels.length === 0
  ) {
    throw new Error(`Channel ${channelId} not found`);
  }

  const channel = channelsResponse.result.channels.find(
    (c) => c.channel_id === channelId
  );

  if (!channel) {
    throw new Error(`Channel ${channelId} not found in the response`);
  }

  return channel;
}
