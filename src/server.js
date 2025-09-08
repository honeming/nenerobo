/**
 * The core server that runs on a Cloudflare worker.
 */

import { AutoRouter } from 'itty-router';
import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import { COMMANDS } from './commands.js';
import { timecode } from './discordtools.js';
import { JsonResponse } from './general.js';
import { generateText,generateResponse } from './aiservice/aiservice.js';
import { InteractionResponseFlags } from 'discord-interactions';

const router = AutoRouter();

/**
 * A simple :wave: hello page to verify the worker is working.
 */
router.get('/', (request, env) => {
  return Response.redirect(`https://discord.com/developers/applications/${env.DISCORD_APPLICATION_ID}/information`,301);
});

/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
router.post('/', async (request, env, ctx) => {
  const { isValid, interaction } = await server.verifyDiscordRequest(
    request,
    env,
  );
  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  if (interaction.type === InteractionType.PING) {
    // The `PING` message is used during the initial webhook handshake, and is
    // required to configure the webhook in the developer portal.
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    var args = {};
    if (interaction.data.options) {
      interaction.data.options.forEach((i, index, array) => {
        Object.defineProperty(args, i.name, {
          value: i.value,
          writable: false,
        });
      })
    }
    switch (interaction.data.name.toLowerCase()) {
      case 'timecode': {
        // The `timecode` command is used to convert a time or seconds into a Discord
        // timecode format.
        return timecode(args);
      }
      case 'generate-text': {
        // The `generate-text` command is used to generate text based on a prompt.
        // It can use different AI services and models.
        ctx.waitUntil(generateText(args, env, interaction));
        return new JsonResponse({type:InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE});
      }
      case 'generate-response': {
        // The `generate-response` command is used to generate a response.
        if (interaction.channel.thread_metadata) {
          ctx.waitUntil(generateResponse(args, env, interaction));
          return new JsonResponse({type:InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,data:{content:"正在準備..."}});
        }else{
          return new JsonResponse({type:InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,data:{content:"這個指令只能在貼文中使用"}});
        }
      }
      default:
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '# 糟糕！出了一點問題！\n如果你看到這則訊息，表示你想使用的指令在正式發佈的版本上可能**尚未完全啟用或完全移除**。\n請**不要**再次嘗試使用這個指令，並靜待後續的更新。',
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
    }
  } else if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    
  }

  console.error('Unknown Type');
  console.log(JSON.stringify(interaction, undefined, 2))
  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
});
router.all('*', () => new Response('Not Found.', { status: 404 }));

async function verifyDiscordRequest(request, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body), isValid: true };
}

const server = {
  verifyDiscordRequest,
  fetch: router.fetch,
};

export default server;
