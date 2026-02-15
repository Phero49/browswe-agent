/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * api-client.ts
 * Native REST client using direct response streaming for actions.
 */

export const BASE_URL = 'http://localhost:8080';

/**
 * Executes an action on the server via HTTP POST.
 * For message-instruction, it reads the response as a CONCATENATED stream.
 */
export async function sendMessage(action: string, data: any, onChunkResponse: (data: any) => void) {
  try {
    const response = await fetch(`${BASE_URL}/action/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error(`Action failed: ${response.statusText}`);

    // Direct Response Streaming for message instructions
    if (action === 'message-instruction' && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6));
              // Trigger listener with the concatenated data from backend
              onChunkResponse(payload);
            } catch (e) {
              console.warn('Failed to parse stream chunk', e);
            }
          }
        }
      }
      return { success: true };
    }

    // Standard JSON response for other actions
    return await response.json();
  } catch (error) {
    console.error(`❌ Action Error [${action}]:`, error);
    throw error;
  }
}
