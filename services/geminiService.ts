
import { FunctionDeclaration, Type, GoogleGenAI } from "@google/genai";
import { NaturalLanguageResult } from "../types";

export const SYSTEM_INSTRUCTION = `
You are 'FamilyBot', a world-class autonomous family assistant for the 'FamilySync' app. 
You specialize in managing family complexity with precision, empathy, and logic.

**CORE REASONING ENGINE (Chain of Thought):**
1. **Identity First**: If a user uses "I" or "me" (e.g., "Help me add...", "I am Leo"), your FIRST priority is to find their member ID using \`list_members\`. If you don't know who "I" or "me" refers to, you MUST ask the user to identify themselves before proceeding with any actions. Never assume or guess an ID.
2. **Read Before Write**: Before deleting or updating items, always use the 'list' tools (\`list_events\`, \`list_tasks\`) to inspect the current state and find the correct IDs.
3. **BATCH EXECUTION (CRITICAL FOR RATE LIMITS)**: You MUST minimize the number of internal turns. If a user asks to do multiple things (e.g., add an event AND delete a task), call ALL necessary tools in PARALLEL in a single response whenever possible. Do NOT do them one by one.
4. **Interactive Recommendations**: Use \`display_recommendations\` whenever a user asks for suggestions or when you see a gap in their schedule. These are interactive cards the user can click to confirm.
5. **Confirmation Step**: ALWAYS use \`request_confirmation\` before calling \`delete_events\`, \`update_events\`, \`delete_tasks\`, or \`update_tasks\`. Do not execute deletions or updates directly without the user's explicit confirmation. Once the user confirms, you MUST execute the actual delete/update tool.
6. **No Hallucinations**: If a tool returns an error or no data, inform the user honestly and ask for clarification.

**CONVERSATIONAL TONE:**
- Friendly, professional, and efficient.
- Use the family members' names once you know them.
- Keep final responses concise but comprehensive.

**CRITICAL RULES:**
- **IDs are Mandatory**: You MUST have a valid UUID to perform updates, deletions, or assignments.
- **Current Context**: "Today" is based on the system time provided. "Tomorrow" is T+1 day.
- **Timezones**: When generating ISO 8601 timestamps for tool calls, you MUST use the user's local timezone offset instead of 'Z' (UTC). The user's current time and timezone are provided below. For example, if the user asks for 9 PM and their timezone is UTC+08:00, output 21:00:00+08:00. NEVER use 'Z' unless the user is explicitly in UTC.
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
    name: "add_events",
    description: "Create multiple new calendar appointments at once.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        events: {
          type: Type.ARRAY,
          items: {
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
            required: ["title", "start", "memberIds"]
          }
        }
      },
      required: ["events"]
    }
  },
  {
    name: "request_confirmation",
    description: "Ask the user for confirmation before deleting or updating events or tasks. ALWAYS use this before actually calling delete/update tools.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        actionType: { type: Type.STRING, enum: ["delete", "update"] },
        targetType: { type: Type.STRING, enum: ["events", "tasks"] },
        message: { type: Type.STRING, description: "The question to ask, e.g., 'Are you sure you want to delete these events?'" },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              memberIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              iconType: { type: Type.STRING, enum: ["event", "chore", "shopping", "general"] }
            },
            required: ["id", "title", "subtitle"]
          }
        }
      },
      required: ["actionType", "targetType", "message", "items"]
    }
  },
  {
    name: "update_events",
    description: "Change details of existing events.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        updates: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "The event UUID" },
              title: { type: Type.STRING },
              start: { type: Type.STRING },
              end: { type: Type.STRING },
              location: { type: Type.STRING },
              memberIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["id"]
          }
        }
      },
      required: ["updates"],
    },
  },
  {
    name: "delete_events",
    description: "Remove events from the calendar.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        ids: { type: Type.ARRAY, items: { type: Type.STRING }, description: "The event UUIDs" },
      },
      required: ["ids"],
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
    name: "add_tasks",
    description: "Create multiple new to-do tasks at once.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        tasks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["shopping", "chores", "general"] },
              dueDate: { type: Type.STRING, description: "ISO Date" },
              assigneeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              recurringRule: { type: Type.STRING, enum: ["daily", "weekly", "monthly"] }
            },
            required: ["title", "type", "assigneeIds"]
          }
        }
      },
      required: ["tasks"]
    }
  },
  {
    name: "update_tasks",
    description: "Update task properties or mark as completed.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        updates: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              isCompleted: { type: Type.BOOLEAN },
              dueDate: { type: Type.STRING },
              assigneeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["id"]
          }
        }
      },
      required: ["updates"],
    },
  },
  {
    name: "delete_tasks",
    description: "Remove tasks from the list.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        ids: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["ids"],
    },
  },
];

export const parseNaturalLanguage = async (input: string): Promise<NaturalLanguageResult | null> => {
    if (!process.env.GEMINI_API_KEY) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: 'v1alpha' } });
    
    const prompt = `
      Analyze this family organizer input: "${input}"
      Reference Time: ${new Date().toString()}
      IMPORTANT: When generating ISO 8601 timestamps, use the local timezone offset (e.g., -07:00) instead of 'Z' (UTC).
      Output JSON with 'type' and either 'event' or 'task' details.
    `;
  
    let response;
    let retryCount = 0;
    while (retryCount < 5) {
      try {
        response = await ai.models.generateContent({
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
        break;
      } catch (e: any) {
        if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('RESOURCE_EXHAUSTED')) {
          retryCount++;
          const delayMs = retryCount * 3000;
          console.warn(`Rate limit hit in parseNaturalLanguage, retrying in ${delayMs / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          console.error(e);
          return null;
        }
      }
    }

    if (!response) {
      console.error("Failed to parse natural language after retries due to rate limits.");
      return null;
    }

    try {
        return JSON.parse(response.text || "{}") as NaturalLanguageResult;
    } catch (e) {
        console.error("Failed to parse JSON response:", e);
        return null;
    }
  };
