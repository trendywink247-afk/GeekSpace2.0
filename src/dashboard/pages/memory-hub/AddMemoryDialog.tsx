// ============================================================
// Memory Hub — Full add / edit memory dialog
// ============================================================

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { motion } from 'framer-motion';
import { CATEGORY_OPTIONS } from './helpers';

export interface EditMemoryForm {
  key: string;
  value: string;
  category: string;
}

interface AddMemoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editForm: EditMemoryForm;
  onFormChange: (updates: Partial<EditMemoryForm>) => void;
  onSave: () => void;
}

export function AddMemoryDialog({
  open,
  onOpenChange,
  editForm,
  onFormChange,
  onSave,
}: AddMemoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onOpenChange(false); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Memory</DialogTitle>
          <DialogDescription>Update this memory entry for your agent.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Memory key (e.g. preferred_language)"
            value={editForm.key}
            onChange={e => onFormChange({ key: e.target.value })}
            className="rounded-xl bg-[var(--ag-bg-deep)] border-0"
            style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
          />
          <Textarea
            placeholder="Memory value — what should your agent remember?"
            value={editForm.value}
            onChange={e => onFormChange({ value: e.target.value })}
            rows={4}
            className="rounded-xl resize-none bg-[var(--ag-bg-deep)] border-0"
            style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
          />
          <Select
            value={editForm.category}
            onValueChange={val => onFormChange({ category: val })}
          >
            <SelectTrigger
              className="rounded-xl bg-[var(--ag-bg-deep)] border-0"
              style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
            >
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <motion.div whileTap={{ scale: 0.96 }}>
            <Button
              onClick={onSave}
              disabled={!editForm.key.trim() || !editForm.value.trim()}
              className="border-0 bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:opacity-90 text-white min-h-[44px] transition-opacity"
            >
              Save Changes
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
