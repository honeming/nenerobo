export async function generateText(key,prompt, model){
  const messages = [
    {
      role: 'user',
      content: prompt
    }
  ];
  // console.log('生成文本的參數:', { prompt, model, messages });
  let stream;
  try {
    stream = await fetch("https://gateway.ai.cloudflare.com/v1/1874968589d4e7ff695a5cce7250dfa6/nenerobo/workers-ai/@cf/meta/llama-3.1-8b-instruct",{
      headers: {
        "Authorization": `Bearer ${key}`,
        "content-type": "application/json"
      },
      method: "POST",
      body: JSON.stringify({
        "prompt": prompt,
        "stream": true
      })
    });
  } catch (err) {
    console.error('AI.run 發生錯誤:', err);
    throw err;
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
            } else {
            // 嘗試從 chunk 中找出 usage 資訊
            const tryAssignUsage = (obj) => {
              if (!obj || typeof obj !== 'object') return null;
              if (typeof obj.prompt_tokens === 'number' &&
                typeof obj.completion_tokens === 'number' &&
                typeof obj.total_tokens === 'number') {
              return { prompt_tokens: obj.prompt_tokens, completion_tokens: obj.completion_tokens, total_tokens: obj.total_tokens };
              }
              for (const k of Object.keys(obj)) {
              const found = tryAssignUsage(obj[k]);
              if (found) return found;
              }
              return null;
            };

            if (chunk?.usage && typeof chunk.usage === 'object') {
              transformContent.usage = tryAssignUsage(chunk.usage) || chunk.usage;
            } else if (chunk?.response && typeof chunk.response === 'object') {
              // 有時 response 會是一個物件，裡面包含 usage
              transformContent.usage = tryAssignUsage(chunk.response) || null;
            } else {
              // 最後嘗試在整個 chunk 裡遞迴尋找 usage-like 物件
              const found = tryAssignUsage(chunk);
              if (found) transformContent.usage = found;
              else console.warn('chunk 結構異常，未找到 response 或 usage:', chunk);
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
          console.error('無法解析最終緩衝內容，可能仍為不完整的 JSON:', leftover, e);
        }
      }
    }
  } catch (err) {
    console.error('stream 發生錯誤:', err);
    throw err;
  }
  return transformContent;
}