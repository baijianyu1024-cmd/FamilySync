
import { FunctionDeclaration, Type, GoogleGenAI } from "@google/genai";
import { NaturalLanguageResult } from "../types";

export const SYSTEM_INSTRUCTION = `
You are 'FamilyBot', a world-class autonomous family assistant for the 'FamilySync' app. 
You specialize in managing family complexity with precision, empathy, and logic.

**CORE REASONING ENGINE (Chain of Thought):**
1. **Identity First**: If a user identifies themselves (e.g., "I am Leo"), your FIRST priority is to find their member ID using \`list_members\`. Never assume or guess an ID.
2. **Read Before Write**: Before deleting or updating items, always use the 'list' tools (\`list_events\`, \`list_tasks\`) to inspect the current state and find the correct IDs.
3. **Multi-Step Execution**: You are designed for complex, multi-part requests. 
   - Example: "Add X, delete Y, recommend Z"
   - Step A: Call \`list_members\` (if needed) and \`list_events\` (to find Y).
   - Step B: Receive data. Call \`add_event\` for X, \`delete_event\` for Y, and \`display_recommendations\` for Z.
   - Step C: Provide a final summary of all actions taken.
4. **Interactive Recommendations**: Use \`display_recommendations\` whenever a user asks for suggestions or when you see a gap in their schedule. These are interactive cards the user can click to confirm.
5. **No Hallucinations**: If a tool returns an error or no data, inform the user honestly and ask for clarification.

**CONVERSATIONAL TONE:**
- Friendly, professional, and efficient.
- Use the family members' names once you know them.
- Keep final responses concise but comprehensive.

**CRITICAL RULES:**
- **IDs are Mandatory**: You MUST have a valid UUID to perform updates, deletions, or assignments.
- **Current Context**: "Today" is based on the system time provided. "Tomorrow" is T+1 day.
- **Ambiguity**: If a user says "the game", and there are three games, ask which one they mean.
- **Task Assignees**: Every task MUST have at least one assignee.
`;

export const toolsSchema: FunctionDeclaration[] = [
  {
    name: "list_members",
    description: "Get a list of all family members and their IDs. Use this first if a user identifies themselves by name.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "add_member",
    description: "Add a new family member to the system.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Full name of the member" },
        color: { type: Type.STRING, description: "Preferred color (rose, blue, green, purple, orange, teal, indigo, pink, gray)" }
      },
      required: ["name"],
    },
  },
  {
    name: "display_recommendations",
    description: "Show a list of suggested activities as interactive cards. Use this for 'recommendations' or 'suggestions'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        recommendations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              category: { type: Type.STRING, enum: ["event", "task"] },
              suggestedAssigneeId: { type: Type.STRING, description: "ID of the recommended person" },
              data: { 
                type: Type.OBJECT, 
                description: "Object data matching add_event or add_task schemas" 
              }
            },
            required: ["title", "description", "category", "data"]
          }
        }
      },
      required: ["recommendations"]
    }
  },
  {
    name: "update_member",
    description: "Modify an existing family member's details.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "The Member's UUID" },
        name: { type: Type.STRING },
        color: { type: Type.STRING }
      },
      required: ["id"],
    },
  },
  {
    name: "delete_member",
    description: "Permanently remove a member from the family sync.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
      },
      required: ["id"],
    },
  },
  {
    name: "list_events",
    description: "List all calendar events. Use this to find IDs of events to update or delete.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        start: { type: Type.STRING, description: "Filter start ISO date" },
        end: { type: Type.STRING, description: "Filter end ISO date" },
        memberId: { type: Type.STRING, description: "Filter by a specific member ID" }
      },
    },
  },
  {
    name: "add_event",
    description: "Create a new calendar appointment.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        start: { type: Type.STRING, description: "ISO 8601 timestamp" },
        end: { type: Type.STRING, description: "ISO 8601 timestamp (defaults to 1hr after start)" },
        location: { type: Type.STRING },
        memberIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Member UUIDs involved" },
        recurringRule: { type: Type.STRING, enum: ["daily", "weekly", "monthly"] },
        recurrenceEnd: { type: Type.STRING, description: "ISO date for stop" }
      },
      required: ["title", "start", "memberIds"],
    },
  },
  {
    name: "update_event",
    description: "Change details of an existing event.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "The event UUID" },
        title: { type: Type.STRING },
        start: { type: Type.STRING },
        end: { type: Type.STRING },
        location: { type: Type.STRING },
        memberIds: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_event",
    description: "Remove an event from the calendar.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "The event UUID" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_tasks",
    description: "Retrieve all to-do items to find IDs for modifications.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ["shopping", "chores", "general", "all"] },
        memberId: { type: Type.STRING }
      },
    },
  },
  {
    name: "add_task",
    description: "Create a new to-do task. Must be assigned.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        type: { type: Type.STRING, enum: ["shopping", "chores", "general"] },
        dueDate: { type: Type.STRING, description: "ISO Date" },
        assigneeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        recurringRule: { type: Type.STRING, enum: ["daily", "weekly", "monthly"] }
      },
      required: ["title", "type", "assigneeIds"],
    },
  },
  {
    name: "update_task",
    description: "Update task properties or mark as completed.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        isCompleted: { type: Type.BOOLEAN },
        dueDate: { type: Type.STRING },
        assigneeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_task",
    description: "Remove a task from the list.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
      },
      required: ["id"],
    },
  },
];

export const parseNaturalLanguage = async (input: string): Promise<NaturalLanguageResult | null> => {
    if (!process.env.API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      Analyze this family organizer input: "${input}"
      Reference Time: ${new Date().toISOString()}
      Output JSON with 'type' and either 'event' or 'task' details.
    `;
  
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["event", "task"] },
              event: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  start: { type: Type.STRING },
                  end: { type: Type.STRING },
                  location: { type: Type.STRING },
                  memberIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
              },
              task: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["shopping", "chores", "general"] },
                  dueDate: { type: Type.STRING },
                  assigneeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
              },
            },
            required: ["type"],
          },
        },
      });
  
      return JSON.parse(response.text || "{}") as NaturalLanguageResult;
    } catch (error) {
      console.error(error);
      return null;
    }
  };
