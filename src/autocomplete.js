/**
 * Cloudflare AI models autocomplete functionality
 */

/**
 * Fetch available AI models from Cloudflare API for autocomplete
 * @param {string} cloudflareToken - API token for Cloudflare
 * @param {string} search - Search query for model names
 * @param {string} task - Task type: 'Text Generation' or 'Text-to-Image'
 * @returns {Promise<Array>} Array of model choices for Discord autocomplete
 */
export async function getModelChoices(
  cloudflareToken,
  search = '',
  task = 'Text Generation',
) {
  try {
    const url = new URL(
      'https://api.cloudflare.com/client/v4/accounts/1874968589d4e7ff695a5cce7250dfa6/ai/models/search',
    );
    url.searchParams.set('task', task);
    if (search) {
      url.searchParams.set('search', search);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${cloudflareToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(
        'Failed to fetch models:',
        response.status,
        response.statusText,
      );
      // Return some default models as fallback
      return getDefaultModelChoices(search);
    }

    const data = await response.json();

    if (!data.result || !Array.isArray(data.result)) {
      console.error('Invalid API response format:', data);
      return getDefaultModelChoices(search);
    }

    // Convert API response to Discord autocomplete format
    const choices = data.result
      .filter(
        (model) =>
          model.name && model.name.toLowerCase().includes(search.toLowerCase()),
      )
      .slice(0, 25) // Discord limits to 25 choices
      .map((model) => ({
        name: model.description || model.name,
        value: model.name,
      }));

    // If no results found, provide default models
    if (choices.length === 0) {
      return getDefaultModelChoices(search, task);
    }

    return choices;
  } catch (error) {
    console.error('Error fetching models:', error);
    return getDefaultModelChoices(search, task);
  }
}

/**
 * Get default model choices as fallback
 * @param {string} search - Search query
 * @param {string} task - Task type: 'Text Generation' or 'Text-to-Image'
 * @returns {Array} Array of default model choices
 */
function getDefaultModelChoices(search = '', task = 'Text Generation') {
  const defaultTextModels = [
    {
      name: 'Meta Llama 3.1 8B Instruct',
      value: '@cf/meta/llama-3.1-8b-instruct',
    },
    {
      name: 'Meta Llama 3.1 70B Instruct',
      value: '@cf/meta/llama-3.1-70b-instruct',
    },
    {
      name: 'Meta Llama 3.2 1B Instruct',
      value: '@cf/meta/llama-3.2-1b-instruct',
    },
    {
      name: 'Meta Llama 3.2 3B Instruct',
      value: '@cf/meta/llama-3.2-3b-instruct',
    },
    { name: 'Microsoft Phi 2', value: '@cf/microsoft/phi-2' },
    {
      name: 'Mistral 7B Instruct',
      value: '@cf/mistral/mistral-7b-instruct-v0.1',
    },
    { name: 'OpenChat 3.5', value: '@cf/openchat/openchat-3.5-0106' },
    { name: 'Qwen 1.5 0.5B Chat', value: '@cf/qwen/qwen1.5-0.5b-chat' },
    { name: 'Qwen 1.5 1.8B Chat', value: '@cf/qwen/qwen1.5-1.8b-chat' },
    { name: 'Qwen 1.5 7B Chat', value: '@cf/qwen/qwen1.5-7b-chat-awq' },
    { name: 'Qwen 1.5 14B Chat', value: '@cf/qwen/qwen1.5-14b-chat-awq' },
  ];

  const defaultImageModels = [
    {
      name: 'Stable Diffusion XL Base 1.0',
      value: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    },
    {
      name: 'Stable Diffusion XL Lightning',
      value: '@cf/bytedance/stable-diffusion-xl-lightning',
    },
    {
      name: 'Leonardo Lucid Origin 1.0',
      value: '@cf/leonardo/lucid-origin-1.0',
    },
    {
      name: 'DreamShaper 8 LCM',
      value: '@cf/lykon/dreamshaper-8-lcm',
    },
    {
      name: 'Stable Diffusion XL Turbo',
      value: '@cf/stabilityai/sdxl-turbo',
    },
  ];

  const defaultModels =
    task === 'Text-to-Image' ? defaultImageModels : defaultTextModels;

  if (!search) {
    return defaultModels.slice(0, 25);
  }

  const filtered = defaultModels.filter(
    (model) =>
      model.name.toLowerCase().includes(search.toLowerCase()) ||
      model.value.toLowerCase().includes(search.toLowerCase()),
  );

  return filtered.slice(0, 25);
}
