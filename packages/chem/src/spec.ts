import { z } from 'zod';

export const FigureSpecV1 = z.object({
  version: z.literal(1),
  input: z.object({
    kind: z.enum(['smiles', 'pdb', 'name']),
    value: z.string().min(1),
    protonation_pH: z.number().finite(),
    conformer_method: z.enum(['etkdg', 'none'])
  }),
  render: z.object({
    modes: z.array(z.enum(['2d', '3d'])).min(1),
    outputs: z.array(z.enum(['svg', 'png'])).min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    transparent: z.boolean(),
    dpi: z.number().int().positive()
  }),
  style_preset: z.string().min(1),
  annotations: z.object({
    functional_groups: z.boolean(),
    charge_labels: z.enum(['none','minimal','all']).default('minimal'),
    atom_numbering: z.boolean(),
    scale_bar: z.boolean(),
    legend: z.enum(['none','auto']).default('auto')
  }),
  ['3d']: z.object({
    representation: z.enum(['cartoon+licorice','surface','licorice']),
    bg: z.enum(['transparent','black','white']),
    camera: z.object({
      target: z.enum(['auto']).default('auto'),
      distance: z.union([z.enum(['auto']), z.number().positive()]),
      azimuth: z.number(),
      elevation: z.number()
    }),
    lighting: z.enum(['three_point_soft']),
    quality: z.enum(['raytrace_high'])
  })
});

export type FigureSpec = z.infer<typeof FigureSpecV1>;

export function validateSpec(input: unknown): FigureSpec {
  return FigureSpecV1.parse(input);
}


