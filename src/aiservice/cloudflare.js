export async function generateText(key, prompt, model, onResponse, onUsage) {
  // console.log('生成文本的參數:', { prompt, model, messages });
  if (prompt[0].content !== '') {
    prompt[0].role = 'system';
  }
  let stream;
  try {
    stream = await fetch(
      'https://gateway.ai.cloudflare.com/v1/1874968589d4e7ff695a5cce7250dfa6/nenerobo/workers-ai/' +
        model,
      {
        headers: {
          Authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          messages: prompt,
          stream: true,
          max_tokens: 4096,
          // "reasoning": "high"
        }),
      },
    );
  } catch (err) {
    console.error('AI.run 發生錯誤:', err);
    throw err;
  }
  if (!stream.ok) {
    const errorBody = await stream.json();
    if (errorBody?.errors?.[0]?.code == 5021) {
      // 從錯誤訊息擷取數字，並根據超出量調整 max_tokens
      const errMsg =
        errorBody?.errors?.[0]?.message ||
        errorBody?.errors?.[0]?.messages ||
        JSON.stringify(errorBody);
      const parenNums = [...errMsg.matchAll(/\((\d+)\)/g)].map((m) =>
        Number(m[1]),
      );
      const origMax = 4096;
      let adjustedMax = null;

      if (parenNums.length >= 2) {
        const sumTokens = parenNums[0]; // 例: 4104 (estimated input + requested max)
        const modelLimit = parenNums[1]; // 例: 4096 (model context limit)
        const overage = Math.max(0, sumTokens - modelLimit);
        adjustedMax = Math.max(1, origMax - overage); // 至少保留 1 token
      } else {
        // 解析失敗時，退而求其次，稍微減少原始 max（例如減 32）
        adjustedMax = Math.max(1, origMax - 32);
        console.warn(
          '無法從錯誤訊息解析 token 數，使用 fallback max_tokens:',
          adjustedMax,
          '訊息:',
          errMsg,
        );
      }

      // 重新發出請求，使用計算出的 adjustedMax
      stream = await fetch(
        'https://gateway.ai.cloudflare.com/v1/1874968589d4e7ff695a5cce7250dfa6/nenerobo/workers-ai/' +
          model,
        {
          headers: {
            Authorization: `Bearer ${key}`,
            'content-type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({
            messages: prompt,
            stream: true,
            max_tokens: adjustedMax,
          }),
        },
      );
    }
  }
  const transformContent = {};
  if (!stream.body || !stream.body.getReader) {
    throw new Error('Response does not support streaming');
  }
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  transformContent.text = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Process any complete lines (NDJSON / SSE lines). Keep remainder in buffer.
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;
        // Remove possible SSE "data: " prefix
        if (line.startsWith('data: ')) {
          line = line.slice(6);
        }
        if (line === '[DONE]') continue;

        try {
          const chunk = JSON.parse(line);
          const text = chunk?.response;
          if (typeof text === 'string') {
            transformContent.text += text;
            // 立即回調新的文字內容
            if (onResponse) {
              try {
                await onResponse(text);
              } catch (callbackErr) {
                console.error('onResponse 回調函數發生錯誤:', callbackErr);
              }
            }
          } else {
            // 嘗試從 chunk 中找出 usage 資訊
            const tryAssignUsage = (obj) => {
              if (!obj || typeof obj !== 'object') return null;
              if (
                typeof obj.prompt_tokens === 'number' &&
                typeof obj.completion_tokens === 'number' &&
                typeof obj.total_tokens === 'number'
              ) {
                return {
                  prompt_tokens: obj.prompt_tokens,
                  completion_tokens: obj.completion_tokens,
                  total_tokens: obj.total_tokens,
                };
              }
              for (const k of Object.keys(obj)) {
                const found = tryAssignUsage(obj[k]);
                if (found) return found;
              }
              return null;
            };

            if (chunk?.usage && typeof chunk.usage === 'object') {
              transformContent.usage =
                tryAssignUsage(chunk.usage) || chunk.usage;
              // 立即回調 usage 資訊
              if (onUsage && transformContent.usage) {
                try {
                  await onUsage(transformContent.usage);
                } catch (callbackErr) {
                  console.error('onUsage 回調函數發生錯誤:', callbackErr);
                }
              }
            }
            if (chunk?.response && typeof chunk.response === 'object') {
              // 有時 response 會是一個物件，裡面包含 usage
              transformContent.usage = tryAssignUsage(chunk.response) || null;
              if (onUsage && transformContent.usage) {
                try {
                  await onUsage(transformContent.usage);
                } catch (callbackErr) {
                  console.error('onUsage 回調函數發生錯誤:', callbackErr);
                }
              }
            } else {
              // 最後嘗試在整個 chunk 裡遞迴尋找 usage-like 物件
              const found = tryAssignUsage(chunk);
              if (found) {
                transformContent.usage = found;
                if (onUsage) {
                  try {
                    await onUsage(found);
                  } catch (callbackErr) {
                    console.error('onUsage 回調函數發生錯誤:', callbackErr);
                  }
                }
              } else {
                // 如果 chunk 中包含 tool_calls，就不要發出警告
                const hasToolCalls = (obj) => {
                  if (!obj || typeof obj !== 'object') return false;
                  if (Object.prototype.hasOwnProperty.call(obj, 'tool_calls'))
                    return true;
                  for (const k of Object.keys(obj)) {
                    if (hasToolCalls(obj[k])) return true;
                  }
                  return false;
                };

                if (!hasToolCalls(chunk)) {
                  console.warn(
                    'chunk 結構異常，未找到 response 或 usage:',
                    chunk,
                  );
                }
              }
            }
          }
        } catch (e) {
          // If this line is not a complete JSON yet (split across chunks), put it back into buffer head
          // so it will be combined with the next chunk.
          buffer = line + '\n' + buffer;
          break; // exit line-processing loop and wait for more data
        }
      }
    }

    // Stream ended — try to parse any remaining buffered data
    if (buffer.trim()) {
      let leftover = buffer.trim();
      if (leftover.startsWith('data: ')) leftover = leftover.slice(6);
      if (leftover !== '[DONE]') {
        try {
          const chunk = JSON.parse(leftover);
          const text = chunk?.response;
          if (typeof text === 'string') {
            transformContent.text += text;
          } else {
            console.warn('最後一個 chunk 結構異常，未找到 response:', chunk);
          }
        } catch (e) {
          console.error(
            '無法解析最終緩衝內容，可能仍為不完整的 JSON:',
            leftover,
            e,
          );
        }
      }
    }
  } catch (err) {
    console.error('stream 發生錯誤:', err);
    throw err;
  }
  return transformContent;
}

export async function textToImage(key, prompt, model) {
  let stream;
  try {
    stream = await fetch(
      'https://gateway.ai.cloudflare.com/v1/1874968589d4e7ff695a5cce7250dfa6/nenerobo/workers-ai/' +
        model,
      {
        headers: {
          Authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt,
          height: 2048,
          width: 2048,
        }),
      },
    );
  } catch (err) {
    console.error('AI.run 發生錯誤:', err);
    throw err;
  }
}
