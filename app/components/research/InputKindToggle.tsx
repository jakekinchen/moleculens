"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"

export type InputKind = "smiles" | "name" | "pdb"

interface InputKindToggleProps {
  value: InputKind
  onChange: (next: InputKind) => void
}

export function InputKindToggle({ value, onChange }: InputKindToggleProps) {
  const makeButton = (kind: InputKind, label: string) => (
    <Button
      key={kind}
      type="button"
      variant={value === kind ? "secondary" : "outline"}
      size="sm"
      onClick={() => onChange(kind)}
      aria-pressed={value === kind}
    >
      {label}
    </Button>
  )

  return (
    <div className="inline-flex items-center gap-1 rounded-md bg-white/5 p-1">
      {makeButton("smiles", "SMILES")}
      {makeButton("name", "Name")}
      {makeButton("pdb", "PDB")}
    </div>
  )
}


