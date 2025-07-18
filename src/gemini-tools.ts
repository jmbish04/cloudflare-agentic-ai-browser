import { FunctionDeclarationSchemaType } from "@google/generative-ai";

export const geminiTools = [
  {
    name: "click",
    description: "Clicks selected element, wait until navigation/interaction ends and returns the resulting HTML",
    parameters: {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {
        selector: {
          type: FunctionDeclarationSchemaType.STRING,
          description: "HTML selector of element to click",
        },
        reasoning: {
          type: FunctionDeclarationSchemaType.STRING,
          description: "Human readable explanation what and why is clicked for audit purposes",
        },
      },
      required: ["selector", "reasoning"],
    },
  },
  {
    name: "type",
    description: "Type text into an input field",
    parameters: {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {
        selector: {
          type: FunctionDeclarationSchemaType.STRING,
          description: "HTML selector of element to click",
        },
        value: {
          type: FunctionDeclarationSchemaType.STRING,
          description: "value to fill",
        },
        reasoning: {
          type: FunctionDeclarationSchemaType.STRING,
          description: "Human readable explanation what and why is typed for audit purposes",
        },
      },
      required: ["selector", "value", "reasoning"],
    },
  },
  {
    name: "select",
    description: "Select an option from a dropdown menu",
    parameters: {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {
        selector: {
          type: FunctionDeclarationSchemaType.STRING,
          description: "HTML selector of element to click",
        },
        value: {
          type: FunctionDeclarationSchemaType.STRING,
          description: "option to select",
        },
        reasoning: {
          type: FunctionDeclarationSchemaType.STRING,
          description: "Human readable explanation what and why is selected for audit purposes",
        },
      },
      required: ["selector", "value", "reasoning"],
    },
  },
];