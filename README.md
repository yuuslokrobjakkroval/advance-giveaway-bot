# Advanced Giveaway Bot

A Discord.js giveaway bot managed entirely through Discord. It supports configurable embeds, combined entry requirements, role multipliers, real invite credits, message statistics, automatic endings, rerolls, and MongoDB persistence.

## Features

- `/giveaway start` creates an ephemeral preview before anything is posted.
- `/giveaway config` opens an embed designer for text, images, colors, entry-button styling, bonus roles, and manager roles.
- Requirements can combine a role, tracked messages, daily message average, valid invites, account age, and server membership age.
- Bonus roles use integer multipliers from 1–100. If a member has several bonus roles, the highest multiplier applies.
- The draw creates a ticket for every entry multiplier and uses Node's cryptographic random number generator. Winners are selected without replacement.
- Eligibility is checked again at draw time; users who left the server or no longer qualify cannot win.
- A 15-second, restart-safe scheduler automatically ends giveaways. Atomic state claims prevent duplicate endings.
- Winners are announced in the giveaway channel and receive a DM when their privacy settings allow it.

## Setup

1. Install Node.js 20.19 or newer and MongoDB (local or hosted).
2. In the [Discord Developer Portal](https://discord.com/developers/applications), create an application and bot.
3. Enable the **Server Members Intent**. Message Content Intent is not needed because only message events—not content—are counted.
4. Invite the bot with the `bot` and `applications.commands` scopes. Give it:
   - View Channels
   - Send Messages
   - Embed Links
   - Read Message History
   - Manage Server, or Manage Channels in every invite-bearing channel (needed for invite usage snapshots)
5. Copy `.env.example` to `.env` and fill in the values.
6. Install, register commands, and start:

```sh
npm install
npm run register
npm start
```

Set `DISCORD_GUILD_ID` while developing for immediate guild command updates. Remove it and run `npm run register` again for global commands; global propagation can take time.

## Commands

- `/giveaway start prize duration winners [channel] [required_role] [min_messages] [daily_average] [min_invites] [account_age] [server_age]`
- `/giveaway end message_id`
- `/giveaway reroll message_id [winners]`
- `/giveaway config`

To copy a message ID, enable Discord Developer Mode, right-click the giveaway message, and choose **Copy Message ID**.

## Embed placeholders

`{prize}` `{winners}` `{entries}` `{host}` `{end_timestamp}` `{end_relative}` `{requirements}` `{server}` `{channel}` `{giveaway_id}`

## Tracking behavior and Discord limitation

Message totals begin when this bot first sees a member send a message. Daily average is `tracked messages ÷ elapsed tracking days` (minimum one day), so a one-day burst is diluted over time.

Discord's member-join event does not include the invite code. The bot compares invite-use snapshots immediately on each join, which is the standard reliable method and correctly reverses credit when that member leaves. Discord cannot guarantee exact attribution when multiple members join at nearly the same instant, when an invite is unavailable to the bot, or for joins through Server Discovery/vanity URLs. Ensure the bot can fetch all guild invites for the best accuracy.

## Operational notes

- Keep only one bot process running unless you add a distributed lock. Giveaway ending itself is atomically claimed, but invite snapshots are held in process memory.
- Pending previews and all active/ended giveaway data are persisted in MongoDB.
- Rerolls exclude every previously selected winner and recheck eligibility.
- Run `npm test` and `npm run check` after changes.
# advance-giveaway-bot
