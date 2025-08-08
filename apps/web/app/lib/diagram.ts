import { DiagramPromptRequest, DiagramResponse } from '../types';
import { callLLM } from './llm';

export async function generateDiagram(
  req: DiagramPromptRequest
): Promise<DiagramResponse> {
  const description = await callLLM(
    `Create an SVG diagram for the following request: ${req.prompt}`
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${
    req.canvas_width ?? 400
  }" height="${req.canvas_height ?? 300}"><text x="10" y="20">${description}</text></svg>`;
  return {
    diagram_image: svg,
    diagram_plan: { plan: description, molecule_list: [] },
    status: 'completed',
  };
}
