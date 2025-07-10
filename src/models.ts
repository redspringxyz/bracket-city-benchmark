import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google/internal";
import { anthropic, type AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModelV1 } from "ai";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export type Model = {
  name: string;
  model: LanguageModelV1;
  providerOptions?: {
    google?: GoogleGenerativeAIProviderOptions;
    anthropic?: AnthropicProviderOptions;
  };
};

export const models: Model[] = [
  {
    name: "o3-high",
    model: openai("o3", { reasoningEffort: "high" }),
  },
  {
    name: "o4-mini-high",
    model: openai("o4-mini", { reasoningEffort: "high" }),
  },
  {
    name: "o4-mini-medium",
    model: openai("o4-mini", { reasoningEffort: "medium" }),
  },
  {
    name: "o3-mini-medium",
    model: openai("o3-mini", { reasoningEffort: "medium" }),
  },
  {
    name: "o3-mini-high",
    model: openai("o3-mini", { reasoningEffort: "high" }),
  },
  { name: "gpt-4.1", model: openai("gpt-4.1") },
  { name: "gpt-4o", model: openai("gpt-4o") },
  {
    name: "claude-4-opus-20250514-32k-thinking",
    model: openrouter("anthropic/claude-sonnet-4", {
      reasoning: { max_tokens: 32000 },
    }),
  },
  {
    name: "claude-4-sonnet-20250514-32k-interleaved-thinking",
    model: anthropic("claude-4-sonnet-20250514"),
    providerOptions: {
      anthropic: {
        thinking: { budgetTokens: 32000, type: "enabled" },
      },
    },
  },
  {
    name: "claude-4-sonnet-20250514-32k-thinking",
    model: openrouter("anthropic/claude-sonnet-4", {
      reasoning: { max_tokens: 32000 },
    }),
  },
  {
    name: "claude-3.7-sonnet-20250219-32k-thinking",
    model: openrouter("anthropic/claude-3.7-sonnet:thinking", {
      reasoning: { max_tokens: 32000 },
    }),
  },
  {
    name: "claude-3-5-sonnet-20241022",
    model: anthropic("claude-3-5-sonnet-20241022"),
  },
  {
    name: "gemini-2.5-pro-preview-05-06",
    // gemini 2.5 pro doesn't support thinking budget
    model: google("gemini-2.5-pro-preview-05-06"),
  },
  {
    name: "gemini-2.5-pro-preview-06-05",
    // gemini 2.5 pro doesn't support thinking budget
    model: google("gemini-2.5-pro-preview-06-05"),
  },
  {
    name: "gemini-2.5-flash-preview-04-17",
    model: google("gemini-2.5-flash-preview-04-17"),
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 24576,
        },
      },
    },
  },
  {
    name: "grok-3-beta",
    model: openrouter("x-ai/grok-3-beta"),
  },
  {
    name: "grok-4-07-09",
    model: openrouter("x-ai/grok-4-07-09"),
  },

  // {
  //   name: "deepseek-r1",
  //   model: openrouter("deepseek/deepseek-r1"),
  // },
  {
    name: "qwen3-235b-a22b",
    model: openrouter("qwen/qwen3-235b-a22b"),
  },
];
