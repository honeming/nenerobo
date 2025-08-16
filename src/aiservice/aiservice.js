import { JsonResponse } from "../general";
import { InteractionResponseFlags } from 'discord-interactions';
import { InteractionResponseType } from 'discord-interactions';
import { generateText as cloudflareGenerateText } from './cloudflare.js';
export async function generateText(args, env) {
  // This function is a placeholder for generating text based on the prompt.
  // In a real implementation, you would call an AI service API here.
  const prompt = args.prompt;
  const service = args.service || 'cloudflare'; // Default to Cloudflare if not specified
  const model = args.model || 'default'; // Default to a generic model if not specified

  if (service === 'cloudflare') {
    const response = await cloudflareGenerateText(env.CLOUDFLARE_TOKEN, prompt, model);
    return new JsonResponse({type:InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,data:{
      content: `Usage: \n\`\`\`${JSON.stringify(response.usage,null,2)}\n\`\`\``,
      embeds: [
        {
          // title: "Generated Text",
          description: response.text
        }
      ]
    }});
  }

}

