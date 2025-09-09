import { JsonResponse } from '../general';
import { InteractionResponseFlags } from 'discord-interactions';
import { InteractionResponseType } from 'discord-interactions';
import { generateText as cloudflareGenerateText } from './cloudflare.js';
export async function generateText(args, env, interaction) {
  // This function is a placeholder for generating text based on the prompt.
  // In a real implementation, you would call an AI service API here.
  let messages;
  if (args.prompt) {
    messages = [
      { role: 'user', content: '' },
      { role: 'user', content: args.prompt },
    ];
  } else {
    messages = args.messages;
  }
  const service = args.service || 'cloudflare'; // Default to Cloudflare if not specified
  const model = args.model || 'default'; // Default to a generic model if not specified
  // console.log(model,messages);

  let currentText = '';
  let usageInfo = null;
  let lastUpdateTime = Date.now();
  const UPDATE_INTERVAL = 5000; // 每五秒更新一次，避免頻繁更新 Discord 訊息

  // 處理新的文字內容
  const handleResponse = async (newText) => {
    currentText += newText;
    const now = Date.now();

    // 節流更新，避免過於頻繁的 Discord API 呼叫
    if (now - lastUpdateTime >= UPDATE_INTERVAL) {
      await updateDiscordMessage(
        env,
        interaction,
        currentText,
        usageInfo,
        false,
      );
      lastUpdateTime = now;
    }
  };

  // 處理 usage 資訊
  const handleUsage = async (usage) => {
    usageInfo = usage;
    console.log('收到 usage 資訊:', usage);
  };

  let response;
  if (service === 'cloudflare') {
    response = await cloudflareGenerateText(
      env.CLOUDFLARE_TOKEN,
      messages,
      model,
      handleResponse,
      handleUsage,
    );
  }

  // 最終更新，確保所有內容都被發送
  await updateDiscordMessage(
    env,
    interaction,
    service,
    model,
    response.text,
    response.usage,
    true,
  );

  return new JsonResponse({ ok: true });
}

export async function generateResponse(args, env, interaction) {
  const service = args.service || 'cloudflare'; // Default to Cloudflare if not specified
  const model = args.model || 'default'; // Default to a generic model if not specified
  const response = await fetch(
    `https://discord.com/api/v10/channels/${interaction.channel_id}/messages`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${env.DISCORD_API_TOKEN}`,
      },
    },
  );
  let raw_messages = await response.json();
  let messages = raw_messages.map((message) => {
    // Safely access embeds and content to avoid runtime errors when fields are missing
    const embedDesc = message?.embeds?.[0]?.description ?? '';
    const content = message?.content ?? '';
    if (message?.author?.bot) {
      return { role: 'assistant', content: embedDesc || content };
    } else {
      return { role: 'user', content: content || embedDesc };
    }
  });
  messages.reverse();
  if (messages.slice(-1).role == 'assistant') {
    messages.pop(); // 移除最後一則訊息，因為那是機器人自己的訊息
  }

  Object.defineProperty(args, 'messages', {
    value: messages,
    writable: false,
  });
  return await generateText(args, env, interaction);
}

export async function generateImage(args, env, interaction) {
  // This function is a placeholder for generating an image based on the prompt.
  // In a real implementation, you would call an AI service API here.
  const prompt = args.prompt;
  const service = args.service || 'cloudflare'; // Default to Cloudflare if not specified
  const model = args.model || 'default'; // Default to a generic model if not specified

  console.log(
    `Generating image with prompt: ${prompt}, service: ${service}, model: ${model}`,
  );

  // Simulate image generation delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const imageUrl = `https://example.com/generated-image?prompt=${encodeURIComponent(prompt)}&service=${service}&model=${model}`;

  return new JsonResponse({ imageUrl });
}

// 更新 Discord 訊息的輔助函數
async function updateDiscordMessage(
  env,
  interaction,
  service,
  model,
  text,
  usage,
  isFinal,
) {
  const content = usage
    ? `Usage: \n\`\`\`${JSON.stringify(usage, null, 2)}\n\`\`\``
    : '';
  const status = isFinal ? '' : ' ⏳ 生成中...';

  try {
    await fetch(
      `https://discord.com/api/v10/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content,
          embeds: [
            {
              description: text + status,
              footer: {
                text: `使用的服務: ${service} 模型: ${model}`,
              },
            },
          ],
        }),
      },
    );
  } catch (error) {
    console.error('更新 Discord 訊息時發生錯誤:', error);
  }
}
