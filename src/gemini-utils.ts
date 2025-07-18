import { GenerateContentResult, FunctionCall, Content } from "@google/generative-ai";

export function convertOpenAIMessagesToGemini(messages: any[]): Content[] {
  const geminiMessages: Content[] = [];
  
  for (const message of messages) {
    if (message.role === "system") {
      // System messages become part of the first user message
      continue;
    }
    
    if (message.role === "user") {
      geminiMessages.push({
        role: "user",
        parts: [{ text: message.content }]
      });
    } else if (message.role === "assistant" || message.role === "model") {
      const parts: any[] = [];
      
      if (message.content) {
        parts.push({ text: message.content });
      }
      
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          parts.push({
            functionCall: {
              name: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments)
            }
          });
        }
      }
      
      geminiMessages.push({
        role: "model",
        parts
      });
    } else if (message.role === "tool") {
      // Tool responses become function responses
      geminiMessages.push({
        role: "user",
        parts: [{
          functionResponse: {
            name: "tool_result", // We'll need to track the function name
            response: { content: message.content }
          }
        }]
      });
    }
  }
  
  return geminiMessages;
}

export function extractGeminiFunctionCalls(result: GenerateContentResult): Array<{
  name: string;
  arguments: string;
  id: string;
}> {
  const functionCalls: Array<{ name: string; arguments: string; id: string }> = [];
  
  if (result.response.candidates?.[0]?.content?.parts) {
    for (const part of result.response.candidates[0].content.parts) {
      if (part.functionCall) {
        functionCalls.push({
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args || {}),
          id: `gemini_${Date.now()}_${Math.random()}`
        });
      }
    }
  }
  
  return functionCalls;
}

export function getGeminiTextResponse(result: GenerateContentResult): string | null {
  if (result.response.candidates?.[0]?.content?.parts) {
    for (const part of result.response.candidates[0].content.parts) {
      if (part.text) {
        return part.text;
      }
    }
  }
  return null;
}