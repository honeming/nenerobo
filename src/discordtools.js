import {
  InteractionResponseType,
  InteractionType,
  InteractionResponseFlags,
} from 'discord-interactions';

import { JsonResponse } from './general.js';

function formatDiscordTimecode(timestamp, style = 'F') {
  return `<t:${Math.floor(timestamp)}:${style}>`;
}

/**
 * Converts a time or seconds input into a Discord timecode format.
 * @param {Object} args - The arguments object.
 * @param {string|number} args.time - The time input, either as a date string or seconds.
 * @returns {JsonResponse} The response containing the formatted Discord timecode.
 */
export function timecode(args){
            // The `timecode` command is used to convert a time or seconds into a Discord
            // timecode format.
            if (!args.time) {
              return new JsonResponse({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: '請提供要轉換的時間或秒數。',
                  flags: InteractionResponseFlags.EPHEMERAL,
                },
              });
            } 
            // If input is a numeric string, treat as Unix timestamp (seconds)
            if (/^\d+(\.\d+)?$/.test(args.time)) {
              const seconds = parseFloat(args.time);
              if (isNaN(seconds)) {
                return new JsonResponse({
                  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                  data: {
                    content: '請提供有效的時間或秒數。',
                    flags: InteractionResponseFlags.EPHEMERAL,
                  },
                });
              }
              // Treat as absolute Unix timestamp if it's a large number (e.g., > 10^9), otherwise as offset from now
              const nowSec = Math.floor(Date.now() / 1000);
              const content =
                seconds > 1000000000
                  ? formatDiscordTimecode(seconds, 'F')
                  : formatDiscordTimecode(nowSec + seconds, 'R');
              return new JsonResponse({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content,
                },
              });
            }
            // Otherwise, try to parse as date string
            const time = new Date(args.time);
            if (isNaN(time.getTime())) {
              return new JsonResponse({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: '請提供有效的時間或秒數。',
                  flags: InteractionResponseFlags.EPHEMERAL,
                },
              });
            }
            // Convert date to Discord timecode format.
            return new JsonResponse({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: formatDiscordTimecode(time.getTime() / 1000, 'F'),
              },
            });
}