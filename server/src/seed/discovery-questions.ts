/**
 * Default discovery question set for onboarding programs.
 *
 * These questions are organized by bucket and designed to efficiently
 * gather the information needed for human-AI alignment analysis.
 */

export interface SeedQuestion {
  bucket: string;
  prompt: string;
  inputType: string;
  required: boolean;
  sequence: number;
}

export const DEFAULT_DISCOVERY_QUESTIONS: SeedQuestion[] = [
  // Bucket: role_and_responsibilities
  {
    bucket: "role_and_responsibilities",
    prompt: "What is your current job title and primary role?",
    inputType: "text",
    required: true,
    sequence: 1,
  },
  {
    bucket: "role_and_responsibilities",
    prompt: "Describe your three most important responsibilities.",
    inputType: "textarea",
    required: true,
    sequence: 2,
  },
  {
    bucket: "role_and_responsibilities",
    prompt: "What decisions do you have authority to make on your own?",
    inputType: "textarea",
    required: true,
    sequence: 3,
  },
  {
    bucket: "role_and_responsibilities",
    prompt: "Who do you report to and who reports to you?",
    inputType: "textarea",
    required: true,
    sequence: 4,
  },

  // Bucket: daily_workflow
  {
    bucket: "daily_workflow",
    prompt: "Walk through a typical work day from start to finish.",
    inputType: "textarea",
    required: true,
    sequence: 5,
  },
  {
    bucket: "daily_workflow",
    prompt: "What tools and systems do you use most frequently?",
    inputType: "textarea",
    required: true,
    sequence: 6,
  },
  {
    bucket: "daily_workflow",
    prompt: "What repetitive tasks take the most time each week?",
    inputType: "textarea",
    required: true,
    sequence: 7,
  },
  {
    bucket: "daily_workflow",
    prompt: "Which tasks require creative judgment or nuanced decisions?",
    inputType: "textarea",
    required: true,
    sequence: 8,
  },

  // Bucket: collaboration
  {
    bucket: "collaboration",
    prompt: "Who do you collaborate with most closely and on what?",
    inputType: "textarea",
    required: true,
    sequence: 9,
  },
  {
    bucket: "collaboration",
    prompt: "Where do handoffs happen in your workflows?",
    inputType: "textarea",
    required: true,
    sequence: 10,
  },
  {
    bucket: "collaboration",
    prompt: "What information do you regularly need from other people or teams?",
    inputType: "textarea",
    required: true,
    sequence: 11,
  },
  {
    bucket: "collaboration",
    prompt: "What approvals or reviews slow down your work?",
    inputType: "textarea",
    required: true,
    sequence: 12,
  },

  // Bucket: pain_points
  {
    bucket: "pain_points",
    prompt: "What are the biggest bottlenecks in your current workflows?",
    inputType: "textarea",
    required: true,
    sequence: 13,
  },
  {
    bucket: "pain_points",
    prompt: "What tasks feel like they should be faster or easier?",
    inputType: "textarea",
    required: true,
    sequence: 14,
  },
  {
    bucket: "pain_points",
    prompt: "Where do things fall through the cracks?",
    inputType: "textarea",
    required: true,
    sequence: 15,
  },
  {
    bucket: "pain_points",
    prompt: "What frustrates you most about current processes?",
    inputType: "textarea",
    required: true,
    sequence: 16,
  },

  // Bucket: ai_readiness
  {
    bucket: "ai_readiness",
    prompt: "Have you used AI tools in your work? If so, which ones and how?",
    inputType: "textarea",
    required: true,
    sequence: 17,
  },
  {
    bucket: "ai_readiness",
    prompt: "What tasks would you trust an AI assistant to help with?",
    inputType: "textarea",
    required: true,
    sequence: 18,
  },
  {
    bucket: "ai_readiness",
    prompt: "What tasks should always remain human-led in your opinion?",
    inputType: "textarea",
    required: true,
    sequence: 19,
  },
  {
    bucket: "ai_readiness",
    prompt: "If you had a dedicated AI teammate, what would you want it to handle first?",
    inputType: "textarea",
    required: true,
    sequence: 20,
  },
];
