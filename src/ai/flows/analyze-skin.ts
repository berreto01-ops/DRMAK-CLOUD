'use server';

/**
 * @fileOverview This file defines a Genkit flow for analyzing skin conditions from images and suggesting treatments.
 *
 * The flow uses Gemini 2.5 Flash to identify skin issues and recommends treatments based on training materials.
 * It strictly enforces human-only analysis.
 *
 * @interface AnalyzeSkinInput - Defines the input schema (base64 image and training materials).
 * @interface AnalyzeSkinOutput - Defines the output schema (diagnosis, recommendations, and human-validation flag).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeSkinInputSchema = z.object({
    imageBase64: z.string().describe('The base64 encoded string of the skin image.'),
    trainingData: z.array(
        z.object({
            title: z.string(),
            content: z.string(),
        })
    ).describe('A list of training materials describing different skin conditions and their treatments.'),
    markerPosition: z.object({
        x: z.number().describe('The x coordinate as a percentage of the image width.'),
        y: z.number().describe('The y coordinate as a percentage of the image height.'),
    }).optional().describe('The specific coordinate to analyze (0-100). If omitted, the whole image is analyzed.'),
});

export type AnalyzeSkinInput = z.infer<typeof AnalyzeSkinInputSchema>;

const AnalyzeSkinOutputSchema = z.object({
    isHumanSkin: z.boolean().describe('Whether the image contains human skin or a human face suitable for dermatological analysis.'),
    diagnosis: z.string().describe('The AI diagnosis of the skin condition, or a message explaining why analysis cannot be performed if isHumanSkin is false.'),
    recommendations: z.array(
        z.object({
            productName: z.string().describe('The name of the recommended treatment or product.'),
            reason: z.string().describe('The reason why this treatment is recommended based on the training data.'),
        })
    ).describe('A list of recommended treatments with explanations. Empty if isHumanSkin is false.'),
});

export type AnalyzeSkinOutput = z.infer<typeof AnalyzeSkinOutputSchema>;

export async function analyzeSkin(input: AnalyzeSkinInput): Promise<AnalyzeSkinOutput> {
    return analyzeSkinFlow(input);
}

export const analyzeSkinFlow = ai.defineFlow(
    {
        name: 'analyzeSkinFlow',
        inputSchema: AnalyzeSkinInputSchema,
        outputSchema: AnalyzeSkinOutputSchema,
    },
    async (input) => {
        const trainingContext = input.trainingData
            .map((t) => `### ${t.title}\n${t.content}`)
            .join('\n\n');

        const result = await ai.generate({
            model: 'googleai/gemini-1.5-flash',
            prompt: [
                {
                    media: {
                        url: `data:${input.imageBase64.includes('png') ? 'image/png' : 'image/jpeg'};base64,${input.imageBase64.replace(/^data:image\/\w+;base64,/, '')}`,
                        contentType: input.imageBase64.includes('png') ? 'image/png' : 'image/jpeg',
                    },
                },
                {
                    text: `You are an expert dermatologist at Skin Smith Clinic. 
          
      CRITICAL INSTRUCTION: Analyze the provided image ONLY if it contains human skin or a human face. 
      If the image contains non-human subjects (e.g., cars, animals, buildings, generic objects) or if no skin is visible for analysis:
      - Set "isHumanSkin" to false.
      - Set "diagnosis" to "Analysis for this image is not possible. Please provide a clear photo of human skin for a dermatological consultation."
      - Return an empty list for "recommendations".

      If the image contains human skin:
      1. Set "isHumanSkin" to true.
      2. Identify potential skin issues (e.g., acne, hyperpigmentation, dryness, fine lines).
      ${input.markerPosition ? `3. FOCUS ANALYSIS ON THE SPOT AT COORDINATES (X: ${input.markerPosition.x}%, Y: ${input.markerPosition.y}%). The coordinates are relative to the top-left of the image.` : '3. Provide a general diagnosis of the entire image.'}
      4. Provide a brief, professional diagnosis. ${input.markerPosition ? 'Be very specific about what is seen at the marked spot.' : ''}
      5. Based on our clinical training materials provided below, suggest the most suitable treatments or protocols.
      
      Training Materials:
      ${trainingContext}
      
      ${input.markerPosition ? 'IMPORTANT: Since this is a spot-specific analysis, keep the diagnosis concise and directly related to the marked area.' : ''}
      
      IMPORTANT: You MUST respond strictly in valid JSON format matching the schema provided. Do not include markdown code blocks in your response.`,
                },
            ],
            output: { schema: AnalyzeSkinOutputSchema },
        });

        const output = result.output;

        if (!output) {
            throw new Error('AI failed to generate a response.');
        }
        return output;
    }
);
