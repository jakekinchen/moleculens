"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import type { InputKind } from "./InputKindToggle"

interface ExampleChipsProps {
  onSelect: (kind: InputKind, value: string) => void
}

const EXAMPLES: Array<{ kind: InputKind; label: string; value: string }> = [
  { kind: "smiles", label: "Aspirin (SMILES)", value: "CC(=O)Oc1ccccc1C(=O)O" },
  { kind: "name", label: "Caffeine (Name)", value: "caffeine" },
  { kind: "pdb", label: "1CRN (PDB)", value: "1CRN" },
]

export function ExampleChips({ onSelect }: ExampleChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {EXAMPLES.map(ex => (
        <Button
          key={ex.label}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSelect(ex.kind, ex.value)}
        >
          {ex.label}
        </Button>
      ))}
    </div>
  )
}


