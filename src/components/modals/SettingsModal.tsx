import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getModels } from '@/services/api';

interface ModelOption {
  name: string;
  display_name: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: string | null;
  setModel: (model: string | null) => void;
  isInteractive: boolean;
  setIsInteractive: (isInteractive: boolean) => void;
  usePubChem: boolean;
  setUsePubChem: (usePubChem: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  model,
  setModel,
  isInteractive,
  setIsInteractive,
  usePubChem,
  setUsePubChem,
}) => {
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    const fetchModels = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const models = await getModels();
        setModelOptions(models);
      } catch (err: any) {
        console.error('Failed to load model options:', err);
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying model fetch (${retryCount}/${maxRetries}) in ${retryDelay * retryCount}ms`);
          setTimeout(fetchModels, retryDelay * retryCount);
        } else {
          setError('Failed to load model options. Please try again later.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchModels();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Model Selection</Label>
            <Select
              value={model || ''}
              onValueChange={(value) => setModel(value || null)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="-- Select a model --" />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((option) => (
                  <SelectItem key={option.name} value={option.name}>
                    {option.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Select a model to use for generating geometry. This will override the default model.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={isInteractive}
              onCheckedChange={setIsInteractive}
            />
            <Label>Interactive Mode</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Enable interactive mode to control the animation playback and camera.
          </p>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 