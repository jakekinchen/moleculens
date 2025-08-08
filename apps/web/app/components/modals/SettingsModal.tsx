import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Button } from '../ui/button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alwaysFindMolecule: boolean;
  setAlwaysFindMolecule: (value: boolean) => void;
  isInteractive?: boolean;
  setIsInteractive?: (value: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  alwaysFindMolecule,
  setAlwaysFindMolecule,
  isInteractive = false,
  setIsInteractive,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-xl bg-[#0B0F1A]/80 backdrop-blur-xl border border-white/10 shadow-2xl sm:rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight text-white">
            Settings
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Configure your Moleculens preferences
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-6 p-4 rounded-xl bg-white/[0.06] border border-white/10">
            <div className="min-w-0">
              <Label className="block text-white">Molecule interaction</Label>
              <p className="text-sm text-white/60 mt-1">
                Enable atom hover highlighting and tooltips in the 3D viewer.
              </p>
            </div>
            <Switch checked={isInteractive} onCheckedChange={val => setIsInteractive?.(!!val)} />
          </div>

          <div className="flex items-center justify-between gap-6 p-4 rounded-xl bg-white/[0.06] border border-white/10">
            <div className="min-w-0">
              <Label className="block text-white">Always find a molecule for any request</Label>
              <p className="text-sm text-white/60 mt-1">
                If enabled, the app will try to find or invent a related molecule even for unrelated
                prompts.
              </p>
            </div>
            <Switch checked={alwaysFindMolecule} onCheckedChange={setAlwaysFindMolecule} />
          </div>

          <div className="flex justify-end">
            <Button
              className="bg-[#111827]/80 hover:bg-[#1F2937]/80 text-white border border-white/15 shadow-md focus-visible:ring-2 focus-visible:ring-white/20"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
