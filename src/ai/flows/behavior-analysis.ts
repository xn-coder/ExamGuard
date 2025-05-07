// src/ai/flows/behavior-analysis.ts
'use server';

/**
 * @fileOverview Exam proctoring system that analyzes webcam feed for suspicious behavior.
 *
 * - analyzeWebcamFeed - A function that analyzes the webcam feed for suspicious behavior.
 * - AnalyzeWebcamFeedInput - The input type for the analyzeWebcamFeed function.
 * - AnalyzeWebcamFeedOutput - The return type for the analyzeWebcamFeed function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeWebcamFeedInputSchema = z.object({
  webcamFeedDataUri: z
    .string()
    .describe(
      "A snapshot of the examinee's webcam feed, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  timeElapsed: z.number().describe('The time elapsed in seconds since the exam started.'),
  questionNumber: z.number().describe('The current question number.'),
});
export type AnalyzeWebcamFeedInput = z.infer<typeof AnalyzeWebcamFeedInputSchema>;

const AnalyzeWebcamFeedOutputSchema = z.object({
  isSuspicious: z.boolean().describe('Whether the examinee is exhibiting suspicious behavior.'),
  reason: z.string().describe('The reason for the suspicious behavior, if any.'),
});
export type AnalyzeWebcamFeedOutput = z.infer<typeof AnalyzeWebcamFeedOutputSchema>;

export async function analyzeWebcamFeed(input: AnalyzeWebcamFeedInput): Promise<AnalyzeWebcamFeedOutput> {
  return analyzeWebcamFeedFlow(input);
}

const analyzeWebcamFeedPrompt = ai.definePrompt({
  name: 'analyzeWebcamFeedPrompt',
  input: {schema: AnalyzeWebcamFeedInputSchema},
  output: {schema: AnalyzeWebcamFeedOutputSchema},
  prompt: `You are an AI proctor analyzing a student's webcam feed during an exam. Your primary goal is to detect behaviors indicative of cheating.

Analyze the provided webcam snapshot and determine if the student is exhibiting any suspicious behavior.

Strictly consider the following as suspicious activities:
1.  **Multiple Faces:** If more than one distinct face is clearly visible in the webcam feed.
2.  **Unauthorized Sounds:** If the student is audibly talking, whispering, or if there are other distinct background voices or unexplained noises. Brief, quiet self-muttering might be acceptable, but extended talking or conversations are not.
3.  **Looking Away:** If the student's gaze is consistently directed away from the screen for extended periods, suggesting they are looking at notes, another device, or another person.
4.  **Use of Unauthorized Devices:** If there's any visual evidence of the student interacting with a cell phone, tablet, smartwatch, or any other electronic device not permitted for the exam.
5.  **Leaving the View:** If the student's face is partially or fully out of the camera's view for a significant duration.

If ANY of these suspicious activities are detected, set the 'isSuspicious' field to true and provide a clear, concise reason in the 'reason' field, specifically mentioning which activity was observed.
For example: "isSuspicious: true, reason: Multiple faces detected in the webcam feed." or "isSuspicious: true, reason: Student was observed talking for several seconds."

If the behavior appears normal and none of the above specific suspicious activities are detected, set the 'isSuspicious' field to false and provide a neutral reason like "No suspicious behavior detected."

Exam Session Context:
Time elapsed: {{timeElapsed}} seconds
Current Question: {{questionNumber}}
Webcam Snapshot: {{media url=webcamFeedDataUri}}

Based *only* on the webcam snapshot and the criteria above, determine if the examinee is exhibiting suspicious behavior.
`,
});

const analyzeWebcamFeedFlow = ai.defineFlow(
  {
    name: 'analyzeWebcamFeedFlow',
    inputSchema: AnalyzeWebcamFeedInputSchema,
    outputSchema: AnalyzeWebcamFeedOutputSchema,
  },
  async input => {
    const {output} = await analyzeWebcamFeedPrompt(input);
    return output!;
  }
);

