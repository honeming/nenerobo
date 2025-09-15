/**
 * Cloudflare AI models autocomplete functionality
 */

/**
 * Fetch available AI models from Cloudflare API for autocomplete
 * @param {string} cloudflareToken - API token for Cloudflare
 * @param {string} search - Search query for model names
 * @returns {Promise<Array>} Array of model choices for Discord autocomplete
 */
export async function getModelChoices(cloudflareToken, search = '') {
  try {
    const url = new URL(
      'https://api.cloudflare.com/client/v4/accounts/1874968589d4e7ff695a5cce7250dfa6/ai/models/search',
    );
    url.searchParams.set('task', 'Text Generation');
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
      return getDefaultModelChoices(search);
    }

    return choices;
  } catch (error) {
    console.error('Error fetching models:', error);
    return getDefaultModelChoices(search);
  }
}

/**
 * Get default model choices as fallback
 * @param {string} search - Search query
 * @returns {Array} Array of default model choices
 */
function getDefaultModelChoices(search = '') {
  const defaultModels = [
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
