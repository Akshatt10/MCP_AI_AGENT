import readLine from 'readline/promises';
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const mcpClient = new Client({
    name: "example-client",
    version: "1.0.0",
});

const chatHistory = [];
let tools = []; // 🔧 Define tools in global scope

const rl = readLine.createInterface({
    input: process.stdin,
    output: process.stdout,
});

mcpClient.connect(new SSEClientTransport(new URL("http://localhost:3001/sse")))
    .then(async () => {
        console.log("Connected to server");


        tools = (await mcpClient.listTools()).tools.map(tool => {
            return {
                name: tool.name,
                description: tool.description,
                parameters: {
                    type: tool.inputSchema.type,
                    properties: tool.inputSchema.properties,
                    required: tool.inputSchema.required,
                },
            };
        });

        chatLoop(); 
    });

async function chatLoop(toolCall) {

    if(toolCall){
        const toolResult = await mcpClient.callTool({
            name: toolCall.name,
            arguments: toolCall.args,
        });

        console.log("Tool Result: ", toolResult);
        }
    }
    const question = await rl.question('You: ');

    chatHistory.push({
        role: "user",
        parts: [
            {
                text: question,
                type: "text",
            }
        ]
    });

    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: chatHistory,
        config: {
            tools: [
                {
                    functionDeclarations: tools
                }
            ]
        }
    });

    const functionCall = response.candidates[0].content.parts[ 0 ].functionCall;
    const responseText = response.candidates[0].content.parts[0].text;

    if(functionCall){
        return chatLoop();
    }
    console.log("AI: ", response);

    chatHistory.push({
        role: "model",
        parts: [
            {
                text: responseText,
                type: "text",
            }
        ]
    });

    console.log("AI: ", responseText);
    chatLoop();
