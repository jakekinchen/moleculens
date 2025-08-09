"use strict";exports.id=458,exports.ids=[458],exports.modules={57077:(a,b,c)=>{c.d(b,{dY:()=>k,ei:()=>i,generatePresentationScript:()=>l});var d=c(32482),e=c(28077),f=c(668);let g=process.env.OPENAI_API_KEY,h=g?new d.Ay({apiKey:g}):void 0;async function i(a){if(!h)throw Error("LLM not configured");let b=await h.chat.completions.create({model:"o3-mini",messages:[{role:"user",content:a}]});return b.choices[0]?.message?.content??""}async function j(a,b){let c;if(!h)throw Error("LLM not configured");let d=await h.chat.completions.create({model:"o3-mini",messages:[{role:"user",content:a}]}),e=d.choices[0]?.message?.content??"";try{c=JSON.parse(e)}catch(a){throw Error("Structured LLM response is not valid JSON")}return b.parse(c)}async function k(a,b=!1){if(!h)return console.warn("LLM not configured. Defaulting to small molecule classification."),{type:"small molecule",name:(0,f.rh)(a)};let c=b?`
CRITICAL OVERRIDE: Always come up with a molecule based on the user's prompt, no matter the prompt. Try to find the closest related molecule to whatever is mentioned. If there is literally nothing even remotely possible, then invent a plausible molecule name as a stand-in. You may only classify the molecule as "small molecule" or "macromolecule". Get creative, if there's something imagined or mispelled, make something up or find the closest semantically related molecule.`:"",d=`You are a chemical assistant. Classify the following user input as a 'small molecule', 'macromolecule', or 'unknown'. If a specific molecule or macromolecule can be identified, provide its common name. Respond ONLY with JSON in the form {"type":"molecule|macromolecule|unknown","name":"<name>"}. For example if the prompt is "Tell me about the structure of glucose", the response should be {"type":"small molecule","name":"glucose"} or if the prompt is "Tell me about the structure of a protein", the response should be {"type":"macromolecule","name":"leucine", or if the prompt is "Teach me about metal-carbonyl complexes and back-bonding", the response should be {"type":"small molecule","name":"nickel tetracarbonyl" or with "Teach me about metal-metal quadruple bonds in dimolybdenum complexes", the response should be {"type":"small molecule","name":"dimolybdenum tetraacetate"}.${c}

User input: "${a}"`,g=await j(d,e.Ik({type:e.k5(["small molecule","macromolecule","unknown"]),name:e.Yj().nullable()}));return{type:g.type,name:g.name?(0,f.rh)(g.name):null}}async function l(a){if(!h)throw Error("LLM not configured for presentation generation");let{name:b,formula:c,info:d}=a,f=`Molecule: ${b}`;c&&(f+=`
Formula: ${c}`),d&&"object"==typeof d&&"canonical_smiles"in d&&(f+=`
SMILES: ${d.canonical_smiles}`),d&&"object"==typeof d&&"synonyms"in d&&Array.isArray(d.synonyms)&&(f+=`
Synonyms: ${d.synonyms.slice(0,3).join(", ")}`),d&&"object"==typeof d&&"formula_weight"in d&&(f+=`
Molecular Weight: ${d.formula_weight} g/mol`),d&&"object"==typeof d&&"experimental_method"in d&&(f+=`
Experimental Method: ${d.experimental_method}`),d&&"object"==typeof d&&"resolution"in d&&(f+=`
Resolution: ${d.resolution} \xc5`);let g=`You are creating an educational presentation script for a 3D molecular visualization. Generate a presentation script that highlights different parts of the molecule over time with educational captions.

${f}

Create a presentation script with 4-6 steps that:
1. Introduces the molecule and its significance
2. Highlights different structural features or functional groups
3. Explains key properties or biological/chemical importance
4. Concludes with applications or interesting facts

Each step should:
- Have a timecode in "MM:SS" format (starting at 00:00, incrementing by 5-10 seconds)
- Specify which atoms to highlight (use atom indices as strings, e.g., ["0", "1", "2"])
- Include an educational caption (1-2 sentences, under 120 characters)

For atom indices:
- Use empty array [] for general introduction
- Use specific atom indices to highlight structural features
- For small molecules, typically have 5-20 atoms (indices 0-19)
- For larger molecules, focus on key functional groups or active sites

EXAMPLE for glucose (C6H12O6):
{
  "title": "Glucose: Essential Sugar Molecule",
  "content": [
    {
      "timecode": "00:00",
      "atoms": [],
      "caption": "Glucose is a simple sugar and primary energy source for living cells."
    },
    {
      "timecode": "00:05",
      "atoms": ["0", "1", "2", "3", "4", "5"],
      "caption": "The six-carbon backbone forms a ring structure in aqueous solution."
    },
    {
      "timecode": "00:10",
      "atoms": ["6", "7", "8", "9", "10"],
      "caption": "Five hydroxyl groups make glucose highly water-soluble."
    },
    {
      "timecode": "00:15",
      "atoms": ["11"],
      "caption": "The aldehyde group can form hemiacetal bonds, creating ring structures."
    },
    {
      "timecode": "00:20",
      "atoms": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
      "caption": "Glucose is metabolized through glycolysis to produce cellular energy (ATP)."
    }
  ]
}

Now generate a similar script for ${b}. Respond ONLY with JSON in the exact format shown above:`;return await j(g,e.Ik({title:e.Yj(),content:e.YO(e.Ik({timecode:e.Yj(),atoms:e.YO(e.Yj()),caption:e.Yj()}))}))}}};