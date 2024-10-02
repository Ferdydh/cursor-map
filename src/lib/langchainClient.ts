import { ChatOpenAI } from '@langchain/openai';
import { Restaurant } from './types';
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";

// Variable to store restaurant data
let restaurantData: Restaurant[] = [];

/**
 * Sets the list of restaurants for the LangChain client.
 *
 * @param restaurants - An array of Restaurant objects.
 */
export const setRestaurantsForLangChain = (restaurants: Restaurant[]) => {
  restaurantData = restaurants;
};

/**
 * Formats restaurant data into a string for the prompt.
 *
 * @param restaurants - An array of Restaurant objects.
 * @returns A formatted string representing the restaurants.
 */
const formatRestaurantData = (restaurants: Restaurant[]): string => {
  return restaurants
    .map(
      (r) =>
        `- **${r.name}**: ${r.description}. Menu includes ${r.menu.join(', ')}.`
    )
    .join('\n');
};

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

const messageHistories: Record<string, InMemoryChatMessageHistory> = {};

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a helpful assistant that recommends a restaurant to the user. The following is the list of the restaurants: {restaurants}\nOnly recommend the restaurants in the list. When recommending, recommend all multiple restaurants that fit the description.`,
  ],
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
]);

const chain = prompt.pipe(model);

const withMessageHistory = new RunnableWithMessageHistory({
  runnable: chain,
  getMessageHistory: async (sessionId) => {
    if (!messageHistories[sessionId]) {
      messageHistories[sessionId] = new InMemoryChatMessageHistory();
    }
    return messageHistories[sessionId];
  },
  inputMessagesKey: "input",
  historyMessagesKey: "chat_history",
});

/**
 * Generates a bot reply using LangChain's ConversationChain.
 *
 * @param userMessage - The message input from the user.
 * @returns A promise that resolves to the bot's reply string.
 */
export const getBotReply = async (userMessage: string): Promise<string> => {
  try {
    const config = {
      configurable: {
        sessionId: "abc2", // You might want to replace this with dynamic session handling
      },
    };

    const messageHistory = await withMessageHistory.getMessageHistory(config.configurable.sessionId);
    console.log(messageHistory);

    const response = await withMessageHistory.invoke(
      {
        input: userMessage,
        restaurants: formatRestaurantData(restaurantData),
      },
      config
    );

    return response.content.toString();
  } catch (error) {
    console.error('Error generating bot reply:', error);
    // Log the error with LangSmith or any other logging service
    throw new Error('Failed to generate bot reply.');
  }
};