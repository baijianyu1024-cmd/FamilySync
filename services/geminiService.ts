
import { FunctionDeclaration, Type, GoogleGenAI } from "@google/genai";
import { NaturalLanguageResult } from "../types";

export const SYSTEM_INSTRUCTION = `
You are 'FamilyBot', a smart, autonomous family assistant for the 'FamilySync' app.
Your goal is to help the family manage their Calendar Events, To-Do Tasks, and Family Members.

**CORE BEHAVIOR:**
1. **Chain of Thought**: You are capable of multi-step reasoning. 
   - If a user asks to "Add a task for Mom and Dad", but you don't know their IDs:
     a. First, call \`list_members\` to find the IDs.
     b. Then, in the NEXT step (after receiving the list), call \`add_task\` with the correct IDs.
   - You can call multiple tools in sequence to achieve a goal. Don't ask the user for information you can find yourself via tools.
2. **Clarify Ambiguity**: 
   - Only ask the user if you cannot find the answer via tools.
   - If the user request is vague (e.g., "Add a meeting" without a time), ASK for the time.
3. **Proactive Recommendations**: 
   - You can suggest events and tasks to improve family life. 
   - Use \`display_recommendations\` to show interactive cards for these suggestions.
   - Suggest things like: "Family Movie Night", "Sunday Meal Prep", "Clean the Air Filters", "Call Grandparents", "Weekend Hike".
   - Be creative based on the time of year, common family needs, and healthy habits.
4. **Tool Execution**: 
   - Always output your "Thought" before calling a tool.
   - Use ISO 8601 dates.
5. **Final Response**: Once the task is complete (or if you need user input), provide a friendly, concise verbal response.

**CRITICAL RULES:**
- **IDs are Mandatory**: Never guess an ID. Always list items to find the ID if specific names are mentioned.
- **Current Time**: Always be aware that "today" is relative to the system time passed to you.
- **Task Assignment**: Every To-Do task MUST be assigned to at least one family member.
- **Member Management**: You can add, remove, or rename family members.
`;

export const toolsSchema: FunctionDeclaration[] = [
  {
    name: "list_members",
    description: "Get a list of all family members and their IDs.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "add_member",
    description: "Add a new family member.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Name of the new member" },
        color: { type: Type.STRING, description: "Optional: Preferred color key (rose, blue, green, purple, etc.)" }
      },
      required: ["name"],
    },
  },
  {
    name: "display_recommendations",
    description: "Display a list of recommended events or tasks for the user to quickly add.",
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
              suggestedAssigneeId: { type: Type.STRING, description: "Optional: Who might be best for this" },
              data: { 
                type: Type.OBJECT, 
                description: "The object data for add_event or add_task (excluding IDs if unknown)" 
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
    description: "Update a family member's details.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "The Member ID" },
        name: { type: Type.STRING, description: "New name" },
        color: { type: Type.STRING, description: "New color key" }
      },
      required: ["id"],
    },
  },
  {
    name: "delete_member",
    description: "Remove a family member.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "The Member ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_events",
    description: "List calendar events within a date range to find IDs or check availability.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        start: { type: Type.STRING, description: "Start date (ISO)" },
        end: { type: Type.STRING, description: "End date (ISO)" },
        memberId: { type: Type.STRING, description: "Optional: Filter by member" }
      },
    },
  },
  {
    name: "add_event",
    description: "Create a new calendar event.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        start: { type: Type.STRING, description: "ISO Date string" },
        end: { type: Type.STRING, description: "ISO Date string" },
        location: { type: Type.STRING },
        memberIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of family member IDs" },
        recurringRule: { type: Type.STRING, enum: ["daily", "weekly", "monthly"], description: "Optional recurrence" },
        recurrenceEnd: { type: Type.STRING, description: "ISO Date string for when recurrence stops" }
      },
      required: ["title", "start", "end", "memberIds"],
    },
  },
  {
    name: "update_event",
    description: "Update an existing event. Only provide fields that need changing.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "The Event ID to update" },
        title: { type: Type.STRING },
        start: { type: Type.STRING },
        end: { type: Type.STRING },
        location: { type: Type.STRING },
        memberIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        recurringRule: { type: Type.STRING, enum: ["daily", "weekly", "monthly"] },
        recurrenceEnd: { type: Type.STRING }
      },
      required: ["id"],
    },
  },
  {
    name: "delete_event",
    description: "Delete a calendar event.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
      },
      required: ["id"],
    },
  },
  {
    name: "list_tasks",
    description: "List all to-do tasks to find IDs.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ["shopping", "chores", "general", "all"] },
        memberId: { type: Type.STRING, description: "Optional: Filter by member" }
      },
    },
  },
  {
    name: "add_task",
    description: "Create a new to-do task. Must have at least one assignee.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        type: { type: Type.STRING, enum: ["shopping", "chores", "general"] },
        dueDate: { type: Type.STRING, description: "ISO Date string" },
        assigneeIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of Member IDs (Required)" },
        recurringRule: { type: Type.STRING, enum: ["daily", "weekly", "monthly"], description: "Optional recurrence" },
        recurrenceEnd: { type: Type.STRING, description: "ISO Date string for when recurrence stops" }
      },
      required: ["title", "type", "assigneeIds"],
    },
  },
  {
    name: "update_task",
    description: "Update an existing task.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        isCompleted: { type: Type.BOOLEAN },
        dueDate: { type: Type.STRING },
        assigneeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        recurrenceEnd: { type: Type.STRING }
      },
      required: ["id"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a task.",
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
    // Robust check for environment variable
    if (!process.env.API_KEY) {
        console.error("API_KEY is missing");
        return null;
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      You are an intelligent parser for a family organizer app.
      Your task is to analyze the user's natural language input and convert it into a structured JSON object for either a Calendar Event or a To-Do Task.
      
      Input: "${input}"
      
      Context:
      - Current Date/Time: ${new Date().toISOString()}
      
      Rules:
      1. Determine if the input is an 'event' (happens at a specific time/place) or a 'task' (something to do).
      2. If Event:
         - extract title, start time, end time (default 1h if not specified), location, memberIds (default to empty if unknown).
      3. If Task:
         - extract title, type (shopping, chores, general), dueDate, assigneeIds (memberIds).
         - 'Buy' usually implies 'shopping'. 'Clean', 'Wash' implies 'chores'.
      
      Output JSON Schema:
      {
        "type": "event" | "task",
        "event": { "title": string, "start": string (ISO), "end": string (ISO), "location": string, "memberIds": string[] },
        "task": { "title": string, "type": "shopping"|"chores"|"general", "dueDate": string (ISO), "assigneeIds": string[] }
      }
    `;
  
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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
  
      const text = response.text;
      if (!text) return null;
      return JSON.parse(text) as NaturalLanguageResult;
    } catch (error) {
      console.error("Error parsing natural language input:", error);
      return null;
    }
  };
